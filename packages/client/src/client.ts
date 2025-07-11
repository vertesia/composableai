import { AbstractFetchClient } from "@vertesia/api-fetch-client";
import { AuthTokenPayload, AuthTokenResponse } from "@vertesia/common";
import AccountApi from "./AccountApi.js";
import AccountsApi from "./AccountsApi.js";
import AnalyticsApi from "./AnalyticsApi.js";
import { ApiKeysApi } from "./ApiKeysApi.js";
import AppsApi from "./AppsApi.js";
import CommandsApi from "./CommandsApi.js";
import EnvironmentsApi from "./EnvironmentsApi.js";
import { IamApi } from "./IamApi.js";
import InteractionsApi from "./InteractionsApi.js";
import ProjectsApi from "./ProjectsApi.js";
import PromptsApi from "./PromptsApi.js";
import { RefsApi } from "./RefsApi.js";
import { RunsApi } from "./RunsApi.js";
import { ZenoClient } from "./store/client.js";
import TrainingApi from "./TrainingApi.js";
import UsersApi from "./UsersApi.js";

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
    site?: 'api.vertesia.io' | 'api-preview.vertesia.io' | 'api-staging.vertesia.io';
    serverUrl?: string;
    storeUrl?: string;
    apikey?: string;
    projectId?: string;
    sessionTags?: string | string[];
    onRequest?: (request: Request) => void;
    onResponse?: (response: Response) => void;
}

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
     * Create a client from the given token. 
     * If you already have the decoded token you can pass it as the second argument to avoid decodinf it again.
     * 
     * @param token the raw JWT token
     * @param payload the decoded JWT token as an AuthTokenPayload - optional
     */
    static async fromAuthToken(token: string, payload?: AuthTokenPayload) {
        if (!payload) {
            payload = decodeJWT(token);
        }
        const endpoints = decodeEndpoints(payload!.endpoints);
        return await new VertesiaClient({
            serverUrl: endpoints.studio,
            storeUrl: endpoints.store
        }).withApiKey(token);
    }

    static decodeEndpoints() {

    }

    constructor(
        opts: VertesiaClientProps = {
            site: 'api.vertesia.io',
        }
    ) {
        let studioServerUrl: string;
        let zenoServerUrl: string;

        if (opts.serverUrl) {
            studioServerUrl = opts.serverUrl;
        } else if (opts.site) {
            studioServerUrl = `https://${opts.site}`;
        } else {
            throw new Error("Parameter 'site' or 'serverUrl' is required for VertesiaClient");
        }

        if (opts.storeUrl) {
            zenoServerUrl = opts.storeUrl;
        } else if (opts.site) {
            zenoServerUrl = `https://${opts.site}`;
        } else {
            throw new Error("Parameter 'site' or 'storeUrl' is required for VertesiaClient");
        }

        super(studioServerUrl);

        this.store = new ZenoClient({
            serverUrl: zenoServerUrl,
            apikey: opts.apikey,
            onRequest: opts.onRequest,
            onResponse: opts.onResponse
        });

        if (opts.apikey) {
            this.withApiKey(opts.apikey);
        }
        //TODO: this is no more used, remove in next major version
        if (opts.projectId) {
            this.headers["x-project-id"] = opts.projectId;
        }
        this.onRequest = opts.onRequest;
        this.onResponse = opts.onResponse;
        this.sessionTags = opts.sessionTags;
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
            apiKey ? async () => {
                if (!isApiKey(apiKey)) {
                    return `Bearer ${apiKey}`
                }

                if (isTokenExpired(this._jwt)) {
                    const jwt = await this.getAuthToken(apiKey);
                    this._jwt = jwt.token;
                }
                return `Bearer ${this._jwt}`
            } : undefined
        );
    }

    async getRawJWT() {
        if (!this._jwt && this._auth) {
            const auth = await this._auth();
            if (!this._jwt) { // the _jwt may be set by the auth callback
                this._jwt = auth.trim().split(' ')[1]; // remove Bearer prefix
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

    get storeUrl() {
        return this.store.baseUrl;
    }


    /**
     *
     * Generate a token for use with other Composable's services
     *
     * @param accountId: selected account to generate the token for
     * @returns AuthTokenResponse
     */
    async getAuthToken(token?: string, accountId?: string): Promise<AuthTokenResponse> {
        const query = {
            accountId,
            token
        };

        return this.get('/auth/token', { query: query, headers: { "authorization": undefined } as any });
    }

    projects = new ProjectsApi(this);
    environments = new EnvironmentsApi(this);
    interactions = new InteractionsApi(this);
    prompts = new PromptsApi(this);
    runs = new RunsApi(this);
    account = new AccountApi(this);
    accounts = new AccountsApi(this);
    apikeys = new ApiKeysApi(this);
    analytics = new AnalyticsApi(this);
    training = new TrainingApi(this);
    users = new UsersApi(this);
    iam = new IamApi(this);
    refs = new RefsApi(this);
    commands = new CommandsApi(this);
    apps = new AppsApi(this);
}

function isApiKey(apiKey: string) {
    return (apiKey.startsWith('pk-') || apiKey.startsWith('sk-'));
}

function isTokenExpired(token: string | null) {
    if (!token) {
        return true;
    }

    const decoded = decodeJWT(token);
    const exp = decoded.exp;
    const currentTime = Date.now();
    return (currentTime <= exp * 1000 - EXPIRATION_THRESHOLD);
}

export function decodeJWT(jwt: string): AuthTokenPayload {
    const payloadBase64 = jwt.split('.')[1];
    const decodedJson = base64UrlDecode(payloadBase64);
    return JSON.parse(decodedJson)
}

function base64UrlDecode(input: string): string {
    // Convert base64url to base64
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
        // Pad with '=' to make length a multiple of 4
        .padEnd(Math.ceil(input.length / 4) * 4, '=');

    if (typeof Buffer !== 'undefined') {
        // Node.js
        return Buffer.from(base64, 'base64').toString('utf-8');
    } else if (typeof atob !== 'undefined' && typeof TextDecoder !== 'undefined') {
        // Browser
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        // decode to utf8
        return new TextDecoder().decode(bytes);
    } else {
        throw new Error('No base64 decoder available');
    }
}

export function decodeEndpoints(endpoints: string | Record<string, string> | undefined): Record<string, string> {
    if (!endpoints) {
        return getEndpointsFromDomain("api.vertesia.io")
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
        }
    } else {
        const url = `https://${domain}`;
        return {
            studio: url,
            store: url,
        }
    }
}
