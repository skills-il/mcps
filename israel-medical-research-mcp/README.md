# israel-medical-research-mcp

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


MCP server for medical research from Israeli institutions, via the [PubMed E-utilities API](https://www.ncbi.nlm.nih.gov/books/NBK25501/). Every search auto-scopes to `israel[affiliation]`.

## Install

```bash
npx -y @skills-il/israel-medical-research-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-medical-research": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-medical-research-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-medical-research npx -- -y @skills-il/israel-medical-research-mcp
```

## Tools

- `search_papers`: Free-text search across Israeli-affiliated PubMed papers (title + abstract).
- `search_by_institution`: Filter to a specific Israeli institution (Weizmann, Hadassah, Tel Aviv University, etc.).
- `get_recent_papers`: Recent papers in a date range, optionally narrowed by topic.
- `get_paper_details`: Full PubMed metadata for a paper by PMID.
- `count_papers`: Result-count for a query without fetching summaries.

See `src/tools.ts` for parameter schemas.

## Data source

[NCBI PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/): public API, no key required for typical query rates.

## Local development

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-medical-research-mcp
npm install
npm run build
node dist/index.js
```

## License

MIT
