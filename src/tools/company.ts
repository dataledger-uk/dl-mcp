import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";

const DL_API_BASE_URL = "https://api.dataledger.uk/v2";

const companiesSearchInputSchema = z.
    object({
        meta: z.boolean().optional()
            .describe("If true, returns only a totalCount of matching companies instead of full records. Useful for estimating result size before a full query. Does not reduce credit cost."),
        limit: z.number().int().min(1).max(500).optional()
            .describe("Number of results to return. Default 100, maximum 500."),
        offset: z.number().int().min(0).optional()
            .describe("Number of records to skip for pagination. Use with limit to page through results."),

        name: z.string().min(1).optional()
            .describe("Partial match on company registered name (case-insensitive)."),
        sic: z.string().regex(/^\d{5}$/).optional()
            .describe("5-digit Standard Industrial Classification code (e.g. '62020' for IT consultancy, '47710' for clothing retail). Must be exactly 5 digits as a string."),
        postcode: z.string().optional()
            .describe("Filter by postcode or prefix. Accepts full postcodes ('EC1A 1BB'), outward codes ('EC1A', 'SW1'), or area codes ('EC'). Case-insensitive."),
        localAuthority: z.string().optional()
            .describe("Filter by local authority name (e.g. 'York', 'Aberdeenshire', 'Camden'). 354 valid values covering England, Scotland, Wales and Northern Ireland. Full list at https://api.dataledger.uk/docs/v2"),
        isActive: z.boolean().optional()
            .describe("true = Active or Active-Proposal to Strike off. false = any other status (Dissolved, In Administration, Liquidation, etc.)."),
        entityDormant: z.boolean().optional()
            .describe("Filter for dormant companies (not currently trading). false returns non-dormant companies."),

        incorporationDateFrom: z.string().optional()
            .describe("Return companies incorporated on or after this date. Format: YYYY-MM-DD."),
        incorporationDateTo: z.string().optional()
            .describe("Return companies incorporated on or before this date. Format: YYYY-MM-DD."),

        minEquity: z.number().min(0).optional()
            .describe("Minimum shareholders' equity in GBP, from the most recent filed accounts."),
        maxEquity: z.number().min(0).optional()
            .describe("Maximum shareholders' equity in GBP, from the most recent filed accounts."),
        minTotalAssets: z.number().min(0).optional()
            .describe("Minimum total assets in GBP, from the most recent filed accounts."),
        maxTotalAssets: z.number().min(0).optional()
            .describe("Maximum total assets in GBP, from the most recent filed accounts."),
        minTotalLiabilities: z.number().min(0).optional()
            .describe("Minimum total liabilities in GBP, from the most recent filed accounts."),
        maxTotalLiabilities: z.number().min(0).optional()
            .describe("Maximum total liabilities in GBP, from the most recent filed accounts."),
        minCashInBank: z.number().min(0).optional()
            .describe("Minimum cash and bank balances in GBP (cashBankOnHand field). The actual cash figure is only returned in company_details when financials=true."),
        maxCashInBank: z.number().min(0).optional()
            .describe("Maximum cash and bank balances in GBP (cashBankOnHand field). The actual cash figure is only returned in company_details when financials=true."),
        minEmployees: z.number().int().min(0).optional()
            .describe("Minimum average employee count during the filing period."),
        maxEmployees: z.number().int().min(0).optional()
            .describe("Maximum average employee count during the filing period."),
        hasPLFigures: z.boolean().optional()
            .describe("true = only companies with a full P&L statement (turnover, revenue, profit). Only ~2% of electronically filing companies include P&L — setting this to true dramatically reduces result counts. If results are too sparse, remove this filter and use asset size, employee count, or equity as proxies instead."),
        isElectronicSubmission: z.boolean().optional()
            .describe("true = only companies with electronically filed accounts. false = paper submissions (not supported by this API). Recommended: set true when filtering by financial metrics."),

        minDebtToEquityRatio: z.number().min(0).optional()
            .describe("Minimum debt-to-equity ratio (total liabilities / equity) from most recent filing."),
        maxDebtToEquityRatio: z.number().min(0).optional()
            .describe("Maximum debt-to-equity ratio (total liabilities / equity) from most recent filing."),
        minDebtToAssetRatio: z.number().min(0).optional()
            .describe("Minimum debt-to-asset ratio (total liabilities / total assets) from most recent filing."),
        maxDebtToAssetRatio: z.number().min(0).optional()
            .describe("Maximum debt-to-asset ratio (total liabilities / total assets) from most recent filing."),
        minAssetsGrowthRate: z.number().optional()
            .describe("Minimum total assets growth rate as a decimal between the two most recent filings (0.1 = 10% growth, -0.2 = 20% decline)."),
        maxAssetsGrowthRate: z.number().optional()
            .describe("Maximum total assets growth rate as a decimal between the two most recent filings."),
        minNetAssetsGrowthRate: z.number().optional()
            .describe("Minimum net assets (equity) growth rate as a decimal between the two most recent filings."),
        maxNetAssetsGrowthRate: z.number().optional()
            .describe("Maximum net assets (equity) growth rate as a decimal between the two most recent filings."),

        minPscAge: z.number().int().min(0).optional()
            .describe("Return companies where at least one individual PSC is at least this age. Calculated from dobYear (year only). Applies to individual PSCs only — corporate PSCs have no date of birth."),
        maxPscAge: z.number().int().min(0).optional()
            .describe("Return companies where at least one individual PSC is no older than this age. Calculated from dobYear (year only). Applies to individual PSCs only."),
        hasCorporateOwner: z.boolean().optional()
            .describe("true = only companies with at least one corporate PSC (another company as owner). Useful for PE-backed company identification and M&A sourcing. Cannot be combined with individualOwnerOnly=true."),
        individualOwnerOnly: z.boolean().optional()
            .describe("true = only companies where all PSC records are individuals (no corporate owners). Useful for identifying owner-managed businesses. Cannot be combined with hasCorporateOwner=true.")
    })
    .refine(
        (v) => Object.values(v).some((x) => x !== undefined && x !== null && x !== ""),
        { message: "At least one filter is required" }
    )
    .refine(
        (v) => !(v.hasCorporateOwner === true && v.individualOwnerOnly === true),
        { message: "hasCorporateOwner and individualOwnerOnly cannot both be true" }
    );

