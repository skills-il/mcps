/**
 * API client for data.gov.il CKAN datastore.
 * Handles requests to the Ministry of Health mental health datasets.
 */

const BASE_URL = "https://data.gov.il/api/3/action/datastore_search";

// Resource IDs
export const RESOURCE_IDS = {
  /** Mental health clinics - main directory */
  clinics: "f7a7b061-db5b-4e19-b1bf-2d7525af52ca",

  /** Quality metrics */
  quality: {
    /** Documented treatment plan within 5 days */
    treatment_plan: "3c678810-8079-457a-a923-67b7e7661cae",
    /** Detailed discharge summary */
    discharge_summary: "eb5c186c-d062-4a2c-9fbb-98f72c7de4bb",
    /** Community appointment for discharged patients */
    community_appointment: "e8adbc37-713a-4f36-8242-28e23032f43b",
    /** Treatment plan in long-term hospitalization */
    long_term_plan: "333b85b0-4fea-4398-b3da-32610e97646e",
    /** Lipid profile measurement */
    lipid_profile: "cbb4cc45-ddd0-44ba-8af2-c40232d8c48d",
  },
} as const;

export type QualityMetric = keyof typeof RESOURCE_IDS.quality;

/**
 * Thrown when a data.gov.il resource returns an authorization failure.
 *
 * The community mental-health-clinics directory (RESOURCE_IDS.clinics, package
 * "mentalhealthclinics") was WITHDRAWN by the Ministry of Health: as of 2026
 * both the resource and its whole package return HTTP 403 "גישה נדחתה" /
 * Authorization Error. Its waiting-time data was current only as of Jan-Feb
 * 2018, so it was stale. The five quality-metric resources remain public, so
 * get_quality_metrics is unaffected.
 *
 * Rather than surface a cryptic "403 Forbidden" that reads like a transient
 * outage or a host bug, the four clinic-lookup tools catch this and explain
 * the withdrawal, pointing to the current official list. If the Ministry ever
 * re-publishes the dataset, the same code path recovers automatically.
 */
export class ResourceUnavailableError extends Error {
  constructor(
    public readonly resource_id: string,
    message: string,
  ) {
    super(message);
    this.name = "ResourceUnavailableError";
  }
}

/** Bilingual, actionable message for the withdrawn clinics directory. */
export const CLINICS_WITHDRAWN_MESSAGE =
  "מאגר מרפאות בריאות הנפש בקהילה של משרד הבריאות הוסר מ-data.gov.il ואינו נגיש יותר " +
  "(הנתונים שהכיל שיקפו זמני המתנה נכון לינואר-פברואר 2018). " +
  "רשימת המרפאות המעודכנת נמצאת באתר משרד הבריאות (gov.il) בחיפוש \"רשימת מרפאות בריאות הנפש בקהילה\", " +
  "בכתובת https://www.gov.il/he/pages/mental-clinics . " +
  "מדדי האיכות של שירותי בריאות הנפש עדיין זמינים דרך הכלי get_quality_metrics.\n" +
  "The Ministry of Health withdrew the community mental-health-clinics directory from " +
  "data.gov.il, so clinic lookups are no longer available (its data reflected wait times " +
  "as of Jan-Feb 2018). Find the current list on the Ministry of Health site (gov.il) by " +
  "searching \"רשימת מרפאות בריאות הנפש בקהילה\" (currently " +
  "https://www.gov.il/he/pages/mental-clinics ). Quality metrics are still available via " +
  "the get_quality_metrics tool.";

export const QUALITY_METRIC_LABELS: Record<QualityMetric, string> = {
  treatment_plan: "תוכנית טיפול מתועדת תוך 5 ימים",
  discharge_summary: "סיכום שחרור מפורט",
  community_appointment: "תור קהילתי למשתחררים",
  long_term_plan: "תוכנית טיפול באשפוז ממושך",
  lipid_profile: "בדיקת פרופיל שומנים",
};

// Rate limiting: max 10 requests per second
let lastRequestTime = 0;
const MIN_INTERVAL_MS = 100; // 10 req/s = 100ms between requests

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(30_000) });
}

export interface CKANResponse {
  success: boolean;
  result: {
    records: Record<string, unknown>[];
    total: number;
    fields: { id: string; type: string }[];
  };
}

export interface DatastoreSearchParams {
  resource_id: string;
  filters?: Record<string, string>;
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * Query the CKAN datastore_search endpoint.
 */
export async function datastoreSearch(
  params: DatastoreSearchParams
): Promise<CKANResponse> {
  const url = new URL(BASE_URL);
  url.searchParams.set("resource_id", params.resource_id);

  if (params.filters && Object.keys(params.filters).length > 0) {
    url.searchParams.set("filters", JSON.stringify(params.filters));
  }
  if (params.q) {
    url.searchParams.set("q", params.q);
  }
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    url.searchParams.set("offset", String(params.offset));
  }

  const response = await rateLimitedFetch(url.toString());

  // A 403/401 means data.gov.il revoked public read on this resource. For the
  // withdrawn clinics directory, explain it; for anything else, still make the
  // withdrawal explicit rather than a bare status line.
  if (response.status === 403 || response.status === 401) {
    if (params.resource_id === RESOURCE_IDS.clinics) {
      throw new ResourceUnavailableError(params.resource_id, CLINICS_WITHDRAWN_MESSAGE);
    }
    throw new ResourceUnavailableError(
      params.resource_id,
      `data.gov.il resource ${params.resource_id} is no longer publicly accessible ` +
        `(HTTP ${response.status}). The dataset may have been withdrawn or restricted.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `data.gov.il API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as CKANResponse;

  if (!data.success) {
    throw new Error("data.gov.il API returned success=false");
  }

  return data;
}
