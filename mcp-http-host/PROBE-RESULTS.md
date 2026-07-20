# Probe results

Every mounted slug probed over real HTTP against the **Docker image**
(`skills-il-mcp-http-host`, container on `:8090`), using the MCP SDK's own
`Client` + `StreamableHTTPClientTransport` — the same client stack a real
consumer runs, so SSE framing and any session header are handled natively
rather than by a hand-rolled parser that could produce false negatives.

Two independent gates per slug:

1. **`tools/list` OK** — the tool set matches the committed stdio snapshot
   (`src/expected-tools.json`) exactly, by name.
2. **live `tools/call` OK** — a real call against the real upstream returned
   real data. A response that is an MCP error, empty, or a sub-20-character
   shell is a **FAIL**. Listing tools is not evidence that a server works.

Reproduce: `PROBE_BASE=http://localhost:8080 npm run probe`

| slug | tools/list OK | live tools/call OK | notes |
| --- | --- | --- | --- |
| `ben-gurion-flights` | yes (5) | yes | `get_airport_summary`: 2011 chars |
| `boi-exchange` | yes (5) | yes | `get_exchange_rate` USD: 95 chars, contains USD+ILS |
| `israel-amutot` | yes (11) | yes | `search_amuta` "חינוך": 874 chars |
| `israel-clinical-trials` | yes (5) | yes | `list_recruiting_trials` diabetes: 1303 chars, contains NCT ids |
| `israel-elections` | yes (4) | yes | `search_settlements` "תל אביב": 231 chars |
| `israel-hiking` | yes (5) | yes | `search_pois` "מצדה": 3135 chars |
| `israel-medical-research` | yes (5) | yes | `search_papers` cancer/Technion: 1879 chars |
| `israel-mental-health` | yes (5) | yes (1 of 5 tools) | `get_quality_metrics`: 38813 chars. **4 of its 5 tools are dead upstream** — see below |
| `israel-nature` | yes (5) | yes | `search_species` Gazella: 866 chars, contains Gazella |
| `israel-nutrition` | yes (5) | yes | `search_foods` "חומוס": 470 chars |
| `israel-railways` | yes (3) | yes | `list_stations`: 6688 chars |
| `israel-vehicles` | yes (5) | yes | `list_manufacturers`: 1746 chars |
| `kolzchut` | yes (6) | yes | `kolzchut_search_rights` "דמי אבטלה": 1099 chars |
| `openbus` | yes (7) | yes | `list_agencies`: 241 chars |
| `supermarket-prices` | yes (7) | yes | `list_chains`: 6289 chars |
| `tase` | yes (36) | **NO** | `tase_list_indices`: `TASE_API_KEY not set`. **Credential-blocked, not broken** — see below |
| `tel-aviv-city` | yes (5) | yes | `get_bike_stations` @ Rothschild: 1050 chars |

**16 / 17 slugs verified end to end.** All 17 pass `tools/list`; 124 tools
mounted in total.

---

## Not papered over

### `israel-mental-health` — 4 of 5 tools are dead at the source

`find_clinics`, `get_clinic_details`, `find_by_therapy`, and
`find_by_specialization` all read one data.gov.il resource:

```
f7a7b061-db5b-4e19-b1bf-2d7525af52ca   (mental health clinic directory)
```

Public read permission on that resource has been **revoked upstream**. This is
reproducible with plain `curl`, entirely outside this host:

```
$ curl -H 'Accept: application/json' -H 'User-Agent: Mozilla/5.0' \
    'https://data.gov.il/api/3/action/datastore_search?resource_id=f7a7b061-db5b-4e19-b1bf-2d7525af52ca&limit=2'
{"error": {"__type": "Authorization Error",
           "message": "גישה נדחתה: למשתמש אין הרשאה לקרוא..."}}
```

The other five resource ids that same package uses (the quality-metric
datasets) still return 200 with records, which is why `get_quality_metrics`
works and returns 38 KB of real data. So the slug is genuinely reachable and
genuinely serving data — but **4/5 of its surface is broken and will stay
broken until the dataset is re-published or the package is repointed.**

Not a host bug, and per scope not fixed here. Fixing it means finding the
current resource id and updating `israel-mental-health-mcp/src/client.ts`.

### `tase` — blocked on a credential, transport verified

`tase-mcp` requires a `TASE_API_KEY` (register an application at
<https://datahubapi.tase.co.il>). Without it every tool returns a clean,
explicit error rather than bad data.

What **is** verified: the slug mounts, `initialize` succeeds, and `tools/list`
returns all 36 tools matching the stdio set. What is **not** verified: that any
TASE tool returns real data over HTTP. That is untested, not passing — do not
read the `tools/list` column as proof the server works.

To close this out, re-run with the key present:

```bash
TASE_API_KEY=... node mcp-http-host/dist/index.js
npm run probe tase
```

---

## Also verified

**Stateless, with no session for consumers to track.** A raw `initialize`
returns **no** `mcp-session-id` header, is SSE-framed (`content-type:
text/event-stream`), and the per-request stream **closes** rather than hanging
the caller:

```
$ curl -D - -H 'Accept: application/json, text/event-stream' -d '{...initialize...}' \
    http://localhost:8080/mcp/boi-exchange
HTTP/1.1 200 OK
content-type: text/event-stream
              <- no mcp-session-id
event: message
data: {"result":{"protocolVersion":"2025-06-18",...}}
```

**The shared egress governor holds under contention** (`npm run load-check`):
18 concurrent tool calls fanned across the six servers that all use
`data.gov.il`.

```
completed 18/18 in 5027ms
data.gov.il lane: maxConcurrency=2, peak active=2, peak queueDepth=17
PASS: shared data.gov.il lane held its concurrency cap under contention.
```

Peak queue depth of 17 means the lane was genuinely contended, and active never
exceeded 2. Six independently-throttled packages would each have believed they
were making one request at a time while collectively hitting data.gov.il with
six or more concurrently — which is the ban risk this design exists to remove.

**Container parity.** The numbers above come from the built image, not a local
`tsx` run: `/healthz` reports `status: ok, mounted: 17, failed: 0, total tools:
124`.
