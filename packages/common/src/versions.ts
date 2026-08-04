/**
 * The header a caller names an API version in, as `YYYYMMDD` — see {@link ApiVersions}.
 *
 * Declared here rather than in the client, because both ends of the negotiation need it: the
 * servers register it with `withVersionHeader` and read it when deciding how strictly to hold a
 * request to its published schema, and `@vertesia/client` sets it on every call. It kept the
 * spelling it has always had on the wire.
 */
export const VERSION_HEADER = 'x-api-version';

export enum ApiVersions {
    COMPLETION_RESULT_V1 = 20250925,
    DOWNLOAD_URL_NO_MIME_TYPE_V1 = 20260210,
    MEDIA_BLOB_STORAGE_V1 = 20260319,
    /**
     * Request bodies and parameters are rejected when they do not match the published component.
     *
     * The endpoints did not change shape at this date — the schemas they had always published
     * started being enforced. A body carrying an undeclared property against a closed component,
     * or a query parameter of the wrong type, used to be accepted and silently ignored; from here
     * it is a 400.
     *
     * Unlike the milestones above, this one is not about a route: it gates the enforcement policy
     * itself, so a caller pinned below it gets the old lenient behaviour on EVERY endpoint while
     * the mismatch is logged. Sending nothing means the current API, so the strict reading is what
     * a new caller gets by default and leniency has to be asked for.
     */
    REQUEST_CONTRACT_ENFORCEMENT_V1 = 20260803,
}

/**
 * The API version used by current clients and published as the current OpenAPI shape.
 *
 * Keep this explicit rather than deriving it at runtime: promoting a milestone to the client
 * default is a deliberate compatibility decision. The versions test ensures this alias is
 * reconsidered whenever a newer milestone is added.
 */
export const CURRENT_API_VERSION = ApiVersions.REQUEST_CONTRACT_ENFORCEMENT_V1;

/** The current API version formatted for the {@link VERSION_HEADER} wire value. */
export const CURRENT_API_VERSION_HEADER_VALUE = String(CURRENT_API_VERSION);
