import { type ClientBase, generateIdempotencyKey } from '@vertesia/api-fetch-client';

/**
 * Give an agent-run start its own `idempotency_key` when the client's retry policy asks for
 * idempotency keys and the caller set none.
 *
 * The `Idempotency-Key` header that policy sends is held by the server for a short time only; the
 * body key is stored with the run, so it also covers a retry that arrives after the server lost
 * track of the first attempt. A caller's key, or a client without the opt-in, leaves the payload
 * unchanged.
 */
export function withRunIdempotencyKey<T extends { idempotency_key?: string }>(client: ClientBase, payload: T): T {
    if (payload.idempotency_key || !client.getRetryPolicy()?.idempotencyKeys) {
        return payload;
    }
    return { ...payload, idempotency_key: generateIdempotencyKey() };
}
