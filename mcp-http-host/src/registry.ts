/**
 * The mount registry: slug -> a function that registers that server's tools
 * onto a fresh McpServer.
 *
 * 12 packages expose a transport-agnostic `registerTools(server)` and are
 * imported directly from their published dist. The other 5 register inline in
 * index.ts (which connects stdio at import time), so they go through a
 * generated adapter in src/adapters/ instead.
 *
 * Loading is per-slug and isolated: a package that fails to import is recorded
 * as unavailable and its route returns 503. It cannot stop the host from
 * booting or take down the other 16.
 */

import { createRequire } from 'node:module';
import type { AnyMcpServer } from './adapt.js';
import expectedTools from './expected-tools.json' with { type: 'json' };

const require = createRequire(import.meta.url);

export type RegisterFn = (server: AnyMcpServer) => void;

export interface MountEntry {
  slug: string;
  packageName: string;
  version: string;
  /** 'export' = package's own registerTools; 'adapter' = generated from inline index.ts. */
  kind: 'export' | 'adapter';
  register: RegisterFn;
  expected: string[];
}

export interface FailedMount {
  slug: string;
  packageName: string;
  error: string;
}

/** Packages exposing registerTools() directly. */
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
] as const;

/** Packages registering tools inline in index.ts -> generated adapters. */
const ADAPTER_PACKAGES = [
  'israel-amutot-mcp',
  'israel-clinical-trials-mcp',
  'israel-medical-research-mcp',
  'israel-mental-health-mcp',
  'tel-aviv-city-mcp',
] as const;

export const ALL_PACKAGES = [...EXPORT_PACKAGES, ...ADAPTER_PACKAGES];

export function slugOf(pkg: string): string {
  return pkg.replace(/-mcp$/, '');
}

function versionOf(pkg: string): string {
  try {
    return require(`@skills-il/${pkg}/package.json`).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function expectedFor(slug: string): string[] {
  const tools = (expectedTools as Record<string, string[]>)[slug];
  if (!tools || tools.length === 0) {
    throw new Error(
      `No committed tool snapshot for slug "${slug}". Run "npm run snapshot:tools".`,
    );
  }
  return tools;
}

export interface Registry {
  mounts: Map<string, MountEntry>;
  failed: FailedMount[];
}

/** Build the registry, isolating per-package import failures. */
export async function buildRegistry(): Promise<Registry> {
  const mounts = new Map<string, MountEntry>();
  const failed: FailedMount[] = [];

  for (const pkg of EXPORT_PACKAGES) {
    const slug = slugOf(pkg);
    try {
      const mod = (await import(`@skills-il/${pkg}/dist/tools.js`)) as {
        registerTools?: RegisterFn;
      };
      if (typeof mod.registerTools !== 'function') {
        throw new Error(
          `${pkg}/dist/tools.js no longer exports registerTools(). ` +
            `Upstream shape changed; this package cannot be mounted.`,
        );
      }
      mounts.set(slug, {
        slug,
        packageName: `@skills-il/${pkg}`,
        version: versionOf(pkg),
        kind: 'export',
        register: mod.registerTools,
        expected: expectedFor(slug),
      });
    } catch (err) {
      failed.push({ slug, packageName: `@skills-il/${pkg}`, error: (err as Error).message });
    }
  }

  for (const pkg of ADAPTER_PACKAGES) {
    const slug = slugOf(pkg);
    try {
      const mod = (await import(`./adapters/${slug}.js`)) as {
        registerTools?: RegisterFn;
      };
      if (typeof mod.registerTools !== 'function') {
        throw new Error(`Generated adapter src/adapters/${slug}.ts exports no registerTools().`);
      }
      mounts.set(slug, {
        slug,
        packageName: `@skills-il/${pkg}`,
        version: versionOf(pkg),
        kind: 'adapter',
        register: mod.registerTools,
        expected: expectedFor(slug),
      });
    } catch (err) {
      failed.push({ slug, packageName: `@skills-il/${pkg}`, error: (err as Error).message });
    }
  }

  return { mounts, failed };
}
