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
    const { studio } = decodeEndpoints(decodedJwt.endpoints as any);
    if (!studio) {
        throw new Error("No studio endpoint found in JWT");
    }
    const jwks = await getJwks(`${studio}/.well-known/jwks`);
    return await jwtVerify<AuthTokenPayload>(token, jwks);
}



export async function authorize(ctx: Context) {
    const auth = ctx.req.header('Authorization');
    if (!auth) {
        throw new HTTPException(401, {
            message: `Missing Authorization header'`
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
        const session = new AuthSession(value, payload);
        ctx.set("auth", session);
        return session;
    } catch (err: any) {
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
    };

    constructor(public token: string, public payload: AuthTokenPayload) {
        this.endpoints = decodeEndpoints(payload.endpoints) as {
            studio: string, store: string
        };
    }

    async getClient() {
        if (!this._client) {
            this._client = await VertesiaClient.fromAuthToken(this.token, this.payload);
        }
        return this._client;
    }
}