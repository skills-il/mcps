/**
 * skills-il MCP HTTP host.
 *
 * Mounts every skills-il MCP server in ONE process and serves each at
 * POST /mcp/<slug> over Streamable HTTP, so consumers that cannot spawn an
 * `npx` stdio child (e.g. sandboxed agent pods with no network egress of their
 * own) can still reach the Israeli catalog.
 *
 * Design notes:
 *
 * - STATELESS. `sessionIdGenerator: undefined`, with a fresh McpServer and
 *   transport per request. There is no session id to track, so consumers need
 *   no session affinity and the host scales horizontally for free. (If this is
 *   ever switched to stateful, the host MUST relay the `mcp-session-id`
 *   response header to the client, or every post-initialize call fails with
 *   "Missing session ID" and the server looks like it has zero tools.)
 *
 * - ONE process, not 17. This is the only place a governor can see all egress,
 *   which matters because six mounted servers share data.gov.il. See governor.ts.
 *
 * - Per-slug failure isolation. A package that fails to import is recorded and
 *   its route 503s; a handler that throws returns a JSON-RPC error. Neither
 *   takes down the host or the other slugs.
 */

import express, { type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { adapt, assertTools } from './adapt.js';
import { buildRegistry, type Registry } from './registry.js';
import {
  EgressGovernor,
  installEgressGovernor,
  limitsFromEnv,
  DEFAULT_LIMITS,
} from './governor.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const MAX_EGRESS_WAIT_MS = Number(process.env.MCP_EGRESS_MAX_WAIT_MS ?? 15_000);
const BODY_LIMIT = process.env.MCP_BODY_LIMIT ?? '4mb';

/**
 * DNS-rebinding protection. The transport rejects requests whose Host header
 * is not in this list. Set MCP_ALLOWED_HOSTS to the hostnames this deployment
 * is actually reached on (comma-separated).
 */
const ALLOWED_HOSTS = (process.env.MCP_ALLOWED_HOSTS ?? `localhost:${PORT},127.0.0.1:${PORT}`)
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const JSONRPC_INTERNAL_ERROR = -32603;
const JSONRPC_METHOD_NOT_FOUND = -32601;

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  if (res.headersSent) return;
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

async function main(): Promise<void> {
  const governor = installEgressGovernor(
    new EgressGovernor(limitsFromEnv(process.env.MCP_EGRESS_LIMITS), DEFAULT_LIMITS, MAX_EGRESS_WAIT_MS),
  );

  const registry: Registry = await buildRegistry();

  for (const f of registry.failed) {
    console.error(`[mount] FAILED ${f.slug} (${f.packageName}): ${f.error}`);
  }
  console.error(
    `[mount] ${registry.mounts.size} slug(s) mounted, ${registry.failed.length} failed`,
  );

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: BODY_LIMIT }));

  // --- health ------------------------------------------------------------
  app.get('/healthz', (_req: Request, res: Response) => {
    const lanes = governor.stats();
    res.json({
      status: registry.mounts.size > 0 ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      stateless: true,
      mounted: [...registry.mounts.values()].map((m) => ({
        slug: m.slug,
        package: m.packageName,
        version: m.version,
        kind: m.kind,
        tools: m.expected.length,
      })),
      failed: registry.failed,
      egress: {
        maxWaitMs: governor.maxWaitMs,
        // A persistently deep lane is a visible signal, not a surprise ban.
        lanes,
        totalQueueDepth: lanes.reduce((n, l) => n + l.queueDepth, 0),
      },
    });
  });

  // --- MCP endpoints -----------------------------------------------------
  app.post('/mcp/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const entry = registry.mounts.get(slug);

    if (!entry) {
      const known = registry.failed.find((f) => f.slug === slug);
      if (known) {
        jsonRpcError(
          res,
          503,
          JSONRPC_INTERNAL_ERROR,
          `Server "${slug}" failed to load and is unavailable: ${known.error}`,
        );
        return;
      }
      jsonRpcError(
        res,
        404,
        JSONRPC_METHOD_NOT_FOUND,
        `Unknown server "${slug}". Mounted: ${[...registry.mounts.keys()].join(', ')}`,
      );
      return;
    }

    let server: McpServer | undefined;
    let transport: StreamableHTTPServerTransport | undefined;

    try {
      server = new McpServer({ name: entry.packageName, version: entry.version });

      // adapt() absorbs the SDK-version skew between the host and the package
      // and records what actually got registered.
      const { proxy, names } = adapt(server);
      entry.register(proxy);
      assertTools(entry.slug, names, entry.expected);

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableDnsRebindingProtection: true,
        allowedHosts: ALLOWED_HOSTS,
      });

      // Fresh server+transport per request: tear both down when the response
      // ends so a long-lived host does not leak them.
      res.on('close', () => {
        void transport?.close();
        void server?.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${slug}] request failed: ${message}`);
      jsonRpcError(res, 500, JSONRPC_INTERNAL_ERROR, `Server "${slug}" error: ${message}`);
      void transport?.close();
      void server?.close();
    }
  });

  // Stateless mode has no server-initiated stream and no session to delete.
  const methodNotAllowed = (req: Request, res: Response) => {
    jsonRpcError(
      res,
      405,
      JSONRPC_METHOD_NOT_FOUND,
      `${req.method} is not supported: this host runs Streamable HTTP in stateless mode ` +
        `(no sessions, no server-initiated streams). Use POST.`,
    );
  };
  app.get('/mcp/:slug', methodNotAllowed);
  app.delete('/mcp/:slug', methodNotAllowed);

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: '@skills-il/mcp-http-host',
      transport: 'streamable-http (stateless)',
      endpoints: [...registry.mounts.keys()].map((s) => `POST /mcp/${s}`),
      health: 'GET /healthz',
    });
  });

  // A throw anywhere must not kill the host and take the other 16 with it.
  process.on('uncaughtException', (err) => {
    console.error('[host] uncaughtException (continuing):', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[host] unhandledRejection (continuing):', reason);
  });

  const httpServer = app.listen(PORT, HOST, () => {
    console.error(`[host] listening on http://${HOST}:${PORT}`);
    console.error(`[host] allowed Host headers: ${ALLOWED_HOSTS.join(', ')}`);
    for (const slug of registry.mounts.keys()) console.error(`[host]   POST /mcp/${slug}`);
  });

  const shutdown = (signal: string) => {
    console.error(`[host] ${signal} received, shutting down`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[host] fatal startup error:', err);
  process.exit(1);
});
