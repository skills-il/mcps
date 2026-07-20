/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Generated from israel-medical-research-mcp/src/index.ts by scripts/generate-adapters.ts.
 * israel-medical-research-mcp registers its tools inline in index.ts, which connects a stdio
 * transport at import time and so cannot be imported by the HTTP host.
 *
 * Run `npm run verify:adapters` to fail the build if upstream drifts.
 *
 * ts-nocheck rationale: these statements are a verbatim lift of upstream code
 * that already typechecks inside israel-medical-research-mcp's own package, against israel-medical-research-mcp's own SDK
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
  searchPapers,
  searchPapersSchema,
  getPaperDetails,
  getPaperDetailsSchema,
  searchByInstitution,
  searchByInstitutionSchema,
  getRecentPapers,
  getRecentPapersSchema,
  countPapers,
  countPapersSchema,
} from "@skills-il/israel-medical-research-mcp/dist/tools.js";

export const TOOL_NAMES = [
  "search_papers",
  "get_paper_details",
  "search_by_institution",
  "get_recent_papers",
  "count_papers"
] as const;

export function registerTools(server: AnyMcpServer): void {
  server.tool(
    "search_papers",
    "Search medical papers from Israeli institutions on PubMed. Returns titles, authors, journals, and PMIDs.",
    searchPapersSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => searchPapers(searchPapersSchema.parse(args))
  );
  
  server.tool(
    "get_paper_details",
    "Get detailed information about a specific paper by its PubMed ID (PMID). Returns title, authors, journal, publication date, DOI, and PubMed URL.",
    getPaperDetailsSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => getPaperDetails(getPaperDetailsSchema.parse(args))
  );
  
  server.tool(
    "search_by_institution",
    "Search papers from a specific Israeli research institution. Supports institutions like Hadassah, Sheba, Weizmann, Technion, Tel Aviv University, Hebrew University, etc.",
    searchByInstitutionSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => searchByInstitution(searchByInstitutionSchema.parse(args))
  );
  
  server.tool(
    "get_recent_papers",
    "Get the most recent medical papers from Israeli institutions. Filter by topic and date range.",
    getRecentPapersSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => getRecentPapers(getRecentPapersSchema.parse(args))
  );
  
  server.tool(
    "count_papers",
    "Count the total number of papers matching search criteria from Israeli institutions on PubMed.",
    countPapersSchema.shape,
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async (args) => countPapers(countPapersSchema.parse(args))
  );
}
