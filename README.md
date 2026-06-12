# dl-mcp
DataLedger MCP Server

Provides two tools for querying UK company data from Companies House filings:
- `companies_search` — filter and search companies by financial metrics, location, SIC code, ownership structure, and more
- `company_details` — retrieve the full profile for a specific company number, optionally including financials, people (PSCs), and ownership chain

All monetary values are in GBP. An API key from [dataledger.uk](https://dataledger.uk) is required.

---

## Prerequisites

- Node.js 20+
- npm
- A DataLedger API key

Clone the repo and install dependencies:

```
git clone https://github.com/dataledger/dl-mcp.git
cd dl-mcp
npm install
```

---

## Connection methods

There are two ways to connect this MCP server to a client:

| Method | When to use |
|---|---|
| **stdio** | Simplest setup. The client launches the server as a subprocess. No separate server process to manage. |
| **HTTP** | Useful if you want to share one running server across multiple clients, or connect remotely. |

---

## Method A: stdio (recommended)

In stdio mode, the client spawns the MCP server directly as a child process and communicates over stdin/stdout. No separate server needs to be running. The server requires a `DL_MCP_API_KEY` environment variable.

### Claude Code CLI

```
claude mcp add dataledger \
  -e DL_MCP_TRANSPORT=stdio \
  -e DL_MCP_API_KEY=your_api_key_here \
  -- npx tsx /absolute/path/to/dl-mcp/src/index.ts
```

Pass `-s user` to register globally (available in all projects) instead of just the current project. Verify with `/mcp` or `claude mcp list`.

### Claude Desktop, Cursor, Windsurf

These clients all use the same `mcpServers` JSON format. Edit the relevant config file:

| Client | Config file |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor (global) | `~/.cursor/mcp.json` |
| Cursor (project) | `.cursor/mcp.json` |
| Windsurf | `~/.windsurf/mcp_config.json` (check Windsurf settings if this path doesn't exist) |

```json
{
  "mcpServers": {
    "dataledger": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/dl-mcp/src/index.ts"],
      "env": {
        "DL_MCP_TRANSPORT": "stdio",
        "DL_MCP_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Restart the client after saving.

### VS Code (Copilot agent mode)

Edit `.vscode/mcp.json` in your workspace. VS Code uses a `servers` key with an explicit `type` field:

```json
{
  "servers": {
    "dataledger": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/dl-mcp/src/index.ts"],
      "env": {
        "DL_MCP_TRANSPORT": "stdio",
        "DL_MCP_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Zed

Edit `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "dataledger": {
      "command": {
        "path": "npx",
        "args": ["tsx", "/absolute/path/to/dl-mcp/src/index.ts"],
        "env": {
          "DL_MCP_TRANSPORT": "stdio",
          "DL_MCP_API_KEY": "your_api_key_here"
        }
      }
    }
  }
}
```

---

## Method B: HTTP transport

In HTTP mode, the server runs as a standalone process and clients connect to it via HTTP. You manage the server lifecycle yourself.

### Step 1 — Start the server

```
DL_MCP_API_KEY=your_api_key_here npm run http
```

The server starts on port 8080 by default and exposes the MCP endpoint at `http://localhost:8080/mcp`. To use a custom port:

```
DL_MCP_HTTP_PORT=8081 DL_MCP_API_KEY=your_api_key_here npm run http
```

**Authentication options:**
- **Server holds the key** (recommended): set `DL_MCP_API_KEY` when starting the server — clients do not need to send it
- **Client sends the key**: omit `DL_MCP_API_KEY` server-side — each client must pass it in an `x-api-key` header

### Step 2 — Connect a client

#### Claude Code CLI

```
claude mcp add dataledger -- npx mcp-remote http://localhost:8080/mcp
```

With client-side key:
```
claude mcp add dataledger \
  -- npx mcp-remote http://localhost:8080/mcp \
  --header "x-api-key:your_api_key_here"
```

#### Claude Desktop, Cursor, Windsurf

```json
{
  "mcpServers": {
    "dataledger": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8080/mcp"]
    }
  }
}
```

With client-side key:
```json
{
  "mcpServers": {
    "dataledger": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8080/mcp",
        "--header",
        "x-api-key:your_api_key_here"
      ]
    }
  }
}
```

#### VS Code (Copilot agent mode)

```json
{
  "servers": {
    "dataledger": {
      "type": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

With client-side key:
```json
{
  "servers": {
    "dataledger": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": {
        "x-api-key": "your_api_key_here"
      }
    }
  }
}
```

#### Zed

Zed does not natively support HTTP MCP servers. Use `mcp-remote` as a stdio bridge:

```json
{
  "context_servers": {
    "dataledger": {
      "command": {
        "path": "npx",
        "args": ["mcp-remote", "http://localhost:8080/mcp", "--header", "x-api-key:your_api_key_here"]
      }
    }
  }
}
```

---

## Environment variables

| Variable | Transport | Description |
|---|---|---|
| `DL_MCP_API_KEY` | stdio, HTTP | API key used for all requests. Required in stdio mode. Optional in HTTP mode — if set, overrides any client-supplied header. |
| `DL_MCP_TRANSPORT` | — | Set to `stdio` or `httpStream`. Defaults to `stdio`. |
| `DL_MCP_HTTP_PORT` | HTTP | Port for the HTTP server. Defaults to `8080`. |

---

## Available tools

### `companies_search`
Search and filter UK companies. At least one filter is required. Costs 1 credit per call.

Key filters:
- `name` — partial match on registered name
- `sic` — 5-digit SIC code (e.g. `62020` for IT consultancy)
- `postcode` — full postcode, outward code, or area prefix
- `localAuthority` — e.g. `Camden`, `York`, `Aberdeenshire`
- `isActive` — `true` for active companies only
- `minTotalAssets` / `maxTotalAssets` — balance sheet size proxy when P&L is unavailable
- `minEmployees` / `maxEmployees` — headcount filter
- `hasPLFigures` — restrict to the ~2% of companies that file a full P&L (turnover/revenue/profit)
- `hasCorporateOwner` — companies with a corporate PSC (useful for PE-backed identification)
- `individualOwnerOnly` — companies owned entirely by individuals (owner-managed businesses)
- `incorporationDateFrom` / `incorporationDateTo` — company age filter

### `company_details`
Get the full profile for a company by its 8-character Companies House number. Base cost is 1 credit; optional flags add more:

| Flag | Extra cost | Returns |
|---|---|---|
| `financials` | +1 credit | Balance sheet and P&L line items from most recent filing |
| `people` | +2 credits | All PSC (People with Significant Control) records |
| `parents` | +3 credits | Corporate ownership chain upward to ultimate parent |
| `children` | +3 credits | All known subsidiaries |

Credits are only charged when data is actually returned. If a company has no electronic filing, `financials` returns `null` at no charge.

