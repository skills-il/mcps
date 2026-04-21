# TASE MCP - Tel Aviv Stock Exchange MCP Server

Part of [skills-il](https://github.com/skills-il) — browse all Israeli MCP servers at [agentskills.co.il/mcp](https://agentskills.co.il/mcp).


An [MCP](https://modelcontextprotocol.io/) server providing access to Tel Aviv Stock Exchange (TASE) market data through the official [TASE Data Hub](https://datahubapi.tase.co.il/) API.

## Install

```bash
npx -y @skills-il/tase-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tase": {
      "command": "npx",
      "args": ["-y", "@skills-il/tase-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add tase npx -- -y @skills-il/tase-mcp
```

## Prerequisites

- Node.js 18+
- A TASE Data Hub developer account — sign in at [datahubapi.tase.co.il](https://datahubapi.tase.co.il/) (Google SSO)
- An application in the portal with an API key registered against the products you want to use (see "Product subscriptions" below)

## Installation

```bash
npx -y @skills-il/tase-mcp
```

Or install locally:

```bash
git clone https://github.com/skills-il/mcps.git
cd mcps/tase-mcp
npm install
npm run build
node dist/index.js
```

## Environment variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `TASE_API_KEY` | yes | — | The `apikey` from your application in the developer portal |
| `TASE_BASE_URL` | no | `https://datawise.tase.co.il` | Override only if TASE points you elsewhere |

## Product subscriptions

TASE Data Hub splits its API into ~40 **products** (Securities - Basic, Indices - Basic, Mutual Funds - Basic, etc.). Each product has its own OpenAPI spec and a set of endpoints. Your API key must be **registered for a product** before you can call its endpoints; calling an unregistered endpoint returns **HTTP 403**.

To register:

1. Sign in at <https://datahubapi.tase.co.il/>.
2. Create an application (top-right menu → Applications → Create).
3. For each product you want, click "Register" on its spec page and select your application.
4. Some products auto-approve (typically the free/basic tier); others require manual approval from TASE.
5. Once a registration is `approved`, your application's apikey can call that product's endpoints.

The tools below cover the products in the free/basic tier. Tools for endpoints you haven't registered for will return a 403 error from the server.

## Available tools (36)

All tools accept an optional `lang` parameter (`he-IL` default, or `en-US`) that controls the API response language.

### Securities - Basic (6 tools)

| Tool | Endpoint |
|------|----------|
| `tase_list_companies` | `GET /v1/basic-securities/companies-list` |
| `tase_list_traded_securities` | `GET /v1/basic-securities/trade-securities-list/{year}/{month}/{day}` |
| `tase_list_delisted_securities` | `GET /v1/basic-securities/delisted-securities-list/{year}/{month}` |
| `tase_list_illiquid_maintenance_suspension` | `GET /v1/basic-securities/illiquid-maintenance-suspension-list` |
| `tase_list_trading_codes` | `GET /v1/basic-securities/trading-code-list` |
| `tase_list_security_types` | `GET /v1/basic-securities/securities-types` |

### Indices - Basic (v2, 3 tools)

| Tool | Endpoint |
|------|----------|
| `tase_list_indices` | `GET /api/v2/basic-indices/indices-list` |
| `tase_list_index_universes` | `GET /api/v2/basic-indices/universes-list` |
| `tase_get_index_components` | `GET /api/v2/basic-indices/index-components-basic` |

### TASE Indices Online (3 tools)

| Tool | Endpoint |
|------|----------|
| `tase_get_index_last_rate` | `GET /v1/tase-indices-online-data/last-rate` |
| `tase_get_index_intraday` | `GET /v1/tase-indices-online-data/intraday` |
| `tase_list_index_trading_rate_types` | `GET /v1/tase-indices-online-data/index-trading-rate-types` |

### Derivatives Data - Basic (4 tools)

| Tool | Endpoint |
|------|----------|
| `tase_list_traded_derivatives` | `GET /v1/derivatives/traded-list` |
| `tase_list_derivative_types` | `GET /v1/derivatives/types` |
| `tase_list_derivative_underlying_assets` | `GET /v1/derivatives/underlying-assets` |
| `tase_list_derivative_underlying_asset_types` | `GET /v1/derivatives/underlying-asset-types` |

### Mutual Funds - Basic (12 tools)

| Tool | Endpoint |
|------|----------|
| `tase_list_funds` | `GET /v1/fund/fund-list` |
| `tase_list_fund_types` | `GET /v1/fund/fund-type` |
| `tase_list_fund_listing_statuses` | `GET /v1/fund/listing-status` |
| `tase_list_fund_mutual_fund_classifications` | `GET /v1/fund/mutual-fund-classification` |
| `tase_list_fund_tracking_classifications` | `GET /v1/fund/tracking-fund-classification` |
| `tase_list_fund_tax_statuses` | `GET /v1/fund/tax-status` |
| `tase_list_fund_payment_policies` | `GET /v1/fund/payment-policy` |
| `tase_list_fund_distribution_commissions` | `GET /v1/fund/distribution-commission` |
| `tase_list_fund_stock_exchanges` | `GET /v1/fund/stock-exchange` |
| `tase_list_fund_currency_exposure_profiles` | `GET /v1/fund/currency-exposure-profile` |
| `tase_list_fund_share_exposure_profiles` | `GET /v1/fund/share-exposure-profile` |
| `tase_list_fund_underlying_assets` | `GET /v1/fund/underlying-asset` |

### Lending Pool Online (3 tools)

| Tool | Endpoint |
|------|----------|
| `tase_get_lending_pool_book_offers` | `GET /v1/lending-pool-online-data/book-offers` |
| `tase_get_lending_pool_deals` | `GET /v1/lending-pool-online-data/deals` |
| `tase_list_lending_pool_types` | `GET /v1/lending-pool-online-data/types` |

### OTC Transactions Online (1 tool)

| Tool | Endpoint |
|------|----------|
| `tase_get_otc_transactions` | `GET /v1/transactions/otc-transactions-online` |

### Public Offerings Online (2 tools)

| Tool | Endpoint |
|------|----------|
| `tase_list_upcoming_offerings` | `GET /v1/tase-offering/upcoming` |
| `tase_list_open_offerings` | `GET /v1/tase-offering/open` |

### TASE Trading & Vacation Schedules (2 tools)

| Tool | Endpoint |
|------|----------|
| `tase_get_trading_schedule` | `GET /v1/tase-schedules` |
| `tase_list_trading_day_types` | `GET /v1/tase-schedules/day-types` |

## Claude Desktop configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tase": {
      "command": "npx",
      "args": ["-y", "tase-mcp"],
      "env": {
        "TASE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Claude Code configuration

```bash
claude mcp add tase -- npx -y @skills-il/tase-mcp
export TASE_API_KEY=your_api_key_here
```

## Rate limits

TASE's published limit is 10 requests per 2 seconds. This server enforces a conservative 5 requests per second client-side.

## Error handling

Common error states surfaced to the caller:

| Condition | Message |
|-----------|---------|
| Missing `TASE_API_KEY` | Points to the developer portal |
| 401 | "API key is invalid or missing" |
| 403 | "apikey is not registered for this product" — register the product in the portal |
| 429 | Rate-limit exceeded |
| 500 / 503 | "TASE API is currently unavailable" — some online endpoints only return data during trading hours (Sun-Thu 9:30-17:00 Israel time) |

## License

MIT
