/**
 * TASE Data Hub API Client
 *
 * Wraps the official TASE Data Hub API (https://datahubapi.tase.co.il) with
 * authentication, rate limiting, and error handling.
 *
 * Data requests go to the datawise.tase.co.il gateway. Your apikey header is
 * scoped to the specific products you've registered for in the developer portal.
 */

const BASE_URL = process.env.TASE_BASE_URL ?? "https://datawise.tase.co.il";

// TASE's published limit is 10 req / 2s. We cap at 5 req / 1s for a safety margin.
const MAX_REQUESTS = 5;
const WINDOW_MS = 1000;
const timestamps: number[] = [];

async function rateLimit(): Promise<void> {
  const now = Date.now();
  while (timestamps.length > 0 && timestamps[0]! <= now - WINDOW_MS) {
    timestamps.shift();
  }
  if (timestamps.length >= MAX_REQUESTS) {
    const oldest = timestamps[0]!;
    const waitMs = oldest + WINDOW_MS - now;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  timestamps.push(Date.now());
}

function getApiKey(): string {
  const key = process.env.TASE_API_KEY;
  if (!key) {
    throw new Error(
      "TASE_API_KEY not set. Sign in at https://datahubapi.tase.co.il, create an application, and copy its apikey."
    );
  }
  return key;
}

export interface TaseClientResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

async function get(
  path: string,
  params?: Record<string, string | number | undefined>,
  lang: string = "he-IL"
): Promise<TaseClientResponse> {
  await rateLimit();

  const apiKey = getApiKey();

  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
        "accept-language": lang,
        apikey: apiKey,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `Network error connecting to TASE API: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      error:
        "TASE API rate limit exceeded (max 10 requests per 2 seconds). Wait a moment and retry.",
    };
  }

  if (response.status === 401) {
    return {
      ok: false,
      error:
        "TASE API key is invalid or missing. Check TASE_API_KEY.",
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      error:
        `TASE API returned 403 for ${path}. Your apikey is not registered for this product, or the request was blocked by TASE's WAF. Subscribe to the product at https://datahubapi.tase.co.il and use an approved subscription.`,
    };
  }

  if (response.status === 500 || response.status === 503) {
    return {
      ok: false,
      error:
        "TASE API is currently unavailable. Trading hours: Sunday-Thursday 9:30-17:00 Israel time.",
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      error: `TASE API returned HTTP ${response.status}: ${body || response.statusText}`,
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

export const taseClient = { get };
