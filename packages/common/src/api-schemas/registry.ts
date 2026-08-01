// Imported from llumiverse rather than restated here. These components describe llumiverse's own
// types, and a second declaration in this repository would be a copy that compiles — the drift this
// migration exists to remove. They have no local `./*.ts` module for the same reason: there is
// nothing local to declare.
import { HttpTimeoutOptionsSchema, JSONSchemaSchema, ModelOptionsSchema } from '@llumiverse/common/schemas';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { z } from 'zod';
import {
    ACECreatePayloadSchema,
    ACEUpdatePayloadSchema,
    AccessControlEntryArraySchema,
    AccessControlEntrySchema,
    RoleDefinitionArraySchema,
    SystemRoleDefinitionArraySchema,
} from './access-control.js';
import { AccountSchema, StripeBillingStatusResponseSchema, UpdateAccountPayloadSchema } from './account.js';
import { findUnprunablePaths, type JsonObject, pruneToSchema, toOpenApiComponents } from './adapter.js';
import {
    ApiKeyArraySchema,
    ApiKeyListQuerySchema,
    ApiKeyReadQuerySchema,
    ApiKeyReadResponseSchema,
    ApiKeySchema,
    ApiKeyWithValueSchema,
    AuthTokenResponseSchema,
    CreateApiKeyPayloadSchema,
    DeleteOperationResultSchema,
    ProjectRefArraySchema,
    UpdateApiKeyPayloadSchema,
} from './apikey.js';
import {
    AppAccessControlSchema,
    AppCapabilitiesSchema,
    AppManifestSourceSchema,
    AppSourceConfigSchema,
    AppUIConfigSchema,
    ToolCollectionObjectSchema,
} from './apps.js';
import {
    DeleteCountResultSchema,
    MigrationListResponseSchema,
    RunMigrationPayloadSchema,
    RunMigrationResponseSchema,
} from './commands.js';
import {
    BulkUploadUrlsPayloadSchema,
    BulkUploadUrlsResponseSchema,
    CopyFilePayloadSchema,
    CopyFileResponseSchema,
    DeleteFileResultSchema,
    FileBucketResponseSchema,
    FileDeleteQuerySchema,
    FileListQuerySchema,
    FileListResponseSchema,
    FileMetadataQuerySchema,
    FileMetadataResponseSchema,
    FileMetadataUpdateResultSchema,
    GetFileUrlPayloadSchema,
    GetFileUrlResponseSchema,
    GetUploadUrlPayloadSchema,
    SetFileMetadataPayloadSchema,
    StringValueMapSchema,
} from './files.js';
import {
    CreateUserGroupPayloadSchema,
    UpdateUserGroupPayloadSchema,
    UserGroupArraySchema,
    UserGroupRefSchema,
    UserGroupSchema,
} from './group.js';
import {
    AccountProjectsResponseSchema,
    InviteAcceptanceResponseSchema,
    InviteDeclineResponseSchema,
    InviteUserRequestPayloadSchema,
    InviteUserResponsePayloadSchema,
    OnboardingProgressSchema,
    UserInviteTokenArraySchema,
} from './invites.js';
import {
    type ApiParameterLocation,
    type NormalizedApiParameters,
    normalizeParameters,
    type RawApiParameters,
} from './parameters.js';
import {
    CountResultSchema,
    CreateProjectPayloadSchema,
    ListProjectsQuerySchema,
    PartialProjectConfigurationSchema,
    PartialProjectSchema,
    ProjectIntegrationListResponseSchema,
    ProjectPluginsUpdatePayloadSchema,
    ProjectSchema,
    ProjectTagQuerySchema,
    ProjectToolInfoArraySchema,
    ProjectToolInfoSchema,
    RenderingTemplateDefinitionRefSchema,
    RenderingTemplateDefinitionSchema,
} from './project.js';
import {
    BrowserUseProjectConfigurationSchema,
    ProjectConfigurationEmbeddingSchema,
    ProjectConfigurationSchema,
    ProjectIndexingConfigurationSchema,
    ProjectIntakeConfigurationSchema,
    ProjectIntakeSniffConfigurationSchema,
    ProjectModelDefaultsSchema,
    ResourceVisibilitySchema,
} from './project-configuration.js';
import { QuotaStandingResponseSchema, QuotaTierResponseSchema } from './quota.js';
import {
    ColumnLayoutSchema,
    ContentObjectTypeCatalogEntrySchema,
    ContentObjectTypeCatalogQuerySchema,
    ContentObjectTypeItemArraySchema,
    ContentObjectTypeItemSchema,
    ContentObjectTypeListQuerySchema,
    ContentObjectTypeSchema,
    ContentObjectTypeStatusSchema,
    ContentTypeEditingPolicySchema,
    ContentTypeIntakePolicySchema,
    CreateContentObjectTypePayloadSchema,
    InCodeTypeDefinitionSchema,
} from './store.js';
import {
    CompleteTaskPayloadSchema,
    CreateTaskPayloadSchema,
    DurableTaskStatusSchema,
    ListTasksQuerySchema,
    TaskArraySchema,
    TaskFieldSchema,
    TaskFieldTypeSchema,
    TaskSchema,
    TaskSourceSchema,
    UpdateTaskPayloadSchema,
} from './task.js';
import {
    DeleteByIdResultSchema,
    PrincipalIdentitySchema,
    SignupDataSchema,
    SignupPayloadSchema,
    UpdateUserPayloadSchema,
    UserArraySchema,
    UserRefArraySchema,
    UserSchema,
} from './user.js';

