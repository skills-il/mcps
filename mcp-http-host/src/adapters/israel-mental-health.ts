/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Generated from israel-mental-health-mcp/src/index.ts by scripts/generate-adapters.ts.
 * israel-mental-health-mcp registers its tools inline in index.ts, which connects a stdio
 * transport at import time and so cannot be imported by the HTTP host.
 *
 * Run `npm run verify:adapters` to fail the build if upstream drifts.
 *
 * ts-nocheck rationale: these statements are a verbatim lift of upstream code
 * that already typechecks inside israel-mental-health-mcp's own package, against israel-mental-health-mcp's own SDK
 * version. Here `server` is intentionally version-agnostic (`any`), which
 * strips the contextual typing the handler callbacks relied on. Re-deriving
 * those types would mean re-implementing the SDK's generics per package. The
 * real safety net is elsewhere and is behavioural, not structural: the byte
 * diff in verify:adapters catches upstream drift, and assertTools() catches a
 * wrong or empty tool set at mount time.
 */

/* eslint-disable */
// @ts-nocheck
import type { AnyMcpServer } from "../adapt.js";
import {
  TOOL_ANNOTATIONS,
  findClinicsSchema,
  findClinics,
  getClinicDetailsSchema,
  getClinicDetails,
  findByTherapySchema,
  findByTherapy,
  findBySpecializationSchema,
  findBySpecialization,
  getQualityMetricsSchema,
  getQualityMetrics,
} from "@skills-il/israel-mental-health-mcp/dist/tools.js";

export const TOOL_NAMES = [
  "find_clinics",
  "get_clinic_details",
  "find_by_therapy",
  "find_by_specialization",
  "get_quality_metrics"
] as const;

export function registerTools(server: AnyMcpServer): void {
  /**
   * Israel Mental Health MCP Server
   *
   * Provides access to Israeli Ministry of Health mental health data:
   * community clinics, psychiatric services, and quality metrics.
   *
   * Data source: data.gov.il (official government open data portal)
   */
  
  
  
  // --- Tool Registration ---
  
  server.tool(
    "find_clinics",
    "Search mental health clinics across Israel by city, HMO (kupat cholim), or target audience. " +
      "Returns clinic names, addresses, phone numbers, and wait times. " +
      "Data from the Israeli Ministry of Health via data.gov.il.",
    findClinicsSchema.shape,
    TOOL_ANNOTATIONS,
    async (params) => {
      try {
        const result = await findClinics(findClinicsSchema.parse(params));
        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
  
  server.tool(
    "get_clinic_details",
    "Get full details for a specific mental health clinic including all therapy types, " +
      "specializations, wait times, and ownership information. " +
      "Search by clinic name in Hebrew.",
    getClinicDetailsSchema.shape,
    TOOL_ANNOTATIONS,
    async (params) => {
      try {
        const result = await getClinicDetails(getClinicDetailsSchema.parse(params));
        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
  
  server.tool(
    "find_by_therapy",
    "Find mental health clinics offering a specific therapy type " +
      "(e.g. CBT, DBT, trauma therapy, psychodynamic). " +
      "Optionally filter by city.",
    findByTherapySchema.shape,
    TOOL_ANNOTATIONS,
    async (params) => {
      try {
        const result = await findByTherapy(findByTherapySchema.parse(params));
        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
  
  server.tool(
    "find_by_specialization",
    "Find mental health clinics specializing in a specific condition " +
      "(e.g. eating disorders, addictions, PTSD, anxiety, depression). " +
      "Optionally filter by city.",
    findBySpecializationSchema.shape,
    TOOL_ANNOTATIONS,
    async (params) => {
      try {
        const result = await findBySpecialization(
          findBySpecializationSchema.parse(params)
        );
        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
  
  server.tool(
    "get_quality_metrics",
    "Get quality measurement data for mental health services in Israel. " +
      "Available metrics: treatment_plan (documented plan within 5 days), " +
      "discharge_summary, community_appointment, long_term_plan, lipid_profile. " +
      "Data from Ministry of Health quality indicators.",
    getQualityMetricsSchema.shape,
    TOOL_ANNOTATIONS,
    async (params) => {
      try {
        const result = await getQualityMetrics(
          getQualityMetricsSchema.parse(params)
        );
        return { content: [{ type: "text" as const, text: result }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
  
  // --- Start Server ---
}
