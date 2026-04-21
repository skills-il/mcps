# israel-nature-mcp

MCP server for Israeli nature observations and biodiversity data, wrapping the [iNaturalist](https://www.inaturalist.org/) and [GBIF](https://www.gbif.org/) APIs. All queries are scoped to Israel.

## Install

```bash
npx -y @skills-il/israel-nature-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-nature": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-nature-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-nature npx -- -y @skills-il/israel-nature-mcp
```

## Tools

- `search_observations` — Search iNaturalist observations in Israel by species, date range, or location.
- `search_species` — Look up species (taxa) by common or scientific name.
- `get_species_in_area` — Species observed within a bounding box in Israel.
- `get_observation_stats` — Aggregate statistics on observations (counts, top contributors).
- `search_biodiversity` — Cross-source biodiversity records via GBIF for Israeli localities.

See `src/tools.ts` for parameter schemas.

## Data sources

- [iNaturalist API](https://api.inaturalist.org/v1/docs/) — community-contributed nature observations.
- [GBIF API](https://www.gbif.org/developer/summary) — Global Biodiversity Information Facility occurrences.

Both are public, no key required.

## Local development

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-nature-mcp
npm install
npm run build
node dist/index.js
```

## License

MIT
