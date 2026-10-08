/** Public runtime contracts use prebuilt JSON Schema and never load Zod. */
import type { JsonObject } from '../api-schemas/adapter.js';
import API_SCHEMA_COMPONENTS from './components.generated.json' with { type: 'json' };
import { createApiContract } from './engine.js';
import type { ApiComponentName, ApiComponentType } from './types.js';

export type { JsonObject } from '../api-schemas/adapter.js';
export type {
    ApiParameterLocation,
    NormalizedApiParameters,
    RawApiParameters,
} from '../api-schemas/parameters.js';
export type { ApiValidationIssue, PruneAndValidateResult, ValidateApiPayloadResult } from './engine.js';
export { createApiContract } from './engine.js';
export type { ApiComponentName, ApiComponentType } from './types.js';

export const ApiSchemaComponents: Readonly<Record<string, JsonObject>> = API_SCHEMA_COMPONENTS;

type ComponentTypes = { [N in ApiComponentName]: ApiComponentType<N> };
type RuntimeContract = ReturnType<typeof createApiContract<ComponentTypes>>;
const contract = createApiContract<ComponentTypes>(ApiSchemaComponents);
export const bundleCanonicalComponent: RuntimeContract['bundleCanonicalComponent'] = contract.bundleCanonicalComponent;
export const apiComponentRef: RuntimeContract['apiComponentRef'] = contract.apiComponentRef;
export const renderApiValidationIssue: RuntimeContract['renderApiValidationIssue'] = contract.renderApiValidationIssue;
export const renderApiValidationIssueHead: RuntimeContract['renderApiValidationIssueHead'] =
    contract.renderApiValidationIssueHead;
export const validateApiRequest: RuntimeContract['validateApiRequest'] = contract.validateApiRequest;
export const validateApiResponse: RuntimeContract['validateApiResponse'] = contract.validateApiResponse;
export const pruneApiResponse: RuntimeContract['pruneApiResponse'] = contract.pruneApiResponse;
export const pruneAndValidateApiResponse: RuntimeContract['pruneAndValidateApiResponse'] =
    contract.pruneAndValidateApiResponse;
export const findUnprunableApiPaths: RuntimeContract['findUnprunableApiPaths'] = contract.findUnprunableApiPaths;
export const normalizeApiParameters: RuntimeContract['normalizeApiParameters'] = contract.normalizeApiParameters;
