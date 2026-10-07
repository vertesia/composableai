/** Public runtime contracts use prebuilt JSON Schema and never load Zod. */
import type { JsonObject } from '../api-schemas/adapter.js';
import type { ApiComponentName, ApiComponentType } from '../api-schemas/registry.js';
import API_SCHEMA_COMPONENTS from './components.generated.json' with { type: 'json' };
import { createApiContract } from './engine.js';

export type {
    ApiParameterLocation,
    NormalizedApiParameters,
    RawApiParameters,
} from '../api-schemas/parameters.js';
export type { ApiComponentName, ApiComponentType } from '../api-schemas/registry.js';
export type { ApiValidationIssue, PruneAndValidateResult, ValidateApiPayloadResult } from './engine.js';
export { createApiContract } from './engine.js';

export const ApiSchemaComponents: Readonly<Record<string, JsonObject>> = API_SCHEMA_COMPONENTS;

export const {
    bundleCanonicalComponent,
    apiComponentRef,
    renderApiValidationIssue,
    renderApiValidationIssueHead,
    validateApiRequest,
    validateApiResponse,
    pruneApiResponse,
    pruneAndValidateApiResponse,
    findUnprunableApiPaths,
    normalizeApiParameters,
} = createApiContract<{ [N in ApiComponentName]: ApiComponentType<N> }>(ApiSchemaComponents);
