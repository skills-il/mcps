/**
 * Global egress governor.
 *
 * Six of the mounted servers call data.gov.il. Each package ships its own
 * module-level `lastRequestTime` throttle, but those are per-package: six
 * packages throttling in ignorance of each other still hammer one upstream
 * concurrently, which is how you get banned by a government site.
 *
 * This governor queues by UPSTREAM HOSTNAME (not by package), so all six
 * data.gov.il callers share one lane. It is installed by monkey-patching
 * `globalThis.fetch` once, in the host process, which is the only interception
 * point that works without modifying any published package (all 17 use global
 * fetch).
 *
 * The per-package throttles still run inside their own modules. They do not
 * fight this governor: both are pure delays, and the host lane is the binding
 * constraint whenever it is stricter. See README "Governor".
 *
 * Waits are BOUNDED. A request that cannot get a slot within `maxWaitMs` fails
 * fast with a descriptive error rather than queueing behind work whose caller
 * has already timed out.
 */

export interface LaneLimits {
  /** Minimum milliseconds between two request STARTS on this host. */
  minIntervalMs: number;
  /** Maximum number of in-flight requests to this host. */
  maxConcurrency: number;
}

export interface LaneStats {
  host: string;
  active: number;
  queueDepth: number;
  limits: LaneLimits;
  /** Total requests admitted since boot. */
  admitted: number;
  /** Total requests rejected for exceeding maxWaitMs. */
  timedOut: number;
}

/**
 * Conservative per-host limits.
 *
 * - data.gov.il: shared by 6 servers, no published limit -> deliberately tight.
 * - eutils.ncbi.nlm.nih.gov: NCBI publishes 3 req/sec without an API key.
 *   350ms + concurrency 1 keeps us under it.
 * - clinicaltrials.gov: no hard published number; their docs ask for
 *   "reasonable" rates.
 * - Everything else falls back to DEFAULT_LIMITS.
 */
export const DEFAULT_LIMITS: LaneLimits = { minIntervalMs: 100, maxConcurrency: 4 };

export const HOST_LIMITS: Record<string, LaneLimits> = {
  'data.gov.il': { minIntervalMs: 250, maxConcurrency: 2 },
  'eutils.ncbi.nlm.nih.gov': { minIntervalMs: 350, maxConcurrency: 1 },
  'clinicaltrials.gov': { minIntervalMs: 200, maxConcurrency: 2 },
  'www.kolzchut.org.il': { minIntervalMs: 200, maxConcurrency: 2 },
  'rail-api.rail.co.il': { minIntervalMs: 200, maxConcurrency: 2 },
  'prices.shufersal.co.il': { minIntervalMs: 250, maxConcurrency: 2 },
  'gisn.tel-aviv.gov.il': { minIntervalMs: 200, maxConcurrency: 2 },
  'edge.boi.gov.il': { minIntervalMs: 200, maxConcurrency: 2 },
  'open-bus-stride-api.hasadna.org.il': { minIntervalMs: 150, maxConcurrency: 3 },
  'israelhiking.osm.org.il': { minIntervalMs: 150, maxConcurrency: 3 },
  'api.inaturalist.org': { minIntervalMs: 1000, maxConcurrency: 1 },
  'api.gbif.org': { minIntervalMs: 150, maxConcurrency: 3 },
  'datahubapi.tase.co.il': { minIntervalMs: 200, maxConcurrency: 2 },
  'datawise.tase.co.il': { minIntervalMs: 200, maxConcurrency: 2 },
};

export class EgressQueueTimeoutError extends Error {
  constructor(
    public readonly host: string,
    public readonly waitedMs: number,
    public readonly queueDepth: number,
  ) {
    super(
      `Upstream ${host} is saturated: waited ${waitedMs}ms for an egress slot ` +
        `(queue depth ${queueDepth}). The request was not sent. This protects ` +
        `${host} from concurrent hammering by the other mounted servers; retry shortly.`,
    );
    this.name = 'EgressQueueTimeoutError';
  }
}

