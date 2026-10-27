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

/**
 * Give a data-store import its own `import_id` under the same opt-in as {@link withIdempotencyKey}. The server
 * takes the ID as the import job's ObjectId and refuses an unknown one older than 24 hours, so it is a fresh
 * ObjectId: the current time in seconds, then random bytes.
 */
export function withImportId<T extends { import_id?: string }>(client: ClientBase, payload: T): T {
    if (payload.import_id || !client.getRetryPolicy()?.idempotencyKeys) {
        return payload;
    }
    const seconds = Math.floor(Date.now() / 1000)
        .toString(16)
        .padStart(8, '0');
    return { ...payload, import_id: seconds + generateIdempotencyKey().replaceAll('-', '').slice(0, 16) };
}
