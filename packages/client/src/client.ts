import { AbstractFetchClient } from "@vertesia/api-fetch-client";
import { AuthTokenPayload, AuthTokenResponse } from "@vertesia/common";
import AccountApi from "./AccountApi.js";
import AccountsApi from "./AccountsApi.js";
import AnalyticsApi from "./AnalyticsApi.js";
import AuditTrailApi from "./AuditTrailApi.js";
import { ApiKeysApi } from "./ApiKeysApi.js";
import AppsApi from "./AppsApi.js";
import CommandsApi from "./CommandsApi.js";
import EnvironmentsApi from "./EnvironmentsApi.js";
import { IamApi } from "./IamApi.js";
import InteractionsApi from "./InteractionsApi.js";
import MCPOAuthApi from "./MCPOAuthApi.js";
import ProjectsApi from "./ProjectsApi.js";
import SkillsApi from "./SkillsApi.js";
import PromptsApi from "./PromptsApi.js";
import { RefsApi } from "./RefsApi.js";
import { RunsApi } from "./RunsApi.js";
import { ZenoClient } from "./store/client.js";
import TrainingApi from "./TrainingApi.js";
import UsersApi from "./UsersApi.js";
import { VERSION, VERSION_HEADER } from "./store/version.js";


/**
 * 1 min threshold constant in ms
 */
const EXPIRATION_THRESHOLD = 60000;

export type VertesiaClientProps = {
    /**
     * The site name of Vertesia.
     *
     * This is used to determine the API backend. It should not include the protocol. For more
     * advanced configurations, use `serverUrl` and `storeUrl` instead.
     *
     * @example api.vertesia.io
     * @example api-preview.vertesia.io
     * @example api-staging.vertesia.io
     * @default api.vertesia.io
     * @since 0.52.0
     */
    site?:
        | "api.vertesia.io"
        | "api-preview.vertesia.io"
        | "api-staging.vertesia.io";
    serverUrl?: string;
    storeUrl?: string;
    tokenServerUrl?: string;
    apikey?: string;
    projectId?: string;
    sessionTags?: string | string[];
    onRequest?: (request: Request) => void;
    onResponse?: (response: Response) => void;
};

export class VertesiaClient extends AbstractFetchClient<VertesiaClient> {
    /**
     * The JWT token linked to the API KEY (sk or pk)
     */
    _jwt: string | null = null;

    /**
     * The store client
     */
    store: ZenoClient;

    /**
     * The session name will be sent when executing an interaction as a tag
     */
    sessionTags?: string | string[];

    /**
     * tokenServerUrl
     */
    tokenServerUrl: string;

    /**
     * Create a client from the given token.
     * If you already have the decoded token you can pass it as the second argument to avoid decodinf it again.
     *
     * @param token the raw JWT token
     * @param payload the decoded JWT token as an AuthTokenPayload - optional
     * @param endpoints optional endpoints to override those in the payload
     */
    static async fromAuthToken(
        token: string,
        payload?: AuthTokenPayload,
        endpoints?: { studio: string; store: string; token?: string }
    ) {
        if (!payload) {
            payload = decodeJWT(token);
        }

        const resolvedEndpoints = endpoints || decodeEndpoints(payload.endpoints);
        return await new VertesiaClient({
            serverUrl: resolvedEndpoints.studio,
            storeUrl: resolvedEndpoints.store,
            tokenServerUrl: resolvedEndpoints.token || payload.iss,
        }).withApiKey(token);
    }

    static decodeEndpoints() {}

