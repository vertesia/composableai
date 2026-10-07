import type { IRequestParams } from '@vertesia/api-fetch-client';
import { EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE, VERSION_HEADER } from '@vertesia/common';

export type CanonicalInteractionRequestOptions = Pick<IRequestParams, 'headers' | 'signal' | 'timeoutMs'>;

/** Applies the exact experimental version after removing case-insensitive caller overrides. */
export function canonicalInteractionHeaders(headers?: Record<string, string> | null): Record<string, string> {
    const versionHeader = VERSION_HEADER.toLowerCase();
    return {
        ...Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => name.toLowerCase() !== versionHeader)),
        [VERSION_HEADER]: EXPERIMENTAL_CANONICAL_INTERACTION_API_VERSION_HEADER_VALUE,
    };
}