// ajv-formats is CommonJS with an ESM-style declaration file. Node's interop makes the default
// import the whole `module.exports` (itself callable), while TypeScript sees the namespace — and
// `.default` is the plugin function in both shapes.
const addFormats = ajvFormats.default;

/**
 * Endpoint-level API schemas, keyed by the OpenAPI component name they publish under.
 *
 * Schemas referenced directly by an endpoint belong here. Nested schemas carrying an id
 * (`AccountBilling`, the Stripe union members) are hoisted into components automatically by the
 * adapter, so listing them here would be redundant.
 *
 * A few entries are named by no endpoint yet: they are the LEAVES of closures still being
 * converted, registered ahead of their dependants because a canonical component may not `$ref` a
 * TypeScript-derived one. Registering one is inert on its own — the scanner collects a canonical
 * component only when an endpoint or another canonical component reaches it — so the entry buys the
 * closure rule without touching the published document.
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
    SignupData: SignupDataSchema,
    SignupPayload: SignupPayloadSchema,
    UserRefArray: UserRefArraySchema,
    UserGroup: UserGroupSchema,
    UserGroupArray: UserGroupArraySchema,
    UserGroupRef: UserGroupRefSchema,
    CreateUserGroupPayload: CreateUserGroupPayloadSchema,
    UpdateUserGroupPayload: UpdateUserGroupPayloadSchema,
    AccessControlEntry: AccessControlEntrySchema,
    AccessControlEntryArray: AccessControlEntryArraySchema,
    ACECreatePayload: ACECreatePayloadSchema,
    ACEUpdatePayload: ACEUpdatePayloadSchema,
    ProjectRefArray: ProjectRefArraySchema,
    RoleDefinitionArray: RoleDefinitionArraySchema,
    SystemRoleDefinitionArray: SystemRoleDefinitionArraySchema,
    ApiKey: ApiKeySchema,
    ApiKeyArray: ApiKeyArraySchema,
    ApiKeyWithValue: ApiKeyWithValueSchema,
    ApiKeyReadResponse: ApiKeyReadResponseSchema,
    ApiKeyReadQuery: ApiKeyReadQuerySchema,
    CreateApiKeyPayload: CreateApiKeyPayloadSchema,
    UpdateApiKeyPayload: UpdateApiKeyPayloadSchema,
    AuthTokenResponse: AuthTokenResponseSchema,
    DeleteOperationResult: DeleteOperationResultSchema,
    InviteUserRequestPayload: InviteUserRequestPayloadSchema,
    InviteUserResponsePayload: InviteUserResponsePayloadSchema,
    InviteAcceptanceResponse: InviteAcceptanceResponseSchema,
    InviteDeclineResponse: InviteDeclineResponseSchema,
    OnboardingProgress: OnboardingProgressSchema,
    AccountProjectsResponse: AccountProjectsResponseSchema,
    TransientToken_UserInviteTokenData_Array: UserInviteTokenArraySchema,
    ListProjectsQuery: ListProjectsQuerySchema,
    ProjectTagQuery: ProjectTagQuerySchema,
    ICreateProjectPayload: CreateProjectPayloadSchema,
    ProjectPluginsUpdatePayload: ProjectPluginsUpdatePayloadSchema,
    CountResult: CountResultSchema,
    ProjectIntegrationListResponse: ProjectIntegrationListResponseSchema,
    ProjectToolInfo: ProjectToolInfoSchema,
    ProjectToolInfoArray: ProjectToolInfoArraySchema,
    RenderingTemplateDefinition: RenderingTemplateDefinitionSchema,
    RenderingTemplateDefinitionRef: RenderingTemplateDefinitionRefSchema,
    // Leaves of the ProjectConfiguration closure. Each is hoisted by `ProjectConfiguration` rather
    // than named by an endpoint, so only the roots that nothing else here references are listed;
    // `ModelDefault`, the two search enums, `ProjectSearchPropertyMapping(+Map)` and the two
    // browser-use enums are published by being referenced from these.
    ProjectModelDefaults: ProjectModelDefaultsSchema,
    ResourceVisibility: ResourceVisibilitySchema,
    ProjectIndexingConfiguration: ProjectIndexingConfigurationSchema,
    ProjectConfigurationEmbedding: ProjectConfigurationEmbeddingSchema,
    BrowserUseProjectConfiguration: BrowserUseProjectConfigurationSchema,
    ProjectIntakeSniffConfiguration: ProjectIntakeSniffConfigurationSchema,
    // Leaves of the Project closure, converted ahead of their dependants. `ModelOptions` hoists its
    // twenty-three driver option sets and four enums; `JSONSchema` hoists `JSONSchemaProperties`.
    JSONSchema: JSONSchemaSchema,
    ModelOptions: ModelOptionsSchema,
    HttpTimeoutOptions: HttpTimeoutOptionsSchema,
    // The intake policy tree. Everything it reaches — InteractionExecutionConfiguration, the two
    // grounding policies, the page/vision enums and the embedding switches — is hoisted from here.
    ContentTypeIntakePolicy: ContentTypeIntakePolicySchema,
    // Registered after the policy it references. `Partial_IntakeVisionProfileSettings` and the
    // per-detail override map are hoisted from here; neither has a TypeScript name to alias.
    ProjectIntakeConfiguration: ProjectIntakeConfigurationSchema,
    // The roots of the Project closure, registered last because every leaf above is a `$ref` target
    // of one of them.
    ProjectConfiguration: ProjectConfigurationSchema,
    Project: ProjectSchema,
    // The two update payloads. They have no TypeScript name to alias — they are `Partial<>` views —
    // so they are registered as components without a canonical alias, which is what the two update
    // endpoints now name. See the note on their schemas: the scanner cannot derive a `Partial<>` of
    // an intercepted alias, so leaving them derived would publish `{}`.
    Partial_Project: PartialProjectSchema,
    Partial_ProjectConfiguration: PartialProjectConfigurationSchema,
    // The app-manifest LEAVES. Each is registered as a root of its own because nothing canonical
    // reaches it yet: `AppManifestData` and `AppManifest` are still derived from TypeScript, and
    // their derived components now `$ref` these. Registration is what publishes the bodies those
    // references point at.
    //
    // `AppManifest(Data)` itself is quarantined rather than forgotten. Its `settings_schema` is a
    // `JSONSchema`, and making it canonical pulls the registry's `JSONSchema` into the studio
    // service, where the TypeScript-derived one publishes `type` as
    // `JSONSchemaTypeName | JSONSchemaTypeName[]` while the canonical publishes `type: {}`. The
    // generator refuses that pair, correctly. The combined document already ships the canonical
    // spelling — zeno reaches it through `ContentTypeIntakePolicy` and wins the merge — so this is a
    // disagreement to settle in `@llumiverse/common`, not something to work around here.
    //
    // `MCPToolCollectionObject`, `VertesiaSDKToolCollectionObject`, `ToolCollectionAuthType`,
    // `MCPOAuthConfig`, `AppUINavItem`, `AppAvailableIn` and `AppGitSourceConfig` are hoisted from
    // the roots below rather than listed.
    ToolCollectionObject: ToolCollectionObjectSchema,
    AppUIConfig: AppUIConfigSchema,
    AppCapabilities: AppCapabilitiesSchema,
    AppAccessControl: AppAccessControlSchema,
    AppSourceConfig: AppSourceConfigSchema,
    AppManifestSource: AppManifestSourceSchema,

    // Wave Z1 — zeno files, durable tasks, the content-type catalog and the migration commands.
    // Converted in bulk by `packages/api-specs/scripts/convert-to-zod.mjs` from the published
    // document, so every body here re-emits byte-identically to the component it replaces.
    StringValueMap: StringValueMapSchema,
    CopyFilePayload: CopyFilePayloadSchema,
    CopyFileResponse: CopyFileResponseSchema,
    DeleteFileResult: DeleteFileResultSchema,
    FileBucketResponse: FileBucketResponseSchema,
    FileListResponse: FileListResponseSchema,
    FileMetadataResponse: FileMetadataResponseSchema,
    FileMetadataUpdateResult: FileMetadataUpdateResultSchema,
    GetFileUrlPayload: GetFileUrlPayloadSchema,
    GetFileUrlResponse: GetFileUrlResponseSchema,
    GetUploadUrlPayload: GetUploadUrlPayloadSchema,
    BulkUploadUrlsPayload: BulkUploadUrlsPayloadSchema,
    BulkUploadUrlsResponse: BulkUploadUrlsResponseSchema,
    SetFileMetadataPayload: SetFileMetadataPayloadSchema,
    FileMetadataQuery: FileMetadataQuerySchema,
    FileListQuery: FileListQuerySchema,
    FileDeleteQuery: FileDeleteQuerySchema,

    TaskFieldType: TaskFieldTypeSchema,
    DurableTaskStatus: DurableTaskStatusSchema,
    TaskSource: TaskSourceSchema,
    TaskField: TaskFieldSchema,
    Task: TaskSchema,
    TaskArray: TaskArraySchema,
    CreateTaskPayload: CreateTaskPayloadSchema,
    UpdateTaskPayload: UpdateTaskPayloadSchema,
    CompleteTaskPayload: CompleteTaskPayloadSchema,
    ListTasksQuery: ListTasksQuerySchema,

    ColumnLayout: ColumnLayoutSchema,
    ContentTypeEditingPolicy: ContentTypeEditingPolicySchema,
    ContentObjectTypeStatus: ContentObjectTypeStatusSchema,
    ContentObjectTypeItem: ContentObjectTypeItemSchema,
    ContentObjectTypeItemArray: ContentObjectTypeItemArraySchema,
    ContentObjectTypeCatalogEntry: ContentObjectTypeCatalogEntrySchema,
    InCodeTypeDefinition: InCodeTypeDefinitionSchema,
    CreateContentObjectTypePayload: CreateContentObjectTypePayloadSchema,
    ContentObjectType: ContentObjectTypeSchema,
    ContentObjectTypeCatalogQuery: ContentObjectTypeCatalogQuerySchema,
    ContentObjectTypeListQuery: ContentObjectTypeListQuerySchema,

    DeleteCountResult: DeleteCountResultSchema,
    MigrationListResponse: MigrationListResponseSchema,
    RunMigrationPayload: RunMigrationPayloadSchema,
    RunMigrationResponse: RunMigrationResponseSchema,
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
    'SignupData',
    'SignupPayload',
    // The group closure. UserRef is hoisted by UserRefArray rather than named by an endpoint, but it
    // is published closed today and must stay that way; the array components take no
    // additionalProperties at all.
    'UserRef',
    'UserGroup',
    'UserGroupRef',
    'CreateUserGroupPayload',
    'UpdateUserGroupPayload',
    // The roles / access-control closure. `AceConditions` is closed too, and has to be listed by
    // name: it is a hoisted component, so the parent's strict policy does not reach it.
    // `PropertyConditions` is deliberately absent — it is a map whose `additionalProperties` is a
    // value schema, not an object with declared properties.
    'AccessControlEntry',
    'ACECreatePayload',
    'ACEUpdatePayload',
    'AceConditions',
    'RoleDefinition',
    'SystemRoleDefinition',
    // The API key and account-invite closure. ProjectRef, AccountRef and the invite payload are
    // hoisted rather than named by an endpoint, and all three are published closed today.
    'ProjectRef',
    'AccountRef',
    'ApiKey',
    'ApiKeyWithValue',
    'ApiKeyReadResponse',
    'ApiKeyReadQuery',
    'CreateApiKeyPayload',
    'UpdateApiKeyPayload',
    'AuthTokenResponse',
    'DeleteOperationResult',
    'InviteUserRequestPayload',
    'InviteUserResponsePayload',
    'InviteAcceptanceResponse',
    'InviteDeclineResponse',
    'OnboardingProgress',
    'AccountProjectsResponse',
    'UserInviteTokenData',
    'TransientToken_UserInviteTokenData_',
    // The Projects closure. The two query components are expanded into parameters rather than
    // published, but the strict policy is what makes an undeclared query parameter a 400 rather than
    // a silent ignore, so they are listed like ApiKeyListQuery. ProjectIntegrationListEntry and
    // ProjectToolInfo are hoisted rather than named by an endpoint, and both are closed today.
    'ListProjectsQuery',
    'ProjectTagQuery',
    'ICreateProjectPayload',
    'ProjectPluginsUpdatePayload',
    'CountResult',
    'ProjectIntegrationListResponse',
    'ProjectIntegrationListEntry',
    'ProjectToolInfo',
    'RenderingTemplateDefinition',
    'RenderingTemplateDefinitionRef',
    // The ProjectConfiguration leaves. All are published closed today. The three enums and
    // `ProjectSearchPropertyMappingMap` are absent for the reasons `PropertyConditions` is: a string
    // takes no `additionalProperties`, and a map's is a value schema rather than a policy.
    'ModelDefault',
    'ModalityDefaults',
    'SystemDefaults',
    'ProjectModelDefaults',
    'ProjectSearchPropertyMapping',
    'ProjectIndexingConfiguration',
    'ProjectConfigurationEmbedding',
    'BrowserUseProjectConfiguration',
    'ProjectIntakeSniffConfiguration',
    // Declared in @llumiverse/common beside the type, like the ModelOptions members above.
    'HttpTimeoutOptions',
    // The intake policy tree. Every object in it is published closed today, including the inline
    // nested ones, which the schemas spell `strictObject` so the emission carries it directly.
    'ContentTypeIntakePolicy',
    'ContentTypeExtractionGroundingPolicy',
    'ContentTypeExtractionGroundingReviewPolicy',
    'InteractionExecutionConfiguration',
    'Partial_Record_SupportedEmbeddingTypes_boolean',
    // The intake configuration above the policy, and the two anonymous shapes it hoists. All three
    // are published closed today.
    'ProjectIntakeConfiguration',
    'Partial_IntakeVisionProfileSettings',
    'Partial_Record_IntakeVisionDetail_Partial_IntakeVisionProfileSettings',
    // The Project closure roots. Both are published closed today, as is the anonymous `embeddings`
    // object `ProjectConfiguration` publishes inline, and so are the two `Partial<>` update payloads.
    'Project',
    'ProjectConfiguration',
    'Partial_Project',
    'Partial_ProjectConfiguration',
    // Every member of the `ModelOptions` union. All twenty-three are published closed today, and
    // their Zod schemas are `strictObject`, so the published contract, the AJV enforcement and the
    // schema's own parse all reject the same undeclared option. `ModelOptions` itself is a union
    // and takes no `additionalProperties`, and neither do the four hoisted enums.
    //
    // `JSONSchema` is deliberately absent: it is OPEN by design and by long-standing publication —
    // a JSON Schema carries keywords the type never enumerated. `JSONSchemaProperties` is a map.
    'TextFallbackOptions',
    'ImagenOptions',
    'VertexAIClaudeOptions',
    'VertexAIGeminiOptions',
    'VertexAIGrokOptions',
    'NovaCanvasOptions',
    'BedrockConverseOptions',
    'BedrockNovaOptions',
    'BedrockMistralOptions',
    'BedrockAI21Options',
    'BedrockCohereCommandOptions',
    'BedrockClaudeOptions',
    'BedrockPalmyraOptions',
    'BedrockGptOssOptions',
    'TwelvelabsPegasusOptions',
    'BedrockMantleResponsesOptions',
    'BedrockMantleChatCompletionsOptions',
    'BedrockMantleClaudeOptions',
    'OpenAiThinkingOptions',
    'OpenAiTextOptions',
    'OpenAiDalleOptions',
    'OpenAiGptImageOptions',
    'GroqOptions',
    // The app-manifest leaves. Every object among them is published closed today, the nested `git`
    // block included, and it is spelled `strictObject` so the emission carries it directly. The five
    // enums take no `additionalProperties` at all.
    'AppManifestSource',
    'AppSourceConfig',
    'AppGitSourceConfig',
    'AppUIConfig',
    'AppUINavItem',
    'MCPOAuthConfig',
    'MCPToolCollectionObject',
    'VertesiaSDKToolCollectionObject',
    // Wave Z1. Every one is published closed today; `StringValueMap`, `MigrationListResponse`,
    // `TaskArray`, `ContentObjectTypeItemArray` and the three enums are not objects and take none.
    'CopyFilePayload',
    'CopyFileResponse',
    'DeleteFileResult',
    'FileBucketResponse',
    'FileListResponse',
    'FileMetadataResponse',
    'FileMetadataUpdateResult',
    'GetFileUrlPayload',
    'GetFileUrlResponse',
    'GetUploadUrlPayload',
    'BulkUploadUrlsPayload',
    'BulkUploadUrlsResponse',
    'SetFileMetadataPayload',
    // The four zeno query components. Expanded into parameters rather than published; listed for the
    // same reason ApiKeyListQuery is, so an endpoint can opt into rejecting an undeclared parameter.
    'FileMetadataQuery',
    'FileListQuery',
    'FileDeleteQuery',
    'TaskSource',
    'TaskField',
    'Task',
    'CreateTaskPayload',
    'UpdateTaskPayload',
    'CompleteTaskPayload',
    // Expanded into parameters rather than published, like ApiKeyListQuery and the two project query
    // components. Listed because the strict policy is what an endpoint opting into
    // `rejectUndeclaredQuery` rejects against; `GET /tasks` does not opt in today.
    'ListTasksQuery',
    'ColumnLayout',
    'ContentTypeEditingPolicy',
    'ContentObjectTypeItem',
    'ContentObjectTypeCatalogEntry',
    'InCodeTypeDefinition',
    'CreateContentObjectTypePayload',
    'ContentObjectType',
    'ContentObjectTypeCatalogQuery',
    'ContentObjectTypeListQuery',
    'DeleteCountResult',
    'RunMigrationPayload',
    'RunMigrationResponse',
    'MigrationListResponse',
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

/**
 * The component `name` would publish if `schema` were the only thing registered.
 *
 * The same two calls {@link ApiSchemaComponents} makes, on one schema, so the comparison is against
 * the real emission path rather than a reimplementation of it.
 *
 * Exported for provenance checking, not for use. A component whose public TypeScript type is
 * `z.infer<typeof XSchema>` is only single-sourced if the component published as `X` is emitted by
 * the schema object that alias's import resolves to. The OpenAPI scanner cannot check that: it reads
 * source text, so it can prove the alias and the variable agree on a spelling and nothing more, and
 * it deliberately stops deriving these types — which is what leaves the usual derived-versus-
 * canonical comparison with nothing to compare. `check:aliases` closes it by emitting each alias's
 * own schema through here. Emission rather than object identity because the members hoisted out of a
 * registered root are published components that never appear in `API_SCHEMAS` at all.
 */