const companyDetailsInputSchema = z.object({
    companyNumber: z.string().regex(/^[A-Za-z0-9]{8}$/)
        .describe("8-character Companies House number (e.g. '12345678', 'SC123456'). Zero-pad if shorter."),
    financials: z.boolean().optional()
        .describe("Include detailed balance sheet and P&L line items. Costs +1 credit. Returns null (no charge) if the company has no electronic filing."),
    people: z.boolean().optional()
        .describe("Include all current PSC (People with Significant Control) records — both individuals and corporate entities. Costs +2 credits. Returns [] (no charge) if no PSCs on record."),
    parents: z.boolean().optional()
        .describe("Traverse the corporate ownership chain upward to the ultimate parent. Ordered by depth (1 = direct parent). Costs +3 credits. Returns [] (no charge) if no corporate parent exists."),
    children: z.boolean().optional()
        .describe("Traverse all known subsidiaries downward from this company. Ordered by depth (1 = direct subsidiary). Costs +3 credits. Returns [] (no charge) if no subsidiaries exist.")
});

function toQueryString(input: object): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input)) {
        if (value === undefined || value === null || value === "") {
            continue;
        }
        params.set(key, String(value));
    }
    return params.toString();
}

function buildInitParameters(apiKey: string): RequestInit {
    return {
        method: "GET",
        headers: {
            "x-api-key": apiKey,
            "accept": "application/json"
        }
    };
}

const callEndpoint = async (baseUrl: string, args: object, init?: RequestInit | undefined) => {
    const qs = toQueryString(args);
    const url = qs ? `${baseUrl}?${qs}` : baseUrl;

    const response = await fetch(url, init);

    const isError = !response.ok;
    const apiKeyDetails = response.headers.get("x-api-key-details");
    return {
        content: [{
            type: "text" as const,
            text: JSON.stringify(
                {
                    status: response.status,
                    statusText: response.statusText,
                    body: isError ? await response.text() : await response.json(),
                    apiKeyDetails
                },
                null,
                2
            )
        }],
        isError
    };
};

export function registerCompanyTools(server: FastMCP) {
    server.addTool({
        name: "company_details",
        description: "Get details of a UK company by its company number via /companies/{companyNumber} endpoint.",
        parameters: companyDetailsInputSchema,
        execute: async (args, { session }) => {
            const apiKey = session?.apiKey as string | undefined;
            if (!apiKey) {
                throw new UserError("API key is required for this tool");
            }

            const init = buildInitParameters(apiKey);
            const { companyNumber, ...queryArgs } = args;
            return await callEndpoint(`${DL_API_BASE_URL}/companies/${companyNumber}`, queryArgs, init);
        }
    });

    server.addTool({
        name: "companies_search",
        description: "Search UK companies using DataLedger filters via /companies/search endpoint.",
        parameters: companiesSearchInputSchema,
        execute: async (args, { session }) => {
            const apiKey = session?.apiKey as string | undefined;
            if (!apiKey) {
                throw new UserError("API key is required for this tool");
            }

            const init = buildInitParameters(apiKey);
            return await callEndpoint(`${DL_API_BASE_URL}/companies/search`, args, init);
        }
    });
};
