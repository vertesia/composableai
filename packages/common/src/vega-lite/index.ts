/**
 * Vega-Lite Utilities
 *
 * Shared utilities for processing Vega-Lite specifications.
 * Used by both client (UI) and server (tools) code.
 */

export {
    type ArtifactReference,
    findArtifactReferences,
    replaceArtifactData,
    fixVegaLiteSelectionParams,
    applyParameterValues,
} from './spec-utils.js';

export {
    type UrlScheme,
    type ParsedUrl,
    parseUrlScheme,
    needsResolution,
    mapSchemeToRoute,
} from './url-schemes.js';
