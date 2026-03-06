import { decodeEndpoints, VertesiaClient } from "@vertesia/client";
import { AuthTokenPayload } from "@vertesia/common";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { createLocalJWKSet, decodeJwt, JSONWebKeySet, jwtVerify, JWTVerifyGetKey } from "jose";
import { ToolExecutionContext } from "./types.js";
const cache: Record<string, JWTVerifyGetKey> = {};

export async function getJwks(url: string) {
    if (!cache.url) {
        console.log('JWKS cache miss for: ', url);
        const jwks = await fetch(url).then(r => {
            if (r.ok) {
                return r.json() as Promise<JSONWebKeySet>;
            }
            throw new Error("Fetching jwks failed with code: " + r.status);
        }).catch(err => {
            throw new Error("Failed to fetch jwks: " + err.message);
        })
        cache.url = createLocalJWKSet(jwks);
    }
    return cache.url;
}

export async function verifyToken(token: string) {
    const decodedJwt = decodeJwt(token);
    if (!decodedJwt.iss) {
        throw new Error("No issuer URL found in JWT");
    }
    if (!isAllowedIssuer(decodedJwt.iss)) {
        throw new Error("Issuer is not allowed: " + decodedJwt.iss);
    }
    const jwks = await getJwks(`${decodedJwt.iss}/.well-known/jwks`);
    return await jwtVerify<AuthTokenPayload>(token, jwks);
}


export interface EndpointOverrides {
    studio?: string;
    store?: string;
    token?: string;
}

export interface ToolContext {
    toolName?: string;
    toolUseId?: string;
    runId?: string;
}

export async function authorize(ctx: Context, endpointOverrides?: EndpointOverrides, toolContext?: ToolContext) {
    const auth = ctx.req.header('Authorization');
    if (!auth) {
        throw new HTTPException(401, {
            message: `Missing Authorization header`
        });
    }
    const [scheme, value] = auth.trim().split(' ');
    if (scheme.toLowerCase() !== 'bearer') {
        throw new HTTPException(401, {
            message: `Authorization scheme ${scheme} is not supported`
        });
    }
    if (!value) {
        throw new HTTPException(401, {
            message: `Missing bearer token value`
        });
    }
    try {
        const { payload } = await verifyToken(value);
        assertAllowedOrg(payload);
        const session = new AuthSession(value, payload, endpointOverrides, toolContext);
        ctx.set("auth", session);
        return session;
    } catch (err: any) {
        if (err instanceof HTTPException) throw err;
        throw new HTTPException(401, {
            message: err.message,
            cause: err
        });
    }
}

export class AuthSession implements ToolExecutionContext {
    _client: VertesiaClient | undefined;
    endpoints: {
        studio: string;
        store: string;
        token: string;
    };
    toolContext?: ToolContext;

    constructor(
        public token: string,
        public payload: AuthTokenPayload,
        endpointOverrides?: EndpointOverrides,
        toolContext?: ToolContext
    ) {
        const decoded = decodeEndpoints(payload.endpoints);
        // Use overrides from workflow config if provided, falling back to JWT endpoints
        this.endpoints = {
            studio: endpointOverrides?.studio || decoded.studio,
            store: endpointOverrides?.store || decoded.store,
            token: endpointOverrides?.token || decoded.token || payload.iss,
        };
        this.toolContext = toolContext;
    }

    async getClient() {
        if (!this._client) {
            const toolInfo = this.toolContext?.toolName ? ` for ${this.toolContext.toolName}` : '';
            console.log(`[VertesiaClient] Initializing client${toolInfo}`, {
                tool: this.toolContext?.toolName,
                toolUseId: this.toolContext?.toolUseId,
                runId: this.toolContext?.runId,
                endpoints: this.endpoints,
            });
            this._client = await VertesiaClient.fromAuthToken(this.token, this.payload, this.endpoints);
        }
        return this._client;
    }
}

function isAllowedIssuer(iss: string) {
    return iss.endsWith(".vertesia.io") || iss.endsWith(".becomposable.com");
}

/**
 * If VERTESIA_ALLOWED_ORGS is set (comma-separated org IDs), restrict access
 * to only those organizations. If not set, all authenticated orgs are allowed.
 */
let _allowedOrgs: Set<string> | null | undefined;
function getAllowedOrgs(): Set<string> | null {
    if (_allowedOrgs === undefined) {
        const raw = process.env.VERTESIA_ALLOWED_ORGS;
        _allowedOrgs = raw
            ? new Set(raw.split(',').map(s => s.trim()).filter(Boolean))
            : null;
    }
    return _allowedOrgs;
}

function assertAllowedOrg(payload: AuthTokenPayload) {
    const allowed = getAllowedOrgs();
    if (!allowed) return;
    if (!allowed.has(payload.account.id)) {
        throw new HTTPException(403, {
            message: `Organization ${payload.account.name} is not authorized to access this server`,
        });
    }
}