interface Waiter {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

class Lane {
  private active = 0;
  private lastStartedAt = 0;
  private waiters: Waiter[] = [];
  private pumpScheduled = false;
  private admitted = 0;
  private timedOut = 0;

  constructor(
    readonly host: string,
    readonly limits: LaneLimits,
  ) {}

  stats(): LaneStats {
    return {
      host: this.host,
      active: this.active,
      queueDepth: this.waiters.length,
      limits: this.limits,
      admitted: this.admitted,
      timedOut: this.timedOut,
    };
  }

  acquire(maxWaitMs: number): Promise<() => void> {
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx >= 0) this.waiters.splice(idx, 1);
          this.timedOut++;
          reject(new EgressQueueTimeoutError(this.host, maxWaitMs, this.waiters.length));
        }, maxWaitMs),
      };
      this.waiters.push(waiter);
      this.pump();
    });
  }

  private pump(): void {
    while (this.waiters.length > 0 && this.active < this.limits.maxConcurrency) {
      const waitFor = this.lastStartedAt + this.limits.minIntervalMs - Date.now();
      if (waitFor > 0) {
        if (!this.pumpScheduled) {
          this.pumpScheduled = true;
          setTimeout(() => {
            this.pumpScheduled = false;
            this.pump();
          }, waitFor).unref?.();
        }
        return;
      }

      const waiter = this.waiters.shift()!;
      clearTimeout(waiter.timer);
      this.active++;
      this.admitted++;
      this.lastStartedAt = Date.now();

      let released = false;
      waiter.resolve(() => {
        if (released) return;
        released = true;
        this.active--;
        this.pump();
      });
    }
  }
}

export class EgressGovernor {
  private lanes = new Map<string, Lane>();

  constructor(
    private readonly hostLimits: Record<string, LaneLimits> = HOST_LIMITS,
    private readonly defaults: LaneLimits = DEFAULT_LIMITS,
    readonly maxWaitMs: number = 15_000,
  ) {}

  private laneFor(host: string): Lane {
    let lane = this.lanes.get(host);
    if (!lane) {
      lane = new Lane(host, this.hostLimits[host] ?? this.defaults);
      this.lanes.set(host, lane);
    }
    return lane;
  }

  /** Snapshot of every lane, for /healthz. A persistently deep lane is a signal. */
  stats(): LaneStats[] {
    return [...this.lanes.values()].map((l) => l.stats()).sort((a, b) => b.queueDepth - a.queueDepth);
  }

  async run<T>(host: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.laneFor(host).acquire(this.maxWaitMs);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

function urlOf(input: Parameters<typeof fetch>[0]): URL | null {
  try {
    if (typeof input === 'string') return new URL(input);
    if (input instanceof URL) return input;
    if (typeof (input as Request).url === 'string') return new URL((input as Request).url);
  } catch {
    /* not an absolute URL - let the original fetch produce the real error */
  }
  return null;
}

let installed = false;

/**
 * Patch globalThis.fetch so every outbound HTTP call from any mounted server
 * passes through its host's lane. Idempotent.
 */
export function installEgressGovernor(governor: EgressGovernor): EgressGovernor {
  if (installed) return governor;
  installed = true;

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function governedFetch(
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ): Promise<Response> {
    const url = urlOf(input);
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      return originalFetch(input, init);
    }
    return governor.run(url.hostname, () => originalFetch(input, init));
  } as typeof fetch;

  return governor;
}

/** Parse MCP_EGRESS_LIMITS='{"data.gov.il":{"minIntervalMs":500,"maxConcurrency":1}}'. */
export function limitsFromEnv(raw: string | undefined): Record<string, LaneLimits> {
  if (!raw) return HOST_LIMITS;
  try {
    const parsed = JSON.parse(raw) as Record<string, LaneLimits>;
    return { ...HOST_LIMITS, ...parsed };
  } catch (err) {
    throw new Error(`MCP_EGRESS_LIMITS is not valid JSON: ${(err as Error).message}`);
  }
}
