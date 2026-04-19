/**
 * TASE MCP Tools
 *
 * All endpoint paths below are verified against the TASE Data Hub OpenAPI
 * specs and returned HTTP 200 with a valid apikey scoped to the product.
 *
 * Product subscription model: each apikey is registered (via the developer
 * portal) against one or more products. An endpoint will return 403 if the
 * apikey is not registered for the owning product.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { taseClient, type TaseClientResponse } from "./client.js";

const langSchema = z
  .enum(["he-IL", "en-US"])
  .optional()
  .default("he-IL")
  .describe("Response language: he-IL (Hebrew, default) or en-US (English)");

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Date in YYYY-MM-DD format");

const yearSchema = z.number().int().min(2000).max(2100).describe("Year, e.g. 2026");
const monthSchema = z.number().int().min(1).max(12).describe("Month 1-12");
const daySchema = z.number().int().min(1).max(31).describe("Day of month 1-31");

function formatResult(result: TaseClientResponse): {
  content: { type: "text"; text: string }[];
  isError?: boolean;
} {
  if (!result.ok) {
    return {
      content: [{ type: "text" as const, text: result.error! }],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
}

const toolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

export function registerTools(server: McpServer): void {
  // ─── Product: Securities - Basic ─────────────────────────────────────────

  server.registerTool(
    "tase_list_companies",
    {
      title: "List TASE-listed Companies",
      description:
        "List all companies with securities traded on the Tel Aviv Stock Exchange. Returns issuer IDs, company names, sectors, corporate IDs, and dual-listing flags.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/basic-securities/companies-list", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_traded_securities",
    {
      title: "List Traded Securities for a Date",
      description:
        "List securities that traded on a specific date on TASE. Returns security IDs, classifications, and corresponding companies.",
      inputSchema: { year: yearSchema, month: monthSchema, day: daySchema, lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ year, month, day, lang }) => {
      const r = await taseClient.get(
        `/v1/basic-securities/trade-securities-list/${year}/${month}/${day}`,
        undefined,
        lang
      );
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_delisted_securities",
    {
      title: "List Delisted Securities for a Month",
      description:
        "List securities that were delisted from TASE in a given year/month.",
      inputSchema: { year: yearSchema, month: monthSchema, lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ year, month, lang }) => {
      const r = await taseClient.get(
        `/v1/basic-securities/delisted-securities-list/${year}/${month}`,
        undefined,
        lang
      );
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_illiquid_maintenance_suspension",
    {
      title: "List Illiquid, Maintenance and Suspended Securities",
      description:
        "List securities currently under illiquid trading, maintenance, or suspension on TASE.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get(
        "/v1/basic-securities/illiquid-maintenance-suspension-list",
        undefined,
        lang
      );
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_trading_codes",
    {
      title: "List Trading Codes",
      description:
        "List all TASE trading codes (three-letter symbols used on the trading floor).",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/basic-securities/trading-code-list", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_security_types",
    {
      title: "List Security Types",
      description:
        "List TASE security type classifications (stock, corporate bond, government bond, ETF, structured product, etc.).",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/basic-securities/securities-types", undefined, lang);
      return formatResult(r);
    }
  );

  // ─── Product: Indices - Basic (v2) ───────────────────────────────────────

  server.registerTool(
    "tase_list_indices",
    {
      title: "List TASE Indices",
      description:
        "List all indices calculated by TASE (TA-35, TA-125, TA-90, sector and thematic indices). Returns index IDs, names, and ISINs.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/api/v2/basic-indices/indices-list", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_index_universes",
    {
      title: "List TASE Index Universes",
      description:
        "List TASE index universes (the classification buckets used to group indices, e.g., by asset class or sector).",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/api/v2/basic-indices/universes-list", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_get_index_components",
    {
      title: "Get Index Components for a Date",
      description:
        "Get the constituents and weights of a TASE index on a specific trade date. Use tase_list_indices to look up IndexId.",
      inputSchema: {
        indexId: z.number().int().describe("Numeric TASE index ID (see tase_list_indices)"),
        tradeDate: dateSchema,
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ indexId, tradeDate, lang }) => {
      const r = await taseClient.get(
        "/api/v2/basic-indices/index-components-basic",
        { IndexId: indexId, TradeDate: tradeDate },
        lang
      );
      return formatResult(r);
    }
  );

  // ─── Product: TASE indices Online ────────────────────────────────────────

  server.registerTool(
    "tase_get_index_last_rate",
    {
      title: "Get TASE Index Last Rate",
      description:
        "Get the most recent (live, during trading hours) rate for a TASE index. Omit indexId to get all indices.",
      inputSchema: {
        indexId: z.number().int().optional().describe("Numeric TASE index ID; omit for all indices"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ indexId, lang }) => {
      const r = await taseClient.get(
        "/v1/tase-indices-online-data/last-rate",
        { indexId },
        lang
      );
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_get_index_intraday",
    {
      title: "Get TASE Index Intraday Rates",
      description:
        "Get intraday rate history for a TASE index. Only returns data during trading hours (Sun-Thu 9:30-17:00 Israel time).",
      inputSchema: {
        indexId: z.number().int().optional().describe("Numeric TASE index ID; omit for all indices"),
        startTime: z.string().optional().describe("Start time, ISO 8601"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ indexId, startTime, lang }) => {
      const r = await taseClient.get(
        "/v1/tase-indices-online-data/intraday",
        { indexId, startTime },
        lang
      );
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_index_trading_rate_types",
    {
      title: "List Index Trading Rate Types",
      description:
        "List the rate type codes used by TASE online index data (e.g., open, last, close).",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get(
        "/v1/tase-indices-online-data/index-trading-rate-types",
        undefined,
        lang
      );
      return formatResult(r);
    }
  );

  // ─── Product: Derivatives Data - Basic ───────────────────────────────────

  server.registerTool(
    "tase_list_traded_derivatives",
    {
      title: "List Traded Derivatives for a Date",
      description:
        "List derivatives that traded on TASE on a given date. Optionally filter by derivative type, underlying asset, or underlying asset type.",
      inputSchema: {
        tradeDate: dateSchema,
        derivativeTypeCode: z.number().int().optional().describe("Filter by derivative type code"),
        underlyingAssetCode: z.number().int().optional().describe("Filter by underlying asset code"),
        underlyingAssetTypeCode: z.number().int().optional().describe("Filter by underlying asset type code"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ tradeDate, derivativeTypeCode, underlyingAssetCode, underlyingAssetTypeCode, lang }) => {
      const r = await taseClient.get(
        "/v1/derivatives/traded-list",
        { tradeDate, derivativeTypeCode, underlyingAssetCode, underlyingAssetTypeCode },
        lang
      );
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_derivative_types",
    {
      title: "List Derivative Types",
      description:
        "List derivative type classifications on TASE (call, put, future, etc.).",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/derivatives/types", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_derivative_underlying_assets",
    {
      title: "List Derivative Underlying Assets",
      description:
        "List underlying assets for TASE derivatives.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/derivatives/underlying-assets", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_derivative_underlying_asset_types",
    {
      title: "List Derivative Underlying Asset Types",
      description:
        "List underlying asset type classifications (index, stock, currency, etc.) for TASE derivatives.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/derivatives/underlying-asset-types", undefined, lang);
      return formatResult(r);
    }
  );

  // ─── Product: Mutual Funds - Basic ───────────────────────────────────────

  server.registerTool(
    "tase_list_funds",
    {
      title: "List Mutual Funds",
      description:
        "List mutual funds registered on TASE. Optionally filter by listing status.",
      inputSchema: {
        listingStatusId: z.number().int().optional().describe("Filter by listing status (see tase_list_fund_listing_statuses)"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ listingStatusId, lang }) => {
      const r = await taseClient.get("/v1/fund/fund-list", { listingStatusId }, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_types",
    {
      title: "List Fund Types",
      description: "List fund type classifications used by TASE.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/fund-type", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_listing_statuses",
    {
      title: "List Fund Listing Statuses",
      description: "List the listing status codes used for TASE mutual funds.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/listing-status", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_mutual_fund_classifications",
    {
      title: "List Mutual Fund Classifications",
      description: "List the mutual-fund classification codes used by TASE.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/mutual-fund-classification", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_tracking_classifications",
    {
      title: "List Tracking Fund Classifications",
      description: "List the tracking-fund (index-tracking) classification codes used by TASE.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/tracking-fund-classification", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_tax_statuses",
    {
      title: "List Fund Tax Statuses",
      description: "List tax status codes applicable to TASE funds.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/tax-status", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_payment_policies",
    {
      title: "List Fund Payment Policies",
      description: "List fund payment/distribution policy codes used by TASE.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/payment-policy", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_distribution_commissions",
    {
      title: "List Fund Distribution Commissions",
      description: "List distribution commission codes used for TASE funds.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/distribution-commission", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_stock_exchanges",
    {
      title: "List Fund Stock Exchanges",
      description: "List stock exchanges referenced by TASE fund data.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/stock-exchange", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_currency_exposure_profiles",
    {
      title: "List Fund Currency Exposure Profiles",
      description: "List currency-exposure profile codes used for TASE funds.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/currency-exposure-profile", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_share_exposure_profiles",
    {
      title: "List Fund Share Exposure Profiles",
      description: "List share-exposure profile codes used for TASE funds.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/share-exposure-profile", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_fund_underlying_assets",
    {
      title: "List Fund Underlying Assets",
      description: "List underlying assets referenced by TASE fund data.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/fund/underlying-asset", undefined, lang);
      return formatResult(r);
    }
  );

  // ─── Product: Lending Pool Online ────────────────────────────────────────

  server.registerTool(
    "tase_get_lending_pool_book_offers",
    {
      title: "Get Lending Pool Book Offers (Online)",
      description:
        "Get live book offers from the TASE lending pool. Returns active lending offers. Requires trading hours.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/lending-pool-online-data/book-offers", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_get_lending_pool_deals",
    {
      title: "Get Lending Pool Deals (Online)",
      description:
        "Get recent lending-pool deals. Optionally filter by security. Requires trading hours.",
      inputSchema: {
        securityId: z.number().int().optional().describe("Filter by TASE security ID"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ securityId, lang }) => {
      const r = await taseClient.get("/v1/lending-pool-online-data/deals", { securityId }, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_lending_pool_types",
    {
      title: "List Lending Pool Type Codes",
      description: "List the type codes used by TASE lending pool online data.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/lending-pool-online-data/types", undefined, lang);
      return formatResult(r);
    }
  );

  // ─── Product: OTC Transactions Online ────────────────────────────────────

  server.registerTool(
    "tase_get_otc_transactions",
    {
      title: "Get OTC Transactions (Online)",
      description:
        "Get live off-exchange (OTC) transactions reported to TASE. Optionally filter by security and time window.",
      inputSchema: {
        securityId: z.number().int().optional().describe("Filter by TASE security ID"),
        fromTime: z.string().optional().describe("ISO 8601 start time"),
        toTime: z.string().optional().describe("ISO 8601 end time"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ securityId, fromTime, toTime, lang }) => {
      const r = await taseClient.get(
        "/v1/transactions/otc-transactions-online",
        { securityId, fromTime, toTime },
        lang
      );
      return formatResult(r);
    }
  );

  // ─── Product: Public Offerings Online ────────────────────────────────────

  server.registerTool(
    "tase_list_upcoming_offerings",
    {
      title: "List Upcoming Public Offerings",
      description:
        "List upcoming public offerings (IPOs, secondary offerings) scheduled on TASE.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/tase-offering/upcoming", undefined, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_open_offerings",
    {
      title: "List Open Public Offerings",
      description:
        "List currently open public offerings on TASE (subscriptions active).",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/tase-offering/open", undefined, lang);
      return formatResult(r);
    }
  );

  // ─── Product: TASE Trading & Vacation Schedules ──────────────────────────

  server.registerTool(
    "tase_get_trading_schedule",
    {
      title: "Get TASE Trading & Vacation Schedule",
      description:
        "Get TASE's trading and vacation schedule. Optionally filter by day type and date range.",
      inputSchema: {
        dayTypeId: z.string().optional().describe("Filter by day type ID (see tase_list_trading_day_types)"),
        fromDate: z.string().optional().describe("Start date YYYY-MM-DD"),
        toDate: z.string().optional().describe("End date YYYY-MM-DD"),
        lang: langSchema,
      },
      annotations: toolAnnotations,
    },
    async ({ dayTypeId, fromDate, toDate, lang }) => {
      const r = await taseClient.get("/v1/tase-schedules", { dayTypeId, fromDate, toDate }, lang);
      return formatResult(r);
    }
  );

  server.registerTool(
    "tase_list_trading_day_types",
    {
      title: "List TASE Trading Day Types",
      description:
        "List the day-type classifications used in the TASE trading & vacation schedule.",
      inputSchema: { lang: langSchema },
      annotations: toolAnnotations,
    },
    async ({ lang }) => {
      const r = await taseClient.get("/v1/tase-schedules/day-types", undefined, lang);
      return formatResult(r);
    }
  );
}
