import type { z } from 'zod';
import type { UserInviteTokenDataSchema, UserInviteTokenFromSchema } from './api-schemas/invites.js';
import type { TransientTokenType } from './transient-tokens-values.js';

/**
 * `TransientTokenType` lives in `./transient-tokens-values.js` so the API schemas can read it
 * without importing this module back. Re-exported here so import paths keep working.
 */
export * from './transient-tokens-values.js';

export interface TransientToken<T> {
    id: string;
    type: TransientTokenType;
    data: T;
    expires: Date;
    account?: string;
    created_at: Date;
    updated_at: Date;
}

/**
 * The invite payload as it crosses the wire, inferred from `./api-schemas/invites.js`. Every
 * reference is populated by the handlers before the response is built.
 */
export type UserInviteTokenData = z.infer<typeof UserInviteTokenDataSchema>;

/** One pending invite, as the three invite listings publish it. */
export type UserInviteToken = UserInviteTokenFromSchema;
