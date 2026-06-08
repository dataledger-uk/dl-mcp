import { FastMCP, UserError } from "fastmcp";

import { registerCompanyTools } from "./tools/company.js";

const transportType = (process.env.DL_MCP_TRANSPORT ?? "stdio") as "stdio" | "httpStream";
const envApiKey = process.env.DL_MCP_API_KEY;
const httpPort = process.env.DL_MCP_HTTP_PORT ? parseInt(process.env.DL_MCP_HTTP_PORT) : 8080;

const server = new FastMCP({
    name: "DataLedger MCP Server",
    // use version from package.json
    version: "1.0.0",
    authenticate: async (request) => {
        if (envApiKey) {
            if (transportType !== "stdio") {
                console.warn("Using API key from environment variable for authentication");
            }
            return { apiKey: envApiKey };
        }

        if (transportType === "stdio") {
            throw new UserError(`Please set DL_MCP_API_KEY environment variable ${envApiKey}.`);
        }

        const apiKeyHeader = request.headers["x-api-key"];
        const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
        if (!apiKey) {
            throw new UserError("Missing x-api-key header");
        }
        return { apiKey };
    }
});

registerCompanyTools(server);

server.start({
    transportType,
    httpStream: {
        port: httpPort,
        stateless: true
    }
});
