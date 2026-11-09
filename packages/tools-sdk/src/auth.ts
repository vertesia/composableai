import { decodeEndpoints, VertesiaClient } from '@vertesia/client';
import type { AuthTokenPayload } from '@vertesia/common';
import { assertTokenPermissionClaims } from '@vertesia/studio-utils/token-claims';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createLocalJWKSet, decodeJwt, type JSONWebKeySet, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { createMemoryScratch, type ToolScratch } from './scratch.js';
import type { ToolExecutionContext } from './types.js';

const cache: Record<string, JWTVerifyGetKey> = {};

export async function getJwks(url: string) {
    if (!cache[url]) {
        console.log('JWKS cache miss for: ', url);
        const jwks = await fetch(url)
            .then((r) => {
                if (r.ok) {
                    return r.json() as Promise<JSONWebKeySet>;
                }
                throw new Error(`Fetching jwks failed with code: ${r.status}`);
            })
            .catch((err) => {
                throw new Error(`Failed to fetch jwks: ${err.message}`);
            });
        cache[url] = createLocalJWKSet(jwks);
    }
    return cache[url];
}

export async function verifyToken(token: string) {
    const decodedJwt = decodeJwt(token);
    if (!decodedJwt.iss) {
        throw new Error('No issuer URL found in JWT');
    }
    if (!isAllowedIssuer(decodedJwt.iss)) {
        throw new Error(`Issuer is not allowed: ${decodedJwt.iss}`);
    }
    const jwks = await getJwks(`${decodedJwt.iss}/.well-known/jwks`);
    const verified = await jwtVerify<AuthTokenPayload>(token, jwks, { issuer: decodedJwt.iss });
    // This SDK has its own authentication boundary, independent of cloud's verifyAuthToken.
    // Validate once here so tool handlers can use the final claims directly.
    assertTokenPermissionClaims(verified.payload);
    return verified;
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

/** Sandbox authorization never accepts a credential supplied by the guest request. */
export async function authorizeSandbox(
    ctx: Context,
    _endpointOverrides?: EndpointOverrides,
    _toolContext?: ToolContext,
) {
    const session = ctx.get('toolAuthSession') as AuthSession | undefined;
    if (!session) throw new HTTPException(401, { message: 'Missing sandbox host session' });
    return session;
}

export async function authorize(ctx: Context, endpointOverrides?: EndpointOverrides, toolContext?: ToolContext) {
    if (ctx.get('toolAuthMode') === 'sandbox') return authorizeSandbox(ctx);
    // A sandbox host can bind a session in application middleware. HTTP headers cannot set this value.
    const boundSession = ctx.get('toolAuthSession') as AuthSession | undefined;
    if (boundSession) return boundSession;
    const auth = ctx.req.header('Authorization');
    if (!auth) {
        throw new HTTPException(401, {
            message: `Missing Authorization header`,
        });
    }
    const [scheme, value] = auth.trim().split(' ');
    if (scheme.toLowerCase() !== 'bearer') {
        throw new HTTPException(401, {
            message: `Authorization scheme ${scheme} is not supported`,
        });
    }
    if (!value) {
        throw new HTTPException(401, {
            message: `Missing bearer token value`,
        });
    }
    try {
        const { payload } = await verifyToken(value);
        assertAllowedOrg(payload);
        const session = new AuthSession(value, payload, endpointOverrides, toolContext);
        ctx.set('auth', session);
        return session;
    } catch (err: unknown) {
        if (err instanceof HTTPException) throw err;
        const message = err instanceof Error ? err.message : String(err);
        throw new HTTPException(401, {
            message,
            cause: err,
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
    private _scratch: ToolScratch | undefined;

    constructor(
        public token: string,
        public payload: AuthTokenPayload,
        endpointOverrides?: EndpointOverrides,
        toolContext?: ToolContext,
        scratch?: ToolScratch,
    ) {
        this._scratch = scratch;
        const decoded = decodeEndpoints(payload.endpoints);
        // Use overrides from workflow config if provided, falling back to JWT endpoints
        this.endpoints = {
            studio: endpointOverrides?.studio || decoded.studio,
            store: endpointOverrides?.store || decoded.store,
            token: endpointOverrides?.token || decoded.token || payload.iss,
        };
        this.toolContext = toolContext;
    }

    /** One store per session, which is one per request; created on first use. */
    get scratch(): ToolScratch {
        this._scratch ??= createMemoryScratch();
        return this._scratch;
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

/** Vertesia's token servers live under these domains. */
const TRUSTED_ISSUER_DOMAINS = ['vertesia.io', 'becomposable.com'];

/**
 * A Vertesia token server's host: `sts` or `sts-<tier>`, then at most two region labels, then a trusted domain, such
 * as `sts.vertesia.io`, `sts.us1.vertesia.io` or `sts-preview.eu1.harness.vertesia.io`.
 */
const TOKEN_SERVER_HOST = /^sts(?:-[a-z0-9]+)?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?){0,2}$/;

/**
 * The issuer names the server this SDK fetches verification keys from, so a suffix match on the raw string is not
 * enough: `https://attacker.example/x.vertesia.io` ends with `.vertesia.io` too, and other hosts under a trusted
 * domain serve content that is not Vertesia's token server. A built-in issuer must be exactly an HTTPS origin, with
 * no path, port or credentials, whose host has the shape of a Vertesia token server under a trusted domain. Any other
 * issuer must be listed in VERTESIA_TRUSTED_ISSUERS.
 */
export function isAllowedIssuer(iss: string): boolean {
    if (getTrustedIssuers().has(iss)) return true;
    let url: URL;
    try {
        url = new URL(iss);
    } catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.port !== '' || url.origin !== iss) return false;
    return TRUSTED_ISSUER_DOMAINS.some((domain) => {
        const suffix = `.${domain}`;
        return url.hostname.endsWith(suffix) && TOKEN_SERVER_HOST.test(url.hostname.slice(0, -suffix.length));
    });
}

/**
 * VERTESIA_TRUSTED_ISSUERS (comma-separated issuer URLs) trusts additional token issuers, such as a local
 * token server (http://localhost:8202). An issuer must match an entry exactly; a trailing slash on an entry
 * is ignored. Unset by default, which trusts no issuer beyond the built-in domains.
 */
let _trustedIssuers: Set<string> | undefined;
function getTrustedIssuers(): Set<string> {
    if (_trustedIssuers === undefined) {
        _trustedIssuers = new Set(
            (process.env.VERTESIA_TRUSTED_ISSUERS ?? '')
                .split(',')
                .map((s) => s.trim().replace(/\/+$/, ''))
                .filter(Boolean),
        );
    }
    return _trustedIssuers;
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
            ? new Set(
                  raw
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
              )
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
