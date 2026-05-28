#!/usr/bin/env node
/**
 * Smoke tests run against the live data.gov.il API and the built dist/.
 *
 * Purpose: catch wrong party mappings, broken resource IDs, and settlement-
 * resolver regressions before publishing. No mocking; this hits prod data and
 * exercises the same code that runs in users' MCP host.
 *
 * Run: node test/smoke.test.mjs (from package root, after `npm run build`).
 * Exits non-zero on any failure.
 */
import {
  datastoreSearch,
  getSettlementResourceId,
  SUPPORTED_KNESSETS,
} from "../dist/client.js";
import { lookupParty, formatPartyLabel } from "../dist/parties.js";

let failed = 0;
let passed = 0;

function ok(label) {
  passed++;
  console.log(`  PASS  ${label}`);
}

function fail(label, detail) {
  failed++;
  console.log(`  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

function eq(actual, expected, label) {
  if (actual === expected) ok(label);
  else fail(label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function includes(haystack, needle, label) {
  if (haystack.includes(needle)) ok(label);
  else fail(label, `expected to contain ${JSON.stringify(needle)}, got ${JSON.stringify(haystack)}`);
}

// ------ party mapping unit tests ------
console.log("\nparties.ts mappings");

// K25: party codes I sanity-checked against Jerusalem K25 (UTJ > Likud > Shas > RZ)
eq(lookupParty(25, "מחל")?.en, "Likud", "K25 מחל = Likud");
eq(lookupParty(25, "פה")?.en, "Yesh Atid", "K25 פה = Yesh Atid");
eq(lookupParty(25, "כן")?.en, "National Unity", "K25 כן = National Unity (not Blue and White)");
eq(lookupParty(25, "ב")?.en, "HaBayit HaYehudi", "K25 ב = HaBayit HaYehudi (Shaked split)");

// K24: same code KN means different party
eq(lookupParty(24, "כן")?.en, "Blue and White", "K24 כן = Blue and White (Gantz)");
eq(lookupParty(24, "ב")?.en, "Yamina", "K24 ב = Yamina (Bennett)");
eq(lookupParty(24, "ת")?.en, "New Hope", "K24 ת = New Hope (Sa'ar)");

// K23: joint lists
eq(lookupParty(23, "ודעם")?.en, "Joint List", "K23 ודעם = Joint List");
includes(lookupParty(23, "אמת")?.en || "", "Labor", "K23 אמת contains Labor");
eq(lookupParty(23, "פה")?.en, "Blue and White", "K23 פה = Blue and White (Gantz+Lapid joint)");

// K22/K21 (added v1.1.1)
eq(lookupParty(22, "פה")?.en, "Blue and White", "K22 פה = Blue and White");
eq(lookupParty(21, "טב")?.en, "Union of Right-Wing Parties (URWP)", "K21 טב = URWP");
eq(lookupParty(21, "דעם")?.en, "Ra'am-Balad", "K21 דעם = Ra'am-Balad");
eq(lookupParty(21, "ז")?.en, "Zehut", "K21 ז = Zehut");

// Unknown codes fall through
eq(lookupParty(25, "xx_unknown"), null, "Unknown code returns null");
eq(formatPartyLabel(25, "xx_unknown"), "xx_unknown", "Unknown code formats as raw");

// Format string is em-dash free per project rule
const sample = formatPartyLabel(25, "מחל");
if (!sample.includes("—")) ok("formatPartyLabel has no em dash");
else fail("formatPartyLabel has em dash", sample);

// ------ supported knessets ------
console.log("\nSUPPORTED_KNESSETS");
eq(SUPPORTED_KNESSETS.length, 5, "5 Knessets supported");
eq(SUPPORTED_KNESSETS.includes(21), true, "K21 supported");
eq(SUPPORTED_KNESSETS.includes(25), true, "K25 supported");

// ------ live data.gov.il integration ------
console.log("\nlive API integration");

// Every supported Knesset's settlement resource is reachable
for (const kn of SUPPORTED_KNESSETS) {
  const rid = getSettlementResourceId(kn);
  try {
    const r = await datastoreSearch({ resourceId: rid, limit: 1 });
    if (r.records.length > 0 && r.total > 0) ok(`K${kn} settlement resource reachable (${r.total} rows)`);
    else fail(`K${kn} settlement resource empty`, JSON.stringify(r).slice(0, 200));
  } catch (e) {
    fail(`K${kn} settlement resource fetch threw`, String(e).slice(0, 200));
  }
}

// Jerusalem K25 top-party sanity: UTJ > Likud > Shas > Religious Zionism
console.log("\nK25 Jerusalem top-party sanity");
try {
  const rid = getSettlementResourceId(25);
  const r = await datastoreSearch({ resourceId: rid, filters: { "שם ישוב": "ירושלים" }, limit: 1 });
  if (r.records.length === 0) {
    fail("Jerusalem K25 lookup", "no rows returned");
  } else {
    const rec = r.records[0];
    const meta = new Set(["_id", "סמל ועדה", "שם ישוב", "סמל ישוב", "בזב", "מצביעים", "פסולים", "כשרים"]);
    const ranked = Object.entries(rec)
      .filter(([k, v]) => !meta.has(k) && Number(v) > 0)
      .map(([k, v]) => [k, Number(v)])
      .sort((a, b) => b[1] - a[1]);
    const top4 = ranked.slice(0, 4).map(([c]) => c);
    // Expected: UTJ (ג), Likud (מחל), Shas (שס), Religious Zionism (ט)
    if (top4[0] === "ג") ok("Jerusalem K25 #1 is ג (UTJ)");
    else fail("Jerusalem K25 #1", `expected ג got ${top4[0]}`);
    if (top4[1] === "מחל") ok("Jerusalem K25 #2 is מחל (Likud)");
    else fail("Jerusalem K25 #2", `expected מחל got ${top4[1]}`);
    if (top4[2] === "שס") ok("Jerusalem K25 #3 is שס (Shas)");
    else fail("Jerusalem K25 #3", `expected שס got ${top4[2]}`);
  }
} catch (e) {
  fail("Jerusalem K25 sanity threw", String(e).slice(0, 200));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
