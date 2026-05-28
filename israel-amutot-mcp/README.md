# israel-amutot-mcp

Part of [skills-il](https://github.com/skills-il): browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


MCP server for the Israeli non-profit registry: amutot, public benefit companies (חלצ), foreign donations, and management certificates. Data from [data.gov.il](https://data.gov.il/) (`guidestar` resources).

## Install

```bash
npx -y @skills-il/israel-amutot-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-amutot": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-amutot-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-amutot npx -- -y @skills-il/israel-amutot-mcp
```

## Tools

- `search_amuta`: Search amutot (Israeli non-profits) by name or registration number.
- `get_amuta_details`: Get full registry record for an amuta by ID.
- `count_amutot`: Aggregate counts (total registered, by status, by activity class).
- `search_by_activity`: Find amutot by activity classification or secondary field.
- `get_financial_info`: Latest financial year data: revenue, expenses, volunteers, employees.
- `search_foreign_donations`: Foreign donations declared by Israeli amutot.
- `get_amuta_donation_summary`: Aggregate donation totals for a given amuta.
- `check_management_certificate`: Whether an amuta currently holds a valid תעודת ניהול תקין.
- `search_certificates`: Search across management certificate records.
- `search_public_benefit_company`: Search registered public benefit companies (חלצ).
- `get_public_benefit_company_details`: Full record for a חלצ by registration number.

See `src/tools.ts` for parameter schemas and field-by-field documentation.

## Data source

[data.gov.il](https://data.gov.il/) CKAN DataStore: no API key required.

## Local development

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-amutot-mcp
npm install
npm run build
node dist/index.js
```

## License

MIT
