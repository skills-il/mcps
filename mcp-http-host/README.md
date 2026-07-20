# @skills-il/mcp-http-host

One process that mounts **all 17 skills-il MCP servers** and serves each over
Streamable HTTP at `POST /mcp/<slug>`.

The servers in this repo are consumed over **stdio** (`npx -y
@skills-il/<name>-mcp`). Consumers that run agents in sandboxed pods with no
network and no ability to spawn an `npx` child process cannot use stdio at all,
which puts the whole Israeli catalog out of reach. This host makes every one of
them reachable over HTTP without touching a single published package.

**Zero changes to the 17 packages.** Existing stdio installs keep working
byte-identically. This host only imports them.

---

## Run it locally

```bash
# 1. build the packages (each vendors its own MCP SDK version)
cd .. && for d in *-mcp; do (cd "$d" && npm install && npm run build); done

# 2. build and start the host
cd mcp-http-host && npm install && npm run build && npm start
```

Then:

```bash
curl localhost:8080/healthz
npm run probe            # verifies every slug end to end
npm run load-check       # verifies the shared egress governor under contention
```

### Docker

The build context is the **repo root**, because the host depends on its 17
sibling packages via `file:../<pkg>`:

```bash
docker build -f mcp-http-host/Dockerfile -t skills-il-mcp-http-host .
docker run -p 8080:8080 -e MCP_ALLOWED_HOSTS=localhost:8080 skills-il-mcp-http-host
```

Deploying this image is deliberately out of scope for this package.

---

## Mounted slugs

17 slugs, 124 tools. `POST /mcp/<slug>`.

| slug | package | tools | mount |
| --- | --- | --- | --- |
| `ben-gurion-flights` | `@skills-il/ben-gurion-flights-mcp` | 5 | export |
| `boi-exchange` | `@skills-il/boi-exchange-mcp` | 5 | export |
| `israel-amutot` | `@skills-il/israel-amutot-mcp` | 11 | adapter |
| `israel-clinical-trials` | `@skills-il/israel-clinical-trials-mcp` | 5 | adapter |
| `israel-elections` | `@skills-il/israel-elections-mcp` | 4 | export |
| `israel-hiking` | `@skills-il/israel-hiking-mcp` | 5 | export |
| `israel-medical-research` | `@skills-il/israel-medical-research-mcp` | 5 | adapter |
| `israel-mental-health` | `@skills-il/israel-mental-health-mcp` | 5 | adapter |
| `israel-nature` | `@skills-il/israel-nature-mcp` | 5 | export |
| `israel-nutrition` | `@skills-il/israel-nutrition-mcp` | 5 | export |
| `israel-railways` | `@skills-il/israel-railways-mcp` | 3 | export |
| `israel-vehicles` | `@skills-il/israel-vehicles-mcp` | 5 | export |
| `kolzchut` | `@skills-il/kolzchut-mcp` | 6 | export |
| `openbus` | `@skills-il/openbus-mcp` | 7 | export |
| `supermarket-prices` | `@skills-il/supermarket-prices-mcp` | 7 | export |
| `tase` | `@skills-il/tase-mcp` | 36 | export |
| `tel-aviv-city` | `@skills-il/tel-aviv-city-mcp` | 5 | adapter |

See **[PROBE-RESULTS.md](./PROBE-RESULTS.md)** for which ones actually return
real data. Two carry caveats: `israel-mental-health` (4 of 5 tools dead at the
source) and `tase` (needs `TASE_API_KEY`).

---

## Endpoints

| method | path | behaviour |
| --- | --- | --- |
| `POST` | `/mcp/<slug>` | Streamable HTTP MCP endpoint, **stateless** |
| `GET` / `DELETE` | `/mcp/<slug>` | `405` — stateless mode has no server-initiated stream and no session to delete |
| `GET` | `/healthz` | mount status, per-slug tool counts, load failures, **per-host egress queue depth** |
| `GET` | `/` | endpoint index |

---

## Design

### Stateless

`sessionIdGenerator: undefined`, with a fresh `McpServer` + transport per
request. No session id is issued, so **the consuming backend needs no session
affinity** and the host scales horizontally for free.

If this is ever switched to stateful, the host **must** relay the
`mcp-session-id` response header back to the client. Omitting it one-sidedly
means every call after `initialize` fails with "Missing session ID" and the
server appears to have zero tools *with no error surfaced* — a genuinely
expensive failure to debug.

SSE framing is normal and expected: responses come back as `text/event-stream`.
What matters is that each per-request stream **closes** after the response
rather than being held open. Verified in PROBE-RESULTS.md.

### The governor is load-bearing, not an optimisation

**Six** of the mounted servers call `data.gov.il`. Every package ships its own
module-level `lastRequestTime` throttle — but those are per-package. Six
packages each politely throttling *in ignorance of the other five* still hit one
government host with six-plus concurrent requests, which is how you get banned.

A shared governor is only possible because this is one process. It queues by
**upstream hostname**, not by package, and is installed by patching
`globalThis.fetch` once at startup — the only interception point that reaches
all 17 packages without modifying any of them (all 17 use global `fetch`).

