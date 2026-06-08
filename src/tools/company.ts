import { FastMCP, UserError } from "fastmcp";
import { z } from "zod";

const DL_API_BASE_URL = "https://api.dataledger.uk/v2";

const companiesSearchInputSchema = z.
    object({
        meta: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),

        name: z.string().min(1).optional(),
        sic: z.string().regex(/^\d{5}$/).optional(),
        postcode: z.string().optional(),
        localAuthority: z.string().optional(),
        isActive: z.boolean().optional(),
        entityDormant: z.boolean().optional(),

        incorporationDateFrom: z.string().optional(),
        incorporationDateTo: z.string().optional(),

        minEquity: z.number().min(0).optional(),
        maxEquity: z.number().min(0).optional(),
        minTotalAssets: z.number().min(0).optional(),
        maxTotalAssets: z.number().min(0).optional(),
        minTotalLiabilities: z.number().min(0).optional(),
        maxTotalLiabilities: z.number().min(0).optional(),
        minEmployees: z.number().int().min(0).optional(),
        maxEmployees: z.number().int().min(0).optional(),
        hasPLFigures: z.boolean().optional(),
        isElectronicSubmission: z.boolean().optional(),

        minDebtToEquityRatio: z.number().min(0).optional(),
        maxDebtToEquityRatio: z.number().min(0).optional(),
        minDebtToAssetRatio: z.number().min(0).optional(),
        maxDebtToAssetRatio: z.number().min(0).optional(),
        minAssetsGrowthRate: z.number().optional(),
        maxAssetsGrowthRate: z.number().optional(),
        minNetAssetsGrowthRate: z.number().optional(),
        maxNetAssetsGrowthRate: z.number().optional(),

        minPscAge: z.number().int().min(0).optional(),
        maxPscAge: z.number().int().min(0).optional(),
        hasCorporateOwner: z.boolean().optional(),
        individualOwnerOnly: z.boolean().optional()
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
    companyNumber: z.string().regex(/^[A-Za-z0-9]{8}$/),
    financials: z.boolean().optional(),
    people: z.boolean().optional(),
    parents: z.boolean().optional(),
    children: z.boolean().optional()
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
            type: "text",
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
