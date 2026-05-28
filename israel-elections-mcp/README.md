# israel-elections-mcp

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


MCP server for Israeli Knesset election results: settlement-level votes, turnout, and cross-election comparisons. Data from [data.gov.il](https://data.gov.il/) Central Elections Committee resources.

## Install

```bash
npx -y @skills-il/israel-elections-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-elections": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-elections-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-elections npx -- -y @skills-il/israel-elections-mcp
```

## Tools

- `get_election_results`: Settlement-level election results for a given Knesset (eligible voters, turnout, valid/invalid ballots, party-by-party vote tallies). Party ballot letters are translated to full party names (Hebrew + English) per election year.
- `search_settlements`: Find settlements by name across the elections datasets.
- `get_turnout`: Voter turnout (eligible / actual / valid) for a settlement and Knesset.
- `compare_elections`: Compare results for the same settlement across multiple Knesset elections.

Settlement names are matched leniently (exact match first, then a full-text search fallback), so `"תל אביב"`, `"תל אביב-יפו"`, and the canonical `"תל אביב  יפו"` all resolve to the same record.

See `src/tools.ts` for parameter schemas and supported Knesset numbers (`SUPPORTED_KNESSETS`).

## Data source

[data.gov.il](https://data.gov.il/): Central Elections Committee election result CSVs exposed via CKAN DataStore. No API key required.

## Local development

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-elections-mcp
npm install
npm run build
node dist/index.js
```

## License

MIT
