#!/usr/bin/env node
/**
 * Falsifiable tests for gzip-transparent body decoding (src/client.ts decodeBody).
 *
 * The Israeli price feeds (PriceFull / PromoFull / Price) are .gz FILES, not
 * Content-Encoding: gzip transport, so fetch() hands back raw gzip bytes and the
 * old code decoded them straight as text -> binary garbage, zero <Item> parsed.
 *
 * These tests stub global fetch and drive the real exported fetchXml/fetchText,
 * so they exercise the same decode path the MCP host runs. They MUST fail against
 * the pre-1.1.0 code (which returned the undecompressed garbage).
 *
 * Run: node test/gzip.test.mjs (from package root, after `npm run build`).
 * Exits non-zero on any failure.
 */
import { gzipSync } from "node:zlib";
import { fetchXml, fetchText } from "../dist/client.js";

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // must match client.ts

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
  else fail(label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(String(actual).slice(0, 120))}`);
}

const realFetch = globalThis.fetch;
/** Stub fetch to return one fixed body (bytes) with an explicit content-length. */
function stubFetch(bytes, contentLength) {
  globalThis.fetch = async () =>
    new Response(bytes, {
      status: 200,
      headers: { "content-length": String(contentLength ?? bytes.length) },
    });
}

const SAMPLE_XML =
  '<?xml version="1.0" encoding="UTF-8"?><Root><Items><Item><ItemCode>7290000000001</ItemCode><ItemName>חלב 3%</ItemName><ItemPrice>6.90</ItemPrice></Item></Items></Root>';

try {
  // ------ 1. gzip body is transparently inflated ------
  console.log("\ngzip body decoding");
  {
    const gz = gzipSync(Buffer.from(SAMPLE_XML, "utf-8"));
    // sanity: raw gz bytes are NOT the xml (guards against a no-op stub)
    if (new TextDecoder().decode(gz) === SAMPLE_XML) {
      fail("test setup", "gzip output unexpectedly equals plaintext");
    } else {
      ok("gzip bytes differ from plaintext (setup sane)");
    }
    stubFetch(gz);
    const out = await fetchXml("https://prices.example.co.il/PriceFull123.gz");
    eq(out, SAMPLE_XML, "fetchXml inflates a .gz body back to the original XML");

    stubFetch(gzipSync(Buffer.from(SAMPLE_XML, "utf-8")));
    const outText = await fetchText("https://prices.example.co.il/PriceFull123.gz");
    eq(outText, SAMPLE_XML, "fetchText inflates a .gz body back to the original XML");
  }

  // ------ 2. plain (non-gzip) body passes through unchanged ------
  console.log("\nplain body passthrough");
  {
    stubFetch(Buffer.from(SAMPLE_XML, "utf-8"));
    const out = await fetchXml("https://prices.example.co.il/plain.xml");
    eq(out, SAMPLE_XML, "fetchXml returns a non-gzip body unchanged");
  }

  // ------ 3. decompressed payload over the cap throws (zip-bomb guard) ------
  console.log("\nzip-bomb guard");
  {
    // 11MB of a single repeated byte compresses to a few KB; declared
    // content-length stays under the cap so only the post-inflate check fires.
    const huge = Buffer.alloc(MAX_RESPONSE_SIZE + 1024 * 1024, 0x41); // 11MB of 'A'
    const gzHuge = gzipSync(huge);
    if (gzHuge.length > MAX_RESPONSE_SIZE) {
      fail("test setup", "compressed bomb unexpectedly exceeds cap");
    } else {
      stubFetch(gzHuge);
      let threw = false;
      try {
        await fetchXml("https://prices.example.co.il/bomb.gz");
      } catch (e) {
        threw = /too large/i.test(String(e));
      }
      if (threw) ok("a .gz body inflating past the cap throws 'too large'");
      else fail("zip-bomb guard", "expected fetchXml to throw on oversized decompressed payload");
    }
  }
} finally {
  globalThis.fetch = realFetch;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