    constructor(
        opts: VertesiaClientProps = {
            site: "api.vertesia.io",
        },
    ) {
        let studioServerUrl: string;
        let zenoServerUrl: string;

        if (opts.serverUrl) {
            studioServerUrl = opts.serverUrl;
        } else if (opts.site) {
            studioServerUrl = `https://${opts.site}`;
        } else {
            throw new Error(
                "Parameter 'site' or 'serverUrl' is required for VertesiaClient",
            );
        }

        if (opts.storeUrl) {
            zenoServerUrl = opts.storeUrl;
        } else if (opts.site) {
            zenoServerUrl = `https://${opts.site}`;
        } else {
            throw new Error(
                "Parameter 'site' or 'storeUrl' is required for VertesiaClient",
            );
        }

        super(studioServerUrl);

        if (opts.tokenServerUrl) {
            this.tokenServerUrl = opts.tokenServerUrl;
        } else if (opts.site) {
            // Preview uses production STS, staging uses its own STS
            if (opts.site === "api-preview.vertesia.io" || opts.site === "api.vertesia.io") {
                this.tokenServerUrl = "https://sts.vertesia.io";
            } else {
                this.tokenServerUrl = `https://${opts.site.replace(/^api/, "sts")}`;
            }
        } else if (opts.serverUrl || opts.storeUrl) {
            // Determine STS URL based on environment in serverUrl or storeUrl
            const urlToCheck = opts.serverUrl || opts.storeUrl || "";
            try {
                const url = new URL(urlToCheck);
                // Check for environment patterns
                if (url.hostname.includes("-production.")) {
                    // zeno-server-production.api.vertesia.io -> sts.vertesia.io
                    this.tokenServerUrl = "https://sts.vertesia.io";
                } else if (url.hostname.includes("-preview.")) {
                    // zeno-server-preview.api.vertesia.io -> sts.vertesia.io
                    this.tokenServerUrl = "https://sts.vertesia.io";
                } else if (url.hostname === "api.vertesia.io") {
                    this.tokenServerUrl = "https://sts.vertesia.io";
                } else if (url.hostname === "api-preview.vertesia.io") {
                    this.tokenServerUrl = "https://sts.vertesia.io";
                } else if (url.hostname === "api-staging.vertesia.io") {
                    this.tokenServerUrl = "https://sts-staging.vertesia.io";
                } else if (url.hostname.startsWith("api")) {
                    // Generic api.* pattern replacement
                    url.hostname = url.hostname.replace(/^api/, "sts");
                    this.tokenServerUrl = url.toString();
                } else {
                    // Default to staging for everything else
                    this.tokenServerUrl = "https://sts-staging.vertesia.io";
                }
            } catch (e) {
                // Default to staging if URL parsing fails
                this.tokenServerUrl = "https://sts-staging.vertesia.io";
            }
        } else {
            // Default to staging if no URL provided
            this.tokenServerUrl = "https://sts-staging.vertesia.io";
        }

        this.store = new ZenoClient({
            serverUrl: zenoServerUrl,
            tokenServerUrl: this.tokenServerUrl,
            apikey: opts.apikey,
            onRequest: opts.onRequest,
            onResponse: opts.onResponse,
        });

        if (opts.apikey) {
            this.withApiKey(opts.apikey);
        }

        this.onRequest = opts.onRequest;
        this.onResponse = opts.onResponse;
        this.sessionTags = opts.sessionTags;
    }

    withApiVersion(version: string | number | null) {
        if (!version) {
            delete this.headers[VERSION_HEADER];
        } else {
            this.headers[VERSION_HEADER] = String(version);
        }
        return this;
    }

    /**
     * Overwrite to keep store and composable clients synchronized on the auth callback
     * @param authCb
     * @returns
     */
    withAuthCallback(authCb?: (() => Promise<string>) | null) {
        this.store.withAuthCallback(authCb);
        return super.withAuthCallback(authCb);
    }

    async withApiKey(apiKey: string | null) {
        return this.withAuthCallback(
            apiKey
                ? async () => {
                      if (!isApiKey(apiKey)) {
                          return `Bearer ${apiKey}`;
                      }

                      if (isTokenExpired(this._jwt)) {
                          const jwt = await this.getAuthToken(apiKey);
                          this._jwt = jwt.token;
                      }
                      return `Bearer ${this._jwt}`;
                  }
                : undefined,
        );
    }

    async getRawJWT() {
        if (!this._jwt && this._auth) {
            const auth = await this._auth();
            if (!this._jwt) {
                // the _jwt may be set by the auth callback
                this._jwt = auth.trim().split(" ")[1]; // remove Bearer prefix
            }
        }
        return this._jwt || null;
    }

    async getDecodedJWT(): Promise<AuthTokenPayload | null> {
        const jwt = await this.getRawJWT();
        return jwt ? decodeJWT(jwt) : null;
    }

