/**
 * Probe every mounted slug over real HTTP and prove two separate things:
 *
 *   1. tools/list matches the committed stdio tool set exactly.
 *   2. at least one REAL tools/call returns REAL data.
 *
 * (1) alone is worthless: a server can list tools perfectly and still return
 * nothing useful. A slug that passes (1) but fails (2) is reported as a FAIL.
 *
 * The client here is the SDK's own Client + StreamableHTTPClientTransport, so
 * SSE framing and any session header are handled by the same code a real
 * consumer runs - a hand-rolled probe that assumed plain JSON and dropped
 * mcp-session-id would report false negatives against working servers.
 *
 * Usage: PROBE_BASE=http://localhost:8080 tsx scripts/probe.ts [slug ...]
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import expectedTools from '../src/expected-tools.json' with { type: 'json' };

const BASE = process.env.PROBE_BASE ?? 'http://localhost:8080';
const EXPECTED = expectedTools as Record<string, string[]>;

interface Call {
  tool: string;
  args: Record<string, unknown>;
  /** Extra check that the payload is real data, not an empty shell. */
  expect?: (text: string) => boolean;
}

const has = (...needles: string[]) => (t: string) =>
  needles.some((n) => t.toLowerCase().includes(n.toLowerCase()));

/** One realistic call per slug, chosen to need no fixture data. */
const CALL_PLAN: Record<string, Call> = {
  'ben-gurion-flights': { tool: 'get_airport_summary', args: {} },
  'boi-exchange': {
    tool: 'get_exchange_rate',
    args: { currency: 'USD' },
    expect: has('USD', 'ILS'),
  },
  'israel-amutot': {
    tool: 'search_amuta',
    args: { query: 'חינוך', limit: 3 },
  },
  'israel-clinical-trials': {
    tool: 'list_recruiting_trials',
    args: { condition: 'diabetes', limit: 3 },
    expect: has('NCT'),
  },
  'israel-elections': {
    tool: 'search_settlements',
    args: { query: 'תל אביב', knesset_number: 25 },
  },
  'israel-hiking': {
    tool: 'search_pois',
    args: { query: 'מצדה', language: 'he' },
  },
  'israel-medical-research': {
    tool: 'search_papers',
    args: { query: 'cancer', institution: 'Technion', max_results: 3 },
  },
  // NOTE: find_clinics / get_clinic_details / find_by_therapy /
  // find_by_specialization all read data.gov.il resource
  // f7a7b061-db5b-4e19-b1bf-2d7525af52ca, whose public read permission has been
  // REVOKED upstream (403 + "Authorization Error" via plain curl, independent of
  // this host). get_quality_metrics reads different, still-public resources.
  // See PROBE-RESULTS.md.
  'israel-mental-health': {
    tool: 'get_quality_metrics',
    args: { metric: 'treatment_plan' },
  },
  'israel-nature': {
    tool: 'search_species',
    args: { query: 'Gazella', per_page: 3 },
    expect: has('Gazella'),
  },
  'israel-nutrition': {
    tool: 'search_foods',
    args: { query: 'חומוס', limit: 3 },
  },
  'israel-railways': { tool: 'list_stations', args: {} },
  'israel-vehicles': { tool: 'list_manufacturers', args: {} },
  kolzchut: {
    tool: 'kolzchut_search_rights',
    args: { query: 'דמי אבטלה', limit: 3 },
  },
  openbus: { tool: 'list_agencies', args: { limit: 3 } },
  'supermarket-prices': { tool: 'list_chains', args: {} },
  tase: { tool: 'tase_list_indices', args: { lang: 'en-US' } },
  'tel-aviv-city': {
    tool: 'get_bike_stations',
    args: { longitude: 34.7806, latitude: 32.0853, radius_km: 2, limit: 5 },
  },
};

interface Result {
  slug: string;
  listOk: boolean;
  callOk: boolean;
  toolCount: number;
  call: string;
  notes: string;
}

