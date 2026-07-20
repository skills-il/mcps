/**
 * Build gate. Runs before tsc (see package.json "build").
 *
 * 1. Re-generates the 5 inline adapters from upstream index.ts and byte-compares
 *    them against what is committed. Upstream drift fails the build loudly.
 * 2. Re-derives every slug's tool set and compares it to the committed
 *    src/expected-tools.json snapshot.
 *
 * Together these make it impossible to ship a server whose tool set silently
 * changed - or silently emptied.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAdapter, INLINE_PACKAGES } from './generate-adapters.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADAPTER_DIR = join(HERE, '..', 'src', 'adapters');
const SNAPSHOT = join(HERE, '..', 'src', 'expected-tools.json');

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

const slugOf = (p: string) => p.replace(/-mcp$/, '');

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
  const problems: string[] = [];

  // --- 1. adapters match upstream ----------------------------------------
  for (const pkg of INLINE_PACKAGES) {
    const outPath = join(ADAPTER_DIR, `${slugOf(pkg)}.ts`);
    try {
      const { code } = generateAdapter(pkg);
      const existing = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
      if (existing !== code) {
        problems.push(
          `ADAPTER DRIFT: ${pkg}/src/index.ts changed. ` +
            `src/adapters/${slugOf(pkg)}.ts is stale. ` +
            `Review upstream, then run: npx tsx scripts/generate-adapters.ts`,
        );
      }
    } catch (err) {
      problems.push(`ADAPTER ERROR: ${(err as Error).message}`);
    }
  }

  // --- 2. tool sets match the committed snapshot -------------------------
  if (!existsSync(SNAPSHOT)) {
    problems.push(`Missing src/expected-tools.json. Run: npm run snapshot:tools`);
  } else {
    const expected = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, string[]>;

    const check = (slug: string, observed: string[]) => {
      const want = expected[slug];
      if (!want) {
        problems.push(`SNAPSHOT: no entry for "${slug}". Run: npm run snapshot:tools`);
        return;
      }
      if (observed.length === 0) {
        problems.push(`ZERO TOOLS: "${slug}" registered nothing.`);
        return;
      }
      const a = [...observed].sort().join(',');
      const b = [...want].sort().join(',');
      if (a !== b) {
        problems.push(`TOOL DRIFT: "${slug}" now [${a}], snapshot says [${b}].`);
      }
    };

    for (const pkg of EXPORT_PACKAGES) {
      try {
        const mod = (await import(`@skills-il/${pkg}/dist/tools.js`)) as {
          registerTools?: (s: unknown) => void;
        };
        if (typeof mod.registerTools !== 'function') {
          problems.push(`${pkg}/dist/tools.js no longer exports registerTools().`);
          continue;
        }
        const rec = recorder();
        mod.registerTools(rec.server);
        check(slugOf(pkg), rec.names);
      } catch (err) {
        problems.push(`LOAD ERROR ${pkg}: ${(err as Error).message}`);
      }
    }

    for (const pkg of INLINE_PACKAGES) {
      try {
        const mod = (await import(`../src/adapters/${slugOf(pkg)}.ts`)) as {
          registerTools?: (s: unknown) => void;
        };
        if (typeof mod.registerTools !== 'function') {
          problems.push(`Adapter ${slugOf(pkg)} exports no registerTools().`);
          continue;
        }
        const rec = recorder();
        mod.registerTools(rec.server);
        check(slugOf(pkg), rec.names);
      } catch (err) {
        problems.push(`LOAD ERROR adapter ${pkg}: ${(err as Error).message}`);
      }
    }
  }

  if (problems.length > 0) {
    console.error('\nBUILD GATE FAILED:\n');
    for (const p of problems) console.error(`  - ${p}`);
    console.error('');
    process.exit(1);
  }

  console.log(`verify:adapters OK (${INLINE_PACKAGES.length} adapters, ${EXPORT_PACKAGES.length} exports)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