export function emitCanonicalComponent(name: string, schema: z.ZodType): JsonObject | undefined {
    const raw = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
    // The adapter validates the strict list against the components actually emitted, and this emits
    // ONE root rather than the whole registry — so the list has to be narrowed to what this root
    // produces, or every name closed elsewhere in the registry reads as an unknown component. The
    // first pass exists only to learn those names; the second is the emission that gets compared.
    const produced = new Set(Object.keys(toOpenApiComponents({ [name]: raw })));
    const strictComponents = new Set([...STRICT_COMPONENTS].filter((component) => produced.has(component)));
    return toOpenApiComponents({ [name]: raw }, { strictComponents })[name];
}

/**
 * A canonical component as a SELF-CONTAINED JSON Schema, for consumers that compile it directly.
 *
 * The published component `$ref`s its neighbours through `#/components/schemas/...`, which resolves
 * only inside the OpenAPI document. AJV and the Monaco editor need a document they can compile on
 * its own, so the transitive closure is inlined under `$defs` and the pointers rewritten. Nothing
 * about the shapes changes — this is a re-rooting of the same objects, which is what lets a
 * generated artifact be compared with the component it came from.
 */
export function bundleCanonicalComponent(name: ApiComponentName): JsonObject {
    const seen = new Set<string>();
    const queue: string[] = [name];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const referenced of collectComponentRefs(ApiSchemaComponents[current])) {
            if (!seen.has(referenced)) queue.push(referenced);
        }
    }
    seen.delete(name);
    const defs: JsonObject = {};
    for (const dependency of [...seen].sort()) {
        defs[dependency] = rerootComponentRefs(ApiSchemaComponents[dependency]) as JsonObject;
    }
    const root = rerootComponentRefs(ApiSchemaComponents[name]) as JsonObject;
    return seen.size > 0 ? { ...root, $defs: defs } : root;
}

const COMPONENT_REF_PREFIX = '#/components/schemas/';

function collectComponentRefs(value: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        for (const item of value) collectComponentRefs(item, out);
        return out;
    }
    if (!value || typeof value !== 'object') return out;
    for (const [key, item] of Object.entries(value)) {
        if (key === '$ref' && typeof item === 'string' && item.startsWith(COMPONENT_REF_PREFIX)) {
            out.add(item.slice(COMPONENT_REF_PREFIX.length));
        } else {
            collectComponentRefs(item, out);
        }
    }
    return out;
}

function rerootComponentRefs(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(rerootComponentRefs);
    if (!value || typeof value !== 'object') return value;
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
        out[key] =
            key === '$ref' && typeof item === 'string' && item.startsWith(COMPONENT_REF_PREFIX)
                ? `#/$defs/${item.slice(COMPONENT_REF_PREFIX.length)}`
                : (rerootComponentRefs(item) as never);
    }
    return out;
}

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
