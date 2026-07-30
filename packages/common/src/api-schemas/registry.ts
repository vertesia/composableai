import type { ValidateFunction } from 'ajv/dist/2020.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { z } from 'zod';
import { AccountSchema, StripeBillingStatusResponseSchema, UpdateAccountPayloadSchema } from './account.js';
import { findUnprunablePaths, type JsonObject, pruneToSchema, toOpenApiComponents } from './adapter.js';
import { ApiKeyListQuerySchema } from './apikey.js';
import {
    type ApiParameterLocation,
    type NormalizedApiParameters,
    normalizeParameters,
    type RawApiParameters,
} from './parameters.js';
import { QuotaStandingResponseSchema, QuotaTierResponseSchema } from './quota.js';
import {
    DeleteByIdResultSchema,
    PrincipalIdentitySchema,
    UpdateUserPayloadSchema,
    UserArraySchema,
    UserSchema,
} from './user.js';

// ajv-formats is CommonJS with an ESM-style declaration file. Node's interop makes the default
// import the whole `module.exports` (itself callable), while TypeScript sees the namespace — and
// `.default` is the plugin function in both shapes.
const addFormats = ajvFormats.default;

/**
 * Endpoint-level API schemas, keyed by the OpenAPI component name they publish under.
 *
 * Only schemas referenced directly by an endpoint belong here. Nested schemas carrying an id
 * (`AccountBilling`, the Stripe union members) are hoisted into components automatically by the
 * adapter, so listing them here would be redundant.
 */
const API_SCHEMAS = {
    Account: AccountSchema,
    UpdateAccountPayload: UpdateAccountPayloadSchema,
    StripeBillingStatusResponse: StripeBillingStatusResponseSchema,
    ApiKeyListQuery: ApiKeyListQuerySchema,
    QuotaStandingResponse: QuotaStandingResponseSchema,
    QuotaTierResponse: QuotaTierResponseSchema,
    User: UserSchema,
    UserArray: UserArraySchema,
    UpdateUserPayload: UpdateUserPayloadSchema,
    DeleteByIdResult: DeleteByIdResultSchema,
    PrincipalIdentity: PrincipalIdentitySchema,
} as const satisfies Record<string, z.ZodType>;

export type ApiComponentName = keyof typeof API_SCHEMAS;

/**
 * Components that reject undeclared properties.
 *
 * These are the components the TypeScript-derived spec ALREADY published as
 * `additionalProperties: false`. Publishing them open would loosen the documented contract, which
 * is a bigger change than anything this migration is meant to make — the point is to source the
 * same contract from a runtime schema, not to renegotiate it.
 *
 * These are enforced, not merely documented: {@link validateApiRequest} compiles these exact
 * objects, so a body carrying an undeclared property is rejected rather than quietly accepted.
 */
const STRICT_COMPONENTS: ReadonlySet<string> = new Set<string>([
    'Account',
    'AccountBilling',
    'UpdateAccountPayload',
    'StripeBillingEnabled',
    'StripeBillingDisabled',
    'ApiKeyListQuery',
    // The quota closure. Every object here is published closed today, so all of them are listed;
    // QuotaEffectiveTier is a string and takes no additionalProperties at all.
    'QuotaStandingResponse',
    'QuotaStandingResource',
    'QuotaStandingWindow',
    'QuotaStandingAdmissionClass',
    'QuotaTierResponse',
    // The IAM closure. PrincipalContext is composed into PrincipalIdentity rather than hoisted,
    // so it has no component of its own to list.
    'User',
    'UpdateUserPayload',
    'DeleteByIdResult',
    'PrincipalIdentity',
]);

/**
 * Emits raw JSON Schema for each registered schema.
 *
 * `io: 'input'` is deliberate and is NOT a request/response distinction — it selects the
 * permissive emission in which `additionalProperties` is omitted. Request and response contracts
 * that differ in fields or secret exposure need genuinely separate schemas; one schema cannot
 * serve both. The adapter applies the open/closed policy explicitly afterwards.
 *
 * `toJSONSchema` throws on constructs that cannot be represented (notably `.transform()`), which
 * is the guard we want: an API schema that cannot be published is a build failure, not a silent
 * divergence. Note that `.refine()` is silently DROPPED rather than rejected, so refinements must
 * not be used to express contract rules — they would be invisible to both the spec and AJV.
 */