    async getProject() {
        const jwt = await this.getDecodedJWT();
        return jwt?.project || null;
    }

    async getAccount() {
        const jwt = await this.getDecodedJWT();
        return jwt?.account || null;
    }

    /**
     * Alias for store.workflows
     */
    get workflows() {
        return this.store.workflows;
    }

    /**
     * Alias for store.objects
     */
    get objects() {
        return this.store.objects;
    }

    get files() {
        return this.store.files;
    }

    /**
     * Alias for store.types
     */
    get types() {
        return this.store.types;
    }

    /**
     * Alias for store.data
     */
    get data() {
        return this.store.data;
    }

    get storeUrl() {
        return this.store.baseUrl;
    }

    /**
     *
     * Generate a token for use with other Vertesia's services
     *
     * @returns AuthTokenResponse
     */
    async getAuthToken(token?: string): Promise<AuthTokenResponse> {
        return fetch(`${this.tokenServerUrl}/token/issue`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        })
            .then((response) => response.json())
            .then((data) => data as AuthTokenResponse)
            .catch((error) => {
                console.error(
                    `Error fetching token from ${this.tokenServerUrl}:`,
                    { error },
                );
                throw error;
            });
    }

    get initialHeaders() {
        return {
            ...super.initialHeaders,
            [VERSION_HEADER]: VERSION
        }
    }

    projects = new ProjectsApi(this);
    environments = new EnvironmentsApi(this);
    interactions = new InteractionsApi(this);
    skills = new SkillsApi(this);
    prompts = new PromptsApi(this);
    runs = new RunsApi(this);
    account = new AccountApi(this);
    accounts = new AccountsApi(this);
    apikeys = new ApiKeysApi(this);
    analytics = new AnalyticsApi(this);
    auditTrail = new AuditTrailApi(this);
    training = new TrainingApi(this);
    users = new UsersApi(this);
    iam = new IamApi(this);
    refs = new RefsApi(this);
    commands = new CommandsApi(this);
    apps = new AppsApi(this);
    mcpOAuth = new MCPOAuthApi(this);
}

function isApiKey(apiKey: string) {
    return apiKey.startsWith("pk-") || apiKey.startsWith("sk-");
}

function isTokenExpired(token: string | null) {
    if (!token) {
        return true;
    }

    const decoded = decodeJWT(token);
    const exp = decoded.exp;
    const currentTime = Date.now();
    return currentTime <= exp * 1000 - EXPIRATION_THRESHOLD;
}

export function decodeJWT(jwt: string): AuthTokenPayload {
    const payloadBase64 = jwt.split(".")[1];
    const decodedJson = base64UrlDecode(payloadBase64);
    return JSON.parse(decodedJson);
}

function base64UrlDecode(input: string): string {
    // Convert base64url to base64
    const base64 = input
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        // Pad with '=' to make length a multiple of 4
        .padEnd(Math.ceil(input.length / 4) * 4, "=");

    if (typeof Buffer !== "undefined") {
        // Node.js
        return Buffer.from(base64, "base64").toString("utf-8");
    } else if (
        typeof atob !== "undefined" &&
        typeof TextDecoder !== "undefined"
    ) {
        // Browser
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        // decode to utf8
        return new TextDecoder().decode(bytes);
    } else {
        throw new Error("No base64 decoder available");
    }
}

export function decodeEndpoints(
    endpoints: string | Record<string, string> | undefined,
): Record<string, string> {
    if (!endpoints) {
        return getEndpointsFromDomain("api.vertesia.io");
    }
    if (typeof endpoints === "string") {
        return getEndpointsFromDomain(endpoints);
    } else {
        return endpoints;
    }
}

function getEndpointsFromDomain(domain: string) {
    if (domain === "local") {
        return {
            studio: `http://localhost:8091`,
            store: `http://localhost:8092`,
            token: process.env.STS_URL ?? "https://sts-staging.vertesia.io",
        };
    } else {
        const url = `https://${domain}`;
        return {
            studio: url,
            store: url,
            token: url.replace("api", "sts"),
        };
    }
}
