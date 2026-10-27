/**
 * Idempotency-Key wire contract for `POST` requests.
 *
 * A client that may retry a `POST` sends one key per logical request and reuses it on every attempt.
 * The server runs the first request it sees with that key and answers every later one with the
 * stored response of the first, so a retry never repeats the effect. `@vertesia/api-fetch-client`
 * sends the header when a retry policy sets `idempotencyKeys`, and declares the same spellings.
 */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Set to `in-progress` on the `409` answering a request whose key another request is still running. */
export const IDEMPOTENCY_STATUS_HEADER = 'idempotency-status';

/** Set to `true` on a response the server replayed from an earlier request with the same key. */
export const IDEMPOTENT_REPLAYED_HEADER = 'idempotent-replayed';

/** Longest key the server accepts. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 256;