function emitRawSchemas(): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(API_SCHEMAS).map(([name, schema]) => [
            name,
            z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' }),
        ]),
    );
}

/**
 * The canonical `components.schemas` for the migrated endpoints.
 *
 * This exact object is what the OpenAPI spec publishes AND what AJV compiles, so the published
 * contract and the enforced contract cannot diverge.
 */
export const ApiSchemaComponents: Readonly<Record<string, JsonObject>> = toOpenApiComponents(emitRawSchemas(), {
    strictComponents: STRICT_COMPONENTS,
});

/** The `$ref` pointer for a component, in the same spelling the spec publishes. */
export function apiComponentRef(name: ApiComponentName): string {
    return `#/components/schemas/${name}`;
}

/** The wire type a component publishes. */
export type ApiComponentType<N extends ApiComponentName> = z.infer<(typeof API_SCHEMAS)[N]>;

/**
 * Names a published component from inside an `@apiDoc` slot:
 * `apiOk<ApiSchemaOf<'Account'>>('The account.')`.
 *
 * It is `ApiComponentType` under a different name, and the rename carries the whole point. To
 * TypeScript it is the wire type, so the handler's return type is checked against the same schema
 * the spec publishes. To the OpenAPI scanner it is a marker: seeing `ApiSchemaOf<'X'>` it emits
 * `#/components/schemas/X` verbatim from {@link ApiSchemaComponents} instead of deriving a schema
 * from the TypeScript type. Derivation is what the two could disagree about, so there is nothing
 * left to drift.
 *
 * The component name must be a literal — the scanner reads source text and cannot evaluate an
 * expression. An unknown name fails the type check here and fails spec generation there.
 */
export type ApiSchemaOf<N extends ApiComponentName> = ApiComponentType<N>;

/**
 * Validators compiled against the published components, through an envelope so the pointer AJV
 * resolves is the exact pointer the spec publishes. `strictSchema: false` tolerates the
 * `components` wrapper while leaving type and tuple checks active.
 *
 * Compiled lazily and cached: AJV compilation is the expensive step, and most components are
 * never validated in a given process.
 */
const validators = new Map<string, ValidateFunction>();

function getValidator(name: ApiComponentName): ValidateFunction {
    const cached = validators.get(name);
    if (cached) return cached;
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    // Without this, AJV treats `format` as an annotation and ignores it, so a `date-time` property
    // would document a constraint nothing checks — the exact spec/enforcement gap this design is
    // meant to close.
    addFormats(ajv);
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: ApiSchemaComponents } });
    const validate = ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name)}` });
    validators.set(name, validate);
    return validate;
}

function formatErrors(validate: ValidateFunction): string[] {
    return (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`);
}

export type ValidateApiPayloadResult<T> = { valid: true; data: T } | { valid: false; errors: string[] };

/**
 * Validates an untyped request body against the component the endpoint publishes.
 *
 * Non-mutating by design. AJV's removal modes are never used here: the server would then accept a
 * body the published schema declares invalid, silently disagreeing with its own spec — and
 * `removeAdditional: 'all'` additionally empties freeform maps. An undeclared property is reported,
 * not deleted.
 *
 * The component type is handed back only on the `valid` branch, so a body missing required fields
 * cannot be typed as complete. What the caller does with a failure — reject, or log and continue —
 * is the endpoint's policy, not this function's.
 */
export function validateApiRequest<N extends ApiComponentName>(
    name: N,
    value: unknown,
): ValidateApiPayloadResult<ApiComponentType<N>> {
    const validate = getValidator(name);
    if (validate(value)) {
        return { valid: true, data: value as ApiComponentType<N> };
    }
    return { valid: false, errors: formatErrors(validate) };
}

/**
 * Validates an already-mapped response against the component it is published as.
 *
 * Separate from {@link pruneAndValidateApiResponse} because a resource mapper has already produced
 * the wire shape: there is nothing to prune, and pruning would only mask a mapper bug. Use this at
 * the response boundary to detect drift between what the mapper builds and what the spec promises.
 */
