#!/usr/bin/env node
/**
 * Falsifiable tests for the two Shufersal URL-path bugs fixed in 1.2.0.
 *
 * Bug 1: scraped hrefs keep literal &amp; entities, which corrupt the Azure SAS
 *        signature -> 404. parseShufersalFileList must emit raw '&'.
 * Bug 2: the search_products allowlist rejected pricesprodpublic.blob.core.windows.net,
 *        the CDN Shufersal actually serves files from. validateUrl must accept it.
 *
 * These are deterministic (no network) and MUST fail against the pre-1.2.0 code.
 *
 * Run: node test/url-resolution.test.mjs (from package root, after `npm run build`).
 */
import {
  decodeHtmlEntities,
  parseShufersalFileList,
  validateUrl,
} from "../dist/tools.js";

let failed = 0;
let passed = 0;
function ok(label) { passed++; console.log(`  PASS  ${label}`); }
function fail(label, detail) { failed++; console.log(`  FAIL  ${label}`); if (detail) console.log(`        ${detail}`); }
function eq(actual, expected, label) {
  if (actual === expected) ok(label);
  else fail(label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ------ decodeHtmlEntities ------
console.log("\ndecodeHtmlEntities");
eq(
  decodeHtmlEntities("sv=2014-02-14&amp;sr=b&amp;sig=aBc%2Fd"),
  "sv=2014-02-14&sr=b&sig=aBc%2Fd",
  "&amp; -> & (SAS query restored)"
);
eq(decodeHtmlEntities("a&lt;b&gt;c&quot;d&#39;e"), 'a<b>c"d\'e', "lt/gt/quot/#39 decoded");
eq(decodeHtmlEntities("x&#x27;y"), "x'y", "&#x27; decoded");
eq(decodeHtmlEntities("no entities here"), "no entities here", "plain string unchanged");

// ------ parseShufersalFileList (Bug 1) ------
console.log("\nparseShufersalFileList");
const sasUrl =
  "https://pricesprodpublic.blob.core.windows.net/pricefull/PriceFull7290027600007-001-202607210340.gz" +
  "?sv=2014-02-14&amp;sr=b&amp;sig=SIGNATURE%2Bhere&amp;se=2026-07-21T12%3A00%3A00Z";
const sampleHtml = `<table><tr>
  <td>PriceFull7290027600007-001-202607210340.gz</td><td>2026-07-21</td>
  <td><a href="${sasUrl}">Download</a></td>
</tr></table>`;

const entries = parseShufersalFileList(sampleHtml);
if (entries.length === 0) {
  fail("parse returns an entry", "got 0 entries");
} else {
  const url = entries[0].url;
  if (url.includes("&amp;")) fail("scraped URL has NO literal &amp;", url);
  else ok("scraped URL has NO literal &amp;");
  if (url.includes("&sig=") && url.includes("&sr=")) ok("SAS separators are raw '&'");
  else fail("SAS separators are raw '&'", url);
  // filename is extracted cleanly despite the trailing ?query
  eq(entries[0].name, "PriceFull7290027600007-001-202607210340.gz", "filename extracted without query string");
}

// ------ validateUrl allowlist (Bug 2) ------
console.log("\nvalidateUrl allowlist");
try {
  validateUrl("https://pricesprodpublic.blob.core.windows.net/pricefull/x.gz?sv=1&sig=2");
  ok("blob CDN host is allowlisted");
} catch (e) {
  fail("blob CDN host is allowlisted", String(e));
}
try {
  validateUrl("https://prices.shufersal.co.il/FileObject/UpdateCategory?catID=2");
  ok("shufersal portal host still allowed");
} catch (e) {
  fail("shufersal portal host still allowed", String(e));
}
try {
  validateUrl("https://evil.example.com/x.gz");
  fail("unlisted host rejected", "expected validateUrl to throw");
} catch {
  ok("unlisted host rejected (SSRF guard intact)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