- **min-interval + max-concurrency per host**, conservative by default.
- **Bounded wait**: a request that cannot get a slot within
  `MCP_EGRESS_MAX_WAIT_MS` fails fast with an MCP error the model can narrate,
  rather than queueing behind a request whose caller already timed out.
- **Queue depth per host is exposed on `/healthz`**, so a persistently deep lane
  is a visible signal rather than a surprise ban.

Interaction with the packages' own throttles: they still run, inside their own
modules. They do not fight the governor — both are pure delays, and whichever is
stricter binds. The host lane is the one that actually protects the upstream,
because it is the only one that can see all six callers.

Verified under contention (`npm run load-check`): 18 concurrent calls across the
six data.gov.il servers, peak queue depth 17, **active never exceeded the cap of
2**.

Default limits (`src/governor.ts`), overridable per host:

| host | min interval | max concurrent | why |
| --- | --- | --- | --- |
| `data.gov.il` | 250ms | 2 | shared by 6 servers, no published limit |
| `eutils.ncbi.nlm.nih.gov` | 350ms | 1 | NCBI publishes 3 req/sec without an API key |
| `clinicaltrials.gov` | 200ms | 2 | docs ask for "reasonable" rates |
| `api.inaturalist.org` | 1000ms | 1 | published 60 req/min guidance |
| *(default)* | 100ms | 4 | |

### The 5 inline packages

12 packages expose a transport-agnostic `registerTools(server)` and are imported
straight from their published `dist`.

The other 5 register their tools **inline in `index.ts`**, which constructs an
`McpServer` and connects a `StdioServerTransport` at import time — importing
them directly would spawn a stdio server inside the HTTP host. Their adapters
are therefore **generated** from upstream source by
`scripts/generate-adapters.ts`, which lifts the registration block out and drops
the transport bootstrap.

The generated adapters are committed, and `npm run verify:adapters` (which runs
on every `npm run build`) re-generates them and **byte-compares**. Any change to
an upstream `index.ts` fails the build with a diff pointer instead of silently
shipping a server with the wrong — or zero — tools.

### Never ship a zero-tool server

`src/expected-tools.json` is a committed snapshot of all 124 tool names, derived
from the real servers. Two gates enforce it:

- **build time** — `verify:adapters` re-derives every slug's tool set and fails
  on drift or emptiness.
- **mount time** — `assertTools()` compares what actually registered against the
  snapshot on every request, and refuses to serve a slug that registered nothing
  or drifted.

Registration is observed through a counting proxy in `adapt()` rather than by
reading the SDK's private `_registeredTools`, so the check does not break across
SDK versions.

Regenerate after an intentional upstream tool change:

```bash
npx tsx scripts/generate-adapters.ts   # if an inline package changed
npm run snapshot:tools
```

### Cross-SDK-version handling

The packages depend on `@modelcontextprotocol/sdk` from `^1.6.1` to `^1.28.0`,
each vendoring its own copy, so their `registerTools` exports are typed against
*different* `McpServer` declarations than the one the host instantiates —
structurally compatible at runtime, nominally distinct to TypeScript. `adapt()`
in `src/adapt.ts` is the single place that absorbs this, and it verifies at
runtime that the host's server still exposes the registration methods the
packages call.

`tase-mcp` ships no type declarations; `types/tase-mcp.d.ts` is a local shim.
The package itself is untouched.

The generated adapters carry `@ts-nocheck`: they are a verbatim lift of code
that already typechecks inside its own package against its own SDK version, and
here `server` is intentionally `any`, which strips the contextual typing the
handler callbacks relied on. Re-deriving those types would mean re-implementing
the SDK generics per package. The safety net is behavioural instead — the byte
diff plus `assertTools()`.

### Failure isolation

- A package that fails to import is recorded at startup; its route returns `503`
  with the reason, and the host still boots with the other 16.
- A handler that throws returns a JSON-RPC error on that request only.
- `uncaughtException` / `unhandledRejection` are logged, not fatal, so one
  server cannot take down the other 16.

---

## Configuration

| env var | default | meaning |
| --- | --- | --- |
| `PORT` | `8080` | listen port |
| `HOST` | `0.0.0.0` | bind address |
| `MCP_ALLOWED_HOSTS` | `localhost:$PORT,127.0.0.1:$PORT` | **DNS-rebinding protection**: allowed `Host` headers, comma-separated. Set this to the hostnames the deployment is actually reached on. |
| `MCP_EGRESS_MAX_WAIT_MS` | `15000` | max time a request waits for an egress slot before failing fast |
| `MCP_EGRESS_LIMITS` | — | JSON overriding per-host limits, e.g. `{"data.gov.il":{"minIntervalMs":500,"maxConcurrency":1}}` |
| `MCP_BODY_LIMIT` | `4mb` | max JSON request body |
| `TASE_API_KEY` | — | required by `tase` only; without it every TASE tool errors |

---

## Scripts

| script | purpose |
| --- | --- |
| `npm run build` | verify adapters, then compile |
| `npm start` | run the host |
| `npm run probe` | end-to-end verification of every slug (list + real call) |
| `npm run load-check` | prove the shared egress governor holds under contention |
| `npm run verify:adapters` | build gate: adapter drift + tool-set drift |
| `npm run snapshot:tools` | regenerate `src/expected-tools.json` |
