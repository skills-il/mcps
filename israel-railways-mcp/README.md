# Israel Railways MCP

MCP server for Israel Railways (Rakevet Israel) train schedules, real-time data, and station information. Search routes between any of 68 stations, check platforms, occupancy, and service disruptions.

No API key required.

## Install

```bash
npx -y @skills-il/israel-railways-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "israel-railways": {
      "command": "npx",
      "args": ["-y", "@skills-il/israel-railways-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add israel-railways npx -- -y @skills-il/israel-railways-mcp
```

## Tools

| Tool | Description |
|------|-------------|
| `search_routes` | Search train routes between two stations with times, platforms, transfers, and occupancy |
| `list_stations` | List all 68 stations with Hebrew/English names and IDs. Optional name filter |
| `get_service_updates` | Get current service disruptions, maintenance notices, and announcements |

## Local development

### Claude Desktop / Claude Code

Add to your MCP config:

```json
{
  "mcpServers": {
    "israel-railways": {
      "command": "npx",
      "args": ["-y", "israel-railways-mcp"]
    }
  }
}
```

### From source

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/israel-railways-mcp/israel-railways-mcp
npm install
npm run build
```

Then add to your MCP config:

```json
{
  "mcpServers": {
    "israel-railways": {
      "command": "npx", "args": ["-y", "@skills-il/israel-railways-mcp"]
    }
  }
}
```

## API

Uses the Israel Railways API at `rail-api.rail.co.il` (same endpoints that power the official rail.co.il website). Supports fuzzy station name matching in Hebrew and English.

## Examples

**"When is the next train from Tel Aviv to Haifa?"**
Calls `search_routes` with `from: "Tel Aviv"`, `to: "Haifa"`, today's date.

**"Find trains from Jerusalem to Ben Gurion Airport at 6am"**
Calls `search_routes` with `from: "Jerusalem"`, `to: "Ben Gurion Airport"`, `hour: "06:00"`.

**"Are there any train service disruptions today?"**
Calls `get_service_updates`.

**"Which stations are in the Haifa area?"**
Calls `list_stations` with `filter: "Haifa"`.

## License

MIT