/** Heuristics for "this is an error / empty shell, not real data". */
function looksEmpty(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return true;
  return /^(\s*(\[\]|\{\}|null|no results|none found)\s*)$/i.test(t);
}

async function probeSlug(slug: string): Promise<Result> {
  const result: Result = {
    slug,
    listOk: false,
    callOk: false,
    toolCount: 0,
    call: CALL_PLAN[slug]?.tool ?? '(no plan)',
    notes: '',
  };

  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp/${slug}`));
  const client = new Client({ name: 'skills-il-probe', version: '1.0.0' });

  try {
    await client.connect(transport); // initialize
  } catch (err) {
    result.notes = `initialize failed: ${(err as Error).message}`;
    return result;
  }

  // --- tools/list ---------------------------------------------------------
  try {
    const { tools } = await client.listTools();
    const got = tools.map((t) => t.name).sort();
    const want = [...(EXPECTED[slug] ?? [])].sort();
    result.toolCount = got.length;
    result.listOk = got.length > 0 && got.join(',') === want.join(',');
    if (!result.listOk) {
      const missing = want.filter((n) => !got.includes(n));
      const extra = got.filter((n) => !want.includes(n));
      result.notes =
        `tools/list mismatch;` +
        (missing.length ? ` missing [${missing.join(', ')}]` : '') +
        (extra.length ? ` extra [${extra.join(', ')}]` : '');
    }
  } catch (err) {
    result.notes = `tools/list failed: ${(err as Error).message}`;
    await client.close().catch(() => {});
    return result;
  }

  // --- tools/call ---------------------------------------------------------
  const plan = CALL_PLAN[slug];
  if (!plan) {
    result.notes = [result.notes, 'no call plan authored'].filter(Boolean).join('; ');
    await client.close().catch(() => {});
    return result;
  }

  try {
    const res = (await client.callTool(
      { name: plan.tool, arguments: plan.args },
      undefined,
      { timeout: 90_000 },
    )) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };

    const text = (res.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');

    if (res.isError) {
      result.notes = [result.notes, `tool error: ${text.slice(0, 220)}`]
        .filter(Boolean)
        .join('; ');
    } else if (looksEmpty(text)) {
      result.notes = [result.notes, `empty payload (${text.length} chars): ${text.slice(0, 120)}`]
        .filter(Boolean)
        .join('; ');
    } else if (plan.expect && !plan.expect(text)) {
      result.notes = [result.notes, `payload failed content check: ${text.slice(0, 160)}`]
        .filter(Boolean)
        .join('; ');
    } else {
      result.callOk = true;
      result.notes = [result.notes, `${text.length} chars returned`].filter(Boolean).join('; ');
    }
  } catch (err) {
    result.notes = [result.notes, `tools/call failed: ${(err as Error).message.slice(0, 220)}`]
      .filter(Boolean)
      .join('; ');
  }

  await client.close().catch(() => {});
  return result;
}

async function main() {
  const only = process.argv.slice(2);
  const slugs = (only.length ? only : Object.keys(EXPECTED)).sort();

  const results: Result[] = [];
  for (const slug of slugs) {
    process.stderr.write(`probing ${slug} ... `);
    const r = await probeSlug(slug);
    process.stderr.write(`${r.listOk ? 'list OK' : 'LIST FAIL'} / ${r.callOk ? 'call OK' : 'CALL FAIL'}\n`);
    results.push(r);
  }

  console.log('\n| slug | tools/list OK | live tools/call OK | notes |');
  console.log('| --- | --- | --- | --- |');
  for (const r of results) {
    const notes = `${r.call}: ${r.notes}`.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    console.log(
      `| \`${r.slug}\` | ${r.listOk ? `yes (${r.toolCount})` : 'NO'} | ${r.callOk ? 'yes' : 'NO'} | ${notes} |`,
    );
  }

  const pass = results.filter((r) => r.listOk && r.callOk).length;
  console.log(`\n${pass}/${results.length} slugs fully working.`);
  process.exitCode = pass === results.length ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
