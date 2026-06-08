# dl-mcp
DataLedger MCP Server

This project provides an MCP server for DataLedger company data, leveraging v2 of the DataLedger API.

## Run with HTTP transport

Requirements:
- Node.js 20+
- npm

1. Install dependencies

    npm install

2. Start the MCP server in HTTP mode

    npm run http

By default, the server starts on port 8080 and exposes MCP over HTTP Stream.

Environment options:
- DL_MCP_HTTP_PORT: set a custom port
- DL_MCP_API_KEY: optional server-side API key override

Example with a custom port:

    DL_MCP_HTTP_PORT=8081 npm run http

Important behavior:
- If DL_MCP_API_KEY is set, the server uses that key for all requests.
- If DL_MCP_API_KEY is not set, clients must send x-api-key in request headers.

Relevant project files:
- package.json
- index.ts
- dev.http.json

## Configure Claude app (Developer Settings)

Use the same MCP client configuration pattern shown in dev.http.json.

In Claude Developer Settings, add this MCP server entry:

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

Replace your_api_key_here with your real DataLedger API key.

Then:
1. Keep the local MCP server running with npm run http.
2. Open Claude and verify the dataledger server is connected.
3. Confirm tools are available (for example, company_details and companies_search).

## Notes

- The Claude app connects through mcp-remote to your local HTTP endpoint.
- If you change the server port, update the URL in Developer Settings to match.
- If you prefer not to send headers from Claude, set DL_MCP_API_KEY on the server before startup.
