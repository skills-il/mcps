# Skills-IL MCP Servers

A collection of MCP (Model Context Protocol) servers for Israeli data sources and APIs, maintained by the [skills-il](https://github.com/skills-il) organization.

Browse all MCPs at [agentskills.co.il/mcp](https://agentskills.co.il/he/mcp).

## Install any MCP

All MCPs are published to npm under the `@skills-il` scope and can be installed with one command:

```bash
npx -y @skills-il/<mcp-name>
```

For Claude Desktop, add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "israel-hiking": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-hiking-mcp"]
    }
  }
}
```

## Available MCPs

| MCP | npm | Description | API | Auth |
|-----|-----|-------------|-----|------|
| [ben-gurion-flights-mcp](./ben-gurion-flights-mcp) | [`@skills-il/ben-gurion-flights-mcp`](https://www.npmjs.com/package/@skills-il/ben-gurion-flights-mcp) | Real-time Ben Gurion Airport flight arrivals and departures | [data.gov.il flydata](https://data.gov.il/dataset/flydata) | None |
| [boi-exchange-mcp](./boi-exchange-mcp) | [`@skills-il/boi-exchange-mcp`](https://www.npmjs.com/package/@skills-il/boi-exchange-mcp) | Bank of Israel official exchange rates (sha'ar yatzig) for 30+ currencies | [BOI SDMX API](https://edge.boi.gov.il/) | None |
| [israel-amutot-mcp](./israel-amutot-mcp) | [`@skills-il/israel-amutot-mcp`](https://www.npmjs.com/package/@skills-il/israel-amutot-mcp) | Israeli non-profit registry: amutot, public benefit companies, foreign donations, and management certificates | [data.gov.il](https://data.gov.il/) | None |
| [israel-clinical-trials-mcp](./israel-clinical-trials-mcp) | [`@skills-il/israel-clinical-trials-mcp`](https://www.npmjs.com/package/@skills-il/israel-clinical-trials-mcp) | Clinical trials at Israeli hospitals and research centers | [ClinicalTrials.gov v2 API](https://clinicaltrials.gov/data-api/api) | None |
| [israel-elections-mcp](./israel-elections-mcp) | [`@skills-il/israel-elections-mcp`](https://www.npmjs.com/package/@skills-il/israel-elections-mcp) | Israeli Knesset election results | [data.gov.il](https://data.gov.il/) | None |
| [israel-hiking-mcp](./israel-hiking-mcp) | [`@skills-il/israel-hiking-mcp`](https://www.npmjs.com/package/@skills-il/israel-hiking-mcp) | Israel hiking trails, POI search, route planning, and coordinate conversion | [Israel Hiking Map](https://israelhiking.osm.org.il) | None |
| [israel-medical-research-mcp](./israel-medical-research-mcp) | [`@skills-il/israel-medical-research-mcp`](https://www.npmjs.com/package/@skills-il/israel-medical-research-mcp) | Medical research from Israeli institutions via PubMed | [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) | None |
| [israel-mental-health-mcp](./israel-mental-health-mcp) | [`@skills-il/israel-mental-health-mcp`](https://www.npmjs.com/package/@skills-il/israel-mental-health-mcp) | Mental health clinics, quality metrics, and psychiatric services across Israel | [data.gov.il MOH](https://data.gov.il/dataset/mentalhealthclinics) | None |
| [israel-nature-mcp](./israel-nature-mcp) | [`@skills-il/israel-nature-mcp`](https://www.npmjs.com/package/@skills-il/israel-nature-mcp) | Israeli nature observations and biodiversity data | [iNaturalist](https://www.inaturalist.org/) + [GBIF](https://www.gbif.org/) | None |
| [israel-nutrition-mcp](./israel-nutrition-mcp) | [`@skills-il/israel-nutrition-mcp`](https://www.npmjs.com/package/@skills-il/israel-nutrition-mcp) | Israeli nutrition database (Tzameret) with 4,500+ foods and 74 nutrients | [data.gov.il Tzameret](https://data.gov.il/dataset/nutrition) | None |
| [israel-railways-mcp](./israel-railways-mcp) | [`@skills-il/israel-railways-mcp`](https://www.npmjs.com/package/@skills-il/israel-railways-mcp) | Israel Railways train schedules, platforms, occupancy, and service updates | [rail.co.il](https://rail.co.il/) | None |
| [israel-vehicles-mcp](./israel-vehicles-mcp) | [`@skills-il/israel-vehicles-mcp`](https://www.npmjs.com/package/@skills-il/israel-vehicles-mcp) | Vehicle registry: license plate lookup, manufacturer/model search, roadworthiness status across 4.1M+ vehicles | [data.gov.il](https://data.gov.il/) | None |
| [kolzchut-mcp](./kolzchut-mcp) | [`@skills-il/kolzchut-mcp`](https://www.npmjs.com/package/@skills-il/kolzchut-mcp) | Israeli rights and entitlements knowledge base (olim, tax, housing, health, disability) | [Kolzchut MediaWiki API](https://www.kolzchut.org.il/w/api.php) | None |
| [openbus-mcp](./openbus-mcp) | [`@skills-il/openbus-mcp`](https://www.npmjs.com/package/@skills-il/openbus-mcp) | Real-time Israeli public transit data (bus arrivals, route performance, vehicle locations) | [Open Bus Stride API](https://open-bus-stride-api.hasadna.org.il/docs) | None |
| [supermarket-prices-mcp](./supermarket-prices-mcp) | [`@skills-il/supermarket-prices-mcp`](https://www.npmjs.com/package/@skills-il/supermarket-prices-mcp) | Israeli supermarket price comparison using government-mandated price transparency data | [Price Transparency Law XML feeds](https://github.com/OpenIsraeliSupermarkets) | None |
| [tase-mcp](./tase-mcp) | [`@skills-il/tase-mcp`](https://www.npmjs.com/package/@skills-il/tase-mcp) | Tel Aviv Stock Exchange market data (securities, indices, Maya filings) | [TASE Data Hub](https://openapi.tase.co.il/tase/prod/) | API Key |
| [tel-aviv-city-mcp](./tel-aviv-city-mcp) | [`@skills-il/tel-aviv-city-mcp`](https://www.npmjs.com/package/@skills-il/tel-aviv-city-mcp) | Tel Aviv municipal data (parking, bike stations, road closures, city services) | [TLV ArcGIS REST](https://gisn.tel-aviv.gov.il/arcgis/rest/services/) | None |

## Structure

Each subdirectory is a standalone MCP server with its own `package.json`, build system, and README. Each subdirectory publishes independently to npm as `@skills-il/<subdir-name>`.

## Adding a New MCP

Use the `create-mcp-admin` skill in Claude Code to create and deploy a new MCP end-to-end.

## Publishing

Releases are cut by pushing a git tag of the form `<subdir>-v<semver>`, for example `israel-hiking-mcp-v1.0.1`. The `Publish MCP` workflow (`.github/workflows/publish.yml`) parses the tag, validates that the package version matches, builds the package, and runs `npm publish --provenance --access public` against the `@skills-il` scope.

Required repo secret: `NPM_TOKEN` (granular token with read+write on the `@skills-il` scope).

To bump and release a single MCP:

```bash
cd <subdir>
# edit package.json: bump version
git add package.json
git commit -m "release: <subdir> vX.Y.Z"
git push
git tag <subdir>-v<X.Y.Z>
git push origin <subdir>-v<X.Y.Z>
```

Watch the run with `gh run watch --repo skills-il/mcps --exit-status`.

## License

Each MCP has its own license. See the LICENSE file in each subdirectory.
