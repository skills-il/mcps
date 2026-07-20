/**
 * Cross-SDK-version adapter.
 *
 * The 17 packages depend on @modelcontextprotocol/sdk versions ranging from
 * ^1.6.1 to ^1.28.0, and each vendors its own copy. Their `registerTools`
 * exports are therefore typed against *different* McpServer declarations than
 * the one this host instantiates - structurally compatible at runtime, but
 * nominally distinct to TypeScript.
 *
 * `adapt()` is the single place that absorbs that. It also wraps the server in
 * a counting proxy so we can assert, per mount, that registration actually
 * happened. Counting the proxy's calls is version-agnostic; reading the SDK's
 * private `_registeredTools` would not be.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** The shape a package's registerTools/adapter expects. Intentionally loose. */
export type AnyMcpServer = any;

/** Registration methods a mounted package may call on the server. */
const REGISTRATION_METHODS = ['registerTool', 'tool'] as const;

export interface AdaptedServer {
  /** Pass this to the package's registerTools()/adapter. */
  proxy: AnyMcpServer;
  /** Tool names observed during registration, in call order. */
  names: string[];
}

export class AdapterShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdapterShapeError';
  }
}

/**
 * Wrap the host's McpServer for handoff to a package built against a different
 * SDK version. Records every tool name registered through it.
 */
export function adapt(server: McpServer): AdaptedServer {
  const missing = REGISTRATION_METHODS.filter(
    (m) => typeof (server as unknown as Record<string, unknown>)[m] !== 'function',
  );
  if (missing.length === REGISTRATION_METHODS.length) {
    throw new AdapterShapeError(
      `Host SDK's McpServer exposes none of [${REGISTRATION_METHODS.join(', ')}]. ` +
        `The mounted packages call these directly; the host SDK is incompatible.`,
    );
  }

  const names: string[] = [];

  const proxy = new Proxy(server as unknown as Record<string, unknown>, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (
        typeof value === 'function' &&
        (prop === 'registerTool' || prop === 'tool')
      ) {
        return function (this: unknown, ...args: unknown[]) {
          if (typeof args[0] === 'string') names.push(args[0]);
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return { proxy, names };
}

/**
 * Hard gate: a mounted slug must expose exactly the tools we expect.
 *
 * This is what stops a silently zero-tool server from shipping. `expected` is
 * generated from the real stdio servers (npm run snapshot:tools) and committed,
 * so upstream drift fails loudly at mount time instead of surfacing as an
 * empty tools/list with no error.
 */
export function assertTools(slug: string, observed: string[], expected: string[]): void {
  if (observed.length === 0) {
    throw new AdapterShapeError(
      `Slug "${slug}" registered ZERO tools. Refusing to mount an empty server.`,
    );
  }

  const obs = [...observed].sort();
  const exp = [...expected].sort();
  const missing = exp.filter((n) => !obs.includes(n));
  const extra = obs.filter((n) => !exp.includes(n));

  if (missing.length > 0 || extra.length > 0) {
    throw new AdapterShapeError(
      `Slug "${slug}" tool set drifted from the committed snapshot.` +
        (missing.length ? ` Missing: [${missing.join(', ')}].` : '') +
        (extra.length ? ` Unexpected: [${extra.join(', ')}].` : '') +
        ` Re-run "npm run snapshot:tools" if this change is intentional.`,
    );
  }
}
