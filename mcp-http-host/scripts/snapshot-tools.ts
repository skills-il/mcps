/**
 * Generate src/expected-tools.json: the committed tool set for every slug.
 *
 * This is the baseline `assertTools()` enforces at mount time, which is what
 * makes "silently shipped a zero-tool server" impossible - a drifted or empty
 * registration throws instead of returning an empty tools/list.
 *
 * Re-run after any intentional upstream tool change.
 *
 * Usage: tsx scripts/snapshot-tools.ts
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'expected-tools.json');

const EXPORT_PACKAGES = [
  'ben-gurion-flights-mcp',
  'boi-exchange-mcp',
  'israel-elections-mcp',
  'israel-hiking-mcp',
  'israel-nature-mcp',
  'israel-nutrition-mcp',
  'israel-railways-mcp',
  'israel-vehicles-mcp',
  'kolzchut-mcp',
  'openbus-mcp',
  'supermarket-prices-mcp',
  'tase-mcp',
];

const ADAPTER_PACKAGES = [
  'israel-amutot-mcp',
  'israel-clinical-trials-mcp',
  'israel-medical-research-mcp',
  'israel-mental-health-mcp',
  'tel-aviv-city-mcp',
];

const slugOf = (p: string) => p.replace(/-mcp$/, '');

/** A stub that records tool names without needing a real SDK server. */
function recorder() {
  const names: string[] = [];
  const capture = (...args: unknown[]) => {
    if (typeof args[0] === 'string') names.push(args[0]);
    return { enable() {}, disable() {}, remove() {}, update() {} };
  };
  return {
    names,
    server: {
      tool: capture,
      registerTool: capture,
      registerResource: () => ({}),
      registerPrompt: () => ({}),
      resource: () => ({}),
      prompt: () => ({}),
      server: { setRequestHandler: () => {} },
    } as any,
  };
}

async function main() {
  const out: Record<string, string[]> = {};

  for (const pkg of EXPORT_PACKAGES) {
    const mod = (await import(`@skills-il/${pkg}/dist/tools.js`)) as {
      registerTools: (s: unknown) => void;
    };
    const rec = recorder();
    mod.registerTools(rec.server);
    if (rec.names.length === 0) throw new Error(`${pkg} registered zero tools`);
    out[slugOf(pkg)] = rec.names;
    console.log(`${slugOf(pkg).padEnd(24)} ${rec.names.length} tools`);
  }

  for (const pkg of ADAPTER_PACKAGES) {
    const slug = slugOf(pkg);
    const mod = (await import(`../src/adapters/${slug}.ts`)) as {
      registerTools: (s: unknown) => void;
      TOOL_NAMES: readonly string[];
    };
    const rec = recorder();
    mod.registerTools(rec.server);
    if (rec.names.length === 0) throw new Error(`${pkg} adapter registered zero tools`);

    // Cross-check the executed registration against the names the codegen
    // statically parsed out of upstream index.ts. A mismatch means the
    // transform dropped or duplicated a registration.
    const parsed = [...mod.TOOL_NAMES].sort().join(',');
    const executed = [...rec.names].sort().join(',');
    if (parsed !== executed) {
      throw new Error(
        `${pkg}: adapter executed [${executed}] but codegen parsed [${parsed}] from index.ts`,
      );
    }

    out[slug] = rec.names;
    console.log(`${slug.padEnd(24)} ${rec.names.length} tools (adapter)`);
  }

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log(
    `\nWrote ${OUT}\n${Object.keys(sorted).length} slugs, ` +
      `${Object.values(sorted).reduce((n, t) => n + t.length, 0)} tools total`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