export function validateApiResponse<N extends ApiComponentName>(
    name: N,
    value: unknown,
): ValidateApiPayloadResult<ApiComponentType<N>> {
    const validate = getValidator(name);
    if (validate(value)) {
        return { valid: true, data: value as ApiComponentType<N> };
    }
    return { valid: false, errors: formatErrors(validate) };
}

/**
 * Best-effort normalization of a response payload towards the fields its published component
 * declares. Use this on the response path INSTEAD of an AJV removal mode, which would empty
 * freeform maps such as `Account.feature_flags`.
 *
 * NOT a secret-removal boundary. Ambiguous schema shapes pass values through untouched — see
 * {@link pruneToSchema} and check a component with {@link findUnprunablePaths} before treating its
 * output as closed. Fields that must never ship still need an explicit response mapper.
 *
 * Never throws and never rejects: an undocumented field is server-side drift, and failing the
 * response would punish the caller for it.
 *
 * Takes a value the caller has already typed as the component. Pruning only REMOVES undeclared
 * extras, so a conforming input yields a conforming output and the return type is honest. It does
 * NOT validate, which is why it cannot accept `unknown` — narrowing a payload that is missing
 * required fields would hand TypeScript a complete `Account` that does not exist at runtime. Use
 * {@link pruneAndValidateApiResponse} when the payload's shape is not already established.
 *
 * Request validation stays separate and non-mutating — pruning a request would make the server
 * silently disagree with the permissive schema it publishes.
 */
export function pruneApiResponse<N extends ApiComponentName>(name: N, value: ApiComponentType<N>): ApiComponentType<N> {
    return pruneToSchema(value, { $ref: apiComponentRef(name) }, ApiSchemaComponents) as ApiComponentType<N>;
}

export type PruneAndValidateResult<T> = { valid: true; data: T } | { valid: false; data: unknown; errors: string[] };

/**
 * Prunes an untyped payload and validates the result against the published component.
 *
 * The only sound entry point for a payload of unknown shape: the component type is handed back
 * exclusively on the `valid` branch, so a document missing required fields cannot be typed as
 * complete. On failure the pruned value is still returned — the caller decides whether to ship it
 * and log, or fail — which keeps the "never turn drift into a 500" property a policy choice rather
 * than something baked in here.
 *
 */
export function pruneAndValidateApiResponse<N extends ApiComponentName>(
    name: N,
    value: unknown,
): PruneAndValidateResult<ApiComponentType<N>> {
    const pruned = pruneToSchema(value, { $ref: apiComponentRef(name) }, ApiSchemaComponents);
    const validate = getValidator(name);
    if (validate(pruned)) {
        return { valid: true, data: pruned as ApiComponentType<N> };
    }
    return { valid: false, data: pruned, errors: formatErrors(validate) };
}

/**
 * Paths inside a component where pruning cannot narrow. Empty means no STRUCTURAL gaps for
 * schema-conforming input — see {@link findUnprunablePaths} for why that is weaker than "nothing
 * can escape". Anything listed needs an explicit response mapper.
 */
export function findUnprunableApiPaths(name: ApiComponentName): string[] {
    return findUnprunablePaths({ $ref: apiComponentRef(name) }, ApiSchemaComponents);
}

/**
 * Normalizes raw query or header text into the value a component describes.
 *
 * Binds {@link normalizeParameters} to {@link ApiSchemaComponents} — the same objects the OpenAPI
 * document publishes and {@link validateApiRequest} compiles. That is what keeps the published
 * parameter and the enforced one the same declaration: the scanner expands this component's
 * properties into `in: query` parameters, and the coercion below is decided by those same property
 * schemas, so neither can be changed without changing the other.
 *
 * Validate the result with {@link validateApiRequest}, which is non-coercing: everything type-related
 * has already happened here, so a value this could not coerce is reported against the published
 * schema rather than by a second rule.
 */
export function normalizeApiParameters(
    name: ApiComponentName,
    raw: RawApiParameters,
    location: ApiParameterLocation,
): NormalizedApiParameters {
    return normalizeParameters(name, raw, location, ApiSchemaComponents[name], ApiSchemaComponents);
}
