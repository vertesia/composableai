import { type ClientBase, generateIdempotencyKey } from '@vertesia/api-fetch-client';

/**
 * Give a create request its own `idempotency_key` when the client's retry policy asks for idempotency
 * keys and the caller set none, so a retried attempt returns what the first one created instead of
 * creating it again. The server stores the key with the resource it creates. A caller's key, or a
 * client without the opt-in, leaves the payload unchanged.
 */
export function withIdempotencyKey<T extends { idempotency_key?: string }>(client: ClientBase, payload: T): T {
    if (payload.idempotency_key || !client.getRetryPolicy()?.idempotencyKeys) {
        return payload;
    }
    return { ...payload, idempotency_key: generateIdempotencyKey() };
}
