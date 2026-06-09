import { version } from "../package.json" with { type: "json" };
import { FastMCP, UserError } from "fastmcp";

import { registerCompanyTools } from "./tools/company.js";

const transportType = (process.env.DL_MCP_TRANSPORT ?? "stdio") as "stdio" | "httpStream";
const envApiKey = process.env.DL_MCP_API_KEY;
const httpPort = process.env.DL_MCP_HTTP_PORT ? parseInt(process.env.DL_MCP_HTTP_PORT) : 8080;

const server = new FastMCP({
    name: "DataLedger MCP Server",
    version: version as `${number}.${number}.${number}`,
    instructions: `DataLedger provides data on UK companies sourced from Companies House filings. All monetary values are in GBP.

CREDIT COSTS (visible in X-API-Key-Details response header after every request):
- companies_search: 1 credit
- company_details: 1 credit base; +1 for financials, +2 for people, +3 for parents, +3 for children (max 10 total)
- Credits are only charged for data actually returned. If financials=true but the company has no electronic filing, financials is null and no credit is charged for that flag. Same for people/parents/children returning empty arrays.

COMPANY NUMBERS: 8-character alphanumeric strings assigned by Companies House. Prefixes by region: none = England/Wales, SC = Scotland, NI = Northern Ireland, OC = LLPs. Always zero-pad to 8 characters (e.g. "00123456").

FINANCIAL DATA: Sourced from the most recently filed electronic accounts — typically 1–2 years old. Fields prefixed c = current filing year, p = previous filing year. Growth rates are decimals (0.1 = 10% growth). Not all companies file detailed accounts; micro entities and dormant companies may have minimal data.

RECOMMENDED WORKFLOW:
1. Use companies_search to find companies matching criteria — returns lightweight summary records
2. Use company_details with a specific company number for the full profile and optional financials/people/ownership data
3. For unknown company numbers, use the name filter in companies_search or the autocomplete endpoint (not yet exposed as a tool)

FINANCIAL COVERAGE — IMPORTANT:
Not all UK companies file electronic accounts. DataLedger only holds financials for companies that have submitted electronically to Companies House. Companies without electronic filings still appear in search results and have ownership/PSC data, but their financials field will be null in company_details. Use isElectronicSubmission=true to restrict searches to companies with electronic filings.

Of those that do file electronically, only approximately 2% also include a full Profit & Loss statement (turnover, revenue, profit figures). This is because most small companies file abbreviated or micro-entity accounts which omit P&L. Setting hasPLFigures=true restricts results to this ~2% subset, which dramatically reduces result counts.

PROXY FILTERS FOR COMPANY SIZE WHEN P&L IS UNAVAILABLE:
If a user asks for companies by turnover or revenue but results are too sparse with hasPLFigures=true, suggest removing that filter and using these balance sheet proxies instead — they are available for a much broader set of companies:
- minTotalAssets / maxTotalAssets: strongest proxy for company scale; total assets correlate closely with revenue for most industries
- minEquity / maxEquity: net worth of the business; useful for identifying established vs early-stage companies
- minTotalLiabilities / maxTotalLiabilities: larger companies typically carry more debt; useful when combined with asset filters
- minCashInBank / maxCashInBank: liquid reserves; useful for identifying financially healthy or cash-generative businesses
- minEmployees / maxEmployees: headcount is a reliable size proxy, especially for service businesses where assets are low
- minDebtToEquityRatio / maxDebtToEquityRatio: financial leverage; high ratio indicates debt-heavy structure
- minDebtToAssetRatio / maxDebtToAssetRatio: solvency indicator; values above 0.5 suggest significant leverage
- minAssetsGrowthRate / maxAssetsGrowthRate: proxy for business growth trajectory
- minNetAssetsGrowthRate / maxNetAssetsGrowthRate: proxy for profitability and retained earnings growth
- incorporationDateFrom / incorporationDateTo: age of business as a proxy for maturity and scale
- sic: industry SIC code narrows to a sector, useful when combined with size proxies

When helping users find companies by size, always clarify whether hasPLFigures=true is required and proactively suggest these proxies if it significantly limits results.

PSC (PEOPLE WITH SIGNIFICANT CONTROL):
- Individuals: have name, dobYear (year only, not full DOB), nationality, country of residence
- Corporate PSCs: have company name and registration details; no DOB
- PSC age filters apply to individual PSCs only, calculated from dobYear
- hasCorporateOwner and individualOwnerOnly are mutually exclusive — do not combine them

OWNERSHIP CHAINS:
- parents: traverses corporate PSC links upward to ultimate parent; terminates at individual owners or overseas entities
- children: traverses downward to all known subsidiaries where this company appears as a corporate PSC
- Depth 1 = direct parent/child; higher depth = further up/down the chain
- source="psc" in a response means the company is dissolved/inactive and data comes from PSC filings only — some profile fields may be absent`,
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
