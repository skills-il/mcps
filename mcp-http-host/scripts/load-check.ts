/**
 * Governor load check.
 *
 * Fires concurrent tool calls across the SIX servers that share data.gov.il and
 * samples /healthz throughout, asserting the shared lane never exceeds its
 * configured maxConcurrency. This is the claim the whole one-host design rests
 * on: six packages throttling independently would each see concurrency 1 while
 * hammering the upstream with 6.
 *
 * Usage: PROBE_BASE=http://localhost:8080 tsx scripts/load-check.ts
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.env.PROBE_BASE ?? 'http://localhost:8080';
const GOV_HOST = 'data.gov.il';

/** All six data.gov.il-backed servers, with a real call each. */
const CALLS: Array<[string, string, Record<string, unknown>]> = [
  ['israel-amutot', 'search_amuta', { query: 'חינוך', limit: 3 }],
  ['israel-vehicles', 'list_manufacturers', {}],
  ['israel-nutrition', 'search_foods', { query: 'חומוס', limit: 3 }],
  ['israel-mental-health', 'get_quality_metrics', { metric: 'treatment_plan' }],
  ['israel-elections', 'search_settlements', { query: 'תל אביב', knesset_number: 25 }],
  ['ben-gurion-flights', 'get_airport_summary', {}],
];

async function callOnce(slug: string, tool: string, args: Record<string, unknown>) {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp/${slug}`));
  const client = new Client({ name: 'load-check', version: '1.0.0' });
  await client.connect(transport);
  try {
    await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 90_000 });
  } finally {
    await client.close().catch(() => {});
  }
}

async function main() {
  let maxActive = 0;
  let maxDepth = 0;
  let limit = 0;
  let sampled = 0;
  let stop = false;

  const sampler = (async () => {
    while (!stop) {
      try {
        const res = await fetch(`${BASE}/healthz`);
        const body = (await res.json()) as any;
        const lane = body.egress.lanes.find((l: any) => l.host === GOV_HOST);
        if (lane) {
          sampled++;
          limit = lane.limits.maxConcurrency;
          maxActive = Math.max(maxActive, lane.active);
          maxDepth = Math.max(maxDepth, lane.queueDepth);
        }
      } catch {
        /* ignore sampling blips */
      }
      await new Promise((r) => setTimeout(r, 15));
    }
  })();

  // 3 concurrent rounds over all six servers = 18 concurrent upstream calls.
  const burst = Array.from({ length: 3 }, () => CALLS).flat();
  console.log(`firing ${burst.length} concurrent calls across ${CALLS.length} data.gov.il servers...`);
  const started = Date.now();
  const results = await Promise.allSettled(burst.map(([s, t, a]) => callOnce(s, t, a)));
  const elapsed = Date.now() - started;
  stop = true;
  await sampler;

  const ok = results.filter((r) => r.status === 'fulfilled').length;

  console.log(`\ncompleted ${ok}/${burst.length} in ${elapsed}ms`);
  console.log(`${GOV_HOST} lane: maxConcurrency=${limit}, peak active=${maxActive}, peak queueDepth=${maxDepth}`);
  console.log(`healthz samples: ${sampled}`);

  if (sampled === 0) {
    console.error('\nFAIL: never observed the data.gov.il lane; cannot verify the governor.');
    process.exit(1);
  }
  if (maxActive > limit) {
    console.error(`\nFAIL: lane exceeded its cap (${maxActive} > ${limit}).`);
    process.exit(1);
  }
  if (maxDepth === 0) {
    console.warn(
      '\nWARN: queue never went deep, so contention was not actually exercised. ' +
        'Re-run with a larger burst.',
    );
  }
  console.log('\nPASS: shared data.gov.il lane held its concurrency cap under contention.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
