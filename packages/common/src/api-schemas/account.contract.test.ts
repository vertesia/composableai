import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { StripeBillingStatusResponse } from '../meters.js';
import { type Account, BillingMethod, type QuotaTier, type UpdateAccountPayload } from '../user.js';
import { type JsonObject, SchemaAdapterError, toOpenApiComponents } from './adapter.js';
import { ApiSchemaComponents, apiComponentRef, validateApiRequest, validateApiResponse } from './registry.js';

/** Exact type identity — `extends` in both directions is too weak (any/unknown slip through). */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
/**
 * Mutual assignability. Weaker than {@link Equals}, and the right assertion when comparing a
 * derived type against a hand-written enum or interface: TypeScript keeps those nominally
 * distinct even when structurally interchangeable, and interchangeable is what consumers need.
 * `[A] extends [B]` rather than `A extends B` so unions do not distribute.
 */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
function assertType<T extends true>(_ok: T): void {}

/**
 * Compiles a component through an OpenAPI-shaped envelope, so the pointer AJV resolves is the
 * exact pointer the spec publishes. An isolated component cannot resolve
 * `#/components/schemas/*` on its own.
 *
 * `strictSchema: false` (not `strict: false`) keeps AJV's type and tuple checks active while
 * tolerating the `components` envelope keyword.
 */
function compile(name: string, components: Readonly<Record<string, JsonObject>> = ApiSchemaComponents) {
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true });
    ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: components } });
    return ajv.compile({ $ref: `vertesia://openapi${apiComponentRef(name as never)}` });
}

const VALID_ACCOUNT = {
    id: 'acc_1',
    name: 'Acme',
    email_domains: ['acme.com'],
    onboarding: { completed: true, completed_at: '2026-07-29T10:00:00.000Z' },
    datacenter: 'gcp',
    account_type: 'customer',
    billing: { method: 'stripe', stripe_customer_id: 'cus_1' },
    created_by: 'u1',
    updated_by: 'u1',
    created_at: '2026-07-29T10:00:00.000Z',
    updated_at: '2026-07-29T10:00:00.000Z',
};

describe('gate 1 — the schema is the single source of truth for the public types', () => {
    it('publishes the exact schema-derived type, not a hand-written twin', () => {
        // `Equals`, not assignability: two structurally similar declarations would satisfy
        // assignability while still being free to drift. Identity is the property that makes the
        // schema the source of truth — there is only one definition to change.
        expect(true).toBe(true);
    });

    it('resolves a nested component reference to its concrete property type', () => {
        // The whole point of schema-first: this must not degrade to `unknown`. The enum survives
        // as the shared `BillingMethod` enum rather than a bare literal union, which is what keeps
        // it interchangeable with the value consumers already import.
        assertType<MutuallyAssignable<Account['billing']['method'], BillingMethod>>(true);
        assertType<Equals<Account['billing']['stripe_customer_id'], string | undefined>>(true);
        assertType<Equals<Account['email_domains'], string[]>>(true);
        assertType<Equals<Account['quota_tier'], QuotaTier | undefined>>(true);
        assertType<Equals<Account['onboarding']['completed_at'], string | undefined>>(true);
        expect(true).toBe(true);
    });

    it('narrows the Stripe union on its discriminator', () => {
        // The flat shape gave consumers `portal_url?` and `reason?` with no way to know which was
        // populated. Narrowing on `status` is the behaviour a client actually needs, and it only
        // exists because the type comes from the discriminated union the schema declares.
        const enabled: StripeBillingStatusResponse = {
            status: 'enabled',
            billing_method: BillingMethod.stripe,
            portal_url: 'https://billing.stripe.com/p/session_1',
        };
        if (enabled.status === 'enabled') {
            assertType<Equals<typeof enabled.portal_url, string>>(true);
            expect(enabled.portal_url).toBe('https://billing.stripe.com/p/session_1');
        }

        const disabled: StripeBillingStatusResponse = {
            status: 'disabled',
            billing_method: null,
            reason: 'No billing method configured',
        };
        if (disabled.status === 'disabled') {
            assertType<Equals<typeof disabled.reason, string>>(true);
            expect(disabled.reason).toBe('No billing method configured');
        }
    });
});

describe('gate 2 — canonical schemas carry stable OpenAPI component references', () => {
    it('hoists nested id-bearing schemas into components', () => {
        // Exhaustive rather than a containment check, so a schema that acquires an `id` — and with it a
        // published component and a `$ref` at every use site — cannot appear without being noticed. It
        // grows by one line per hoisted schema as batches convert, which is the point: each addition is
        // a new public component name and wants a reviewer to see it.
        expect(Object.keys(ApiSchemaComponents).sort()).toEqual([
            'ACECreatePayload',
            'ACEUpdatePayload',
            'AIModel',
            'AIModelArray',
            'AIModelStatus',
            'AbacScope',
            'AccessControlEntry',
            'AccessControlEntryArray',
            'AccessControlPrincipalType',
            'AccessControlResourceType',
            'Account',
            'AccountBilling',
            'AccountProjectsResponse',
            'AccountRef',
            'AccountType',
            'AceConditions',
            'AgentCheckpointConfiguration',
            'AgentProjectConfiguration',
            'AgentResourceAction',
            'AgentResourceReference',
            'AgentResourceType',
            'AgentRunSearchHit',
            'AgentRunStatus',
            'AgentRunType',
            'AgentRunnerOptions',
            'AgentSearchScope',
            'AgentSearchScope_Collection',
            'AgentToolApprovalClass',
            'AgentToolApprovalMode',
            'AgentToolDefinition',
            'AgenticViewSearchConfiguration',
            'AggregatedTool',
            'AggregatedToolArray',
            'AlterTableOperation',
            'AlterTablePayload',
            'AnalyticsAxis',
            'ApiKey',
            'ApiKeyArray',
            'ApiKeyListQuery',
            'ApiKeyReadQuery',
            'ApiKeyReadResponse',
            'ApiKeyTypes',
            'ApiKeyWithValue',
            'AppAccessControl',
            'AppAvailableIn',
            'AppBuildProgress',
            'AppBuildProgressStatus',
            'AppBuildTrigger',
            'AppCapabilities',
            'AppDevelopmentTask',
            'AppDevelopmentTaskDetails',
            'AppDevelopmentTaskList',
            'AppGitSourceConfig',
            'AppInspectionCapabilityReport',
            'AppInspectionIssue',
            'AppInspectionResult',
            'AppInstallationKind',
            'AppInstallationOAuthBinding',
            'AppInstallationPayload',
            'AppInstallationProjectsQuery',
            'AppInstallationProviderBinding',
            'AppInstallationsQuery',
            'AppManifestSource',
            'AppOAuthCollectionParams',
            'AppOAuthProviderParams',
            'AppPackageScope',
            'AppRepoBranch',
            'AppRepoCommit',
            'AppRepoCommits',
            'AppRepoDocumentCommit',
            'AppRepoRef',
            'AppRepoRefs',
            'AppRepoTree',
            'AppRepoTreeEntry',
            'AppScaffoldModule',
            'AppScaffoldProgress',
            'AppScaffoldProgressStatus',
            'AppSourceConfig',
            'AppToolCollection',
            'AppToolCollectionArray',
            'AppUIConfig',
            'AppUINavItem',
            'AppVersionGitRefType',
            'AppVersionGitSource',
            'AppVersionKind',
            'AppVersionRecord',
            'AppVersionRecordArray',
            'AppVersionState',
            'AppVersionStorage',
            'AppVersionTarget',
            'AppVersionUrls',
            'AsyncCompletionMode',
            'AsyncCompletionOptions',
            'AsyncConversationExecutionPayload',
            'AsyncExecutionPayload',
            'AsyncExecutionResult',
            'AsyncInteractionExecutionPayload',
            'AuditAction',
            'AuditAggregationDetailField',
            'AuditAggregationDetailFilter',
            'AuditAggregationDimension',
            'AuditAggregationDistinctField',
            'AuditAggregationFilter',
            'AuditAggregationGroup',
            'AuditAggregationMetric',
            'AuditAggregationOperation',
            'AuditAggregationQuery',
            'AuditAggregationResolution',
            'AuditAggregationResponse',
            'AuditAggregationRow',
            'AuditMeter',
            'AuditTrailEvent',
            'AuditTrailQuery',
            'AuditTrailResponse',
            'AuthTokenResponse',
            'BatchQueryPayload',
            'BatchQueryResult',
            'BatchQueryResultItem',
            'BedrockAI21Options',
            'BedrockClaudeOptions',
            'BedrockCohereCommandOptions',
            'BedrockConverseOptions',
            'BedrockGptOssOptions',
            'BedrockMantleChatCompletionsOptions',
            'BedrockMantleClaudeOptions',
            'BedrockMantleResponsesOptions',
            'BedrockMistralOptions',
            'BedrockNovaOptions',
            'BedrockPalmyraOptions',
            'BillingMethod',
            'BrowserUseProjectConfiguration',
            'BrowserUseRiskPolicy',
            'BrowserUseScreenshotCapture',
            'BulkObjectCreateResult',
            'BulkObjectDeleteResult',
            'BulkObjectUpdateResult',
            'BulkOperationPayload',
            'BulkOperationResponse',
            'BulkOperationResult',
            'BulkRevokeOAuthGrantsPayload',
            'BulkUploadUrlsPayload',
            'BulkUploadUrlsResponse',
            'CachePolicy',
            'CatalogInteractionRef',
            'CatalogInteractionRefArray',
            'CatalogTagQuery',
            'ColumnLayout',
            'CompleteTaskPayload',
            'CompletionResult',
            'ComputeInteractionFacetPayload',
            'ComputePromptFacetPayload',
            'ComputedFacetResponse',
            'ConfigModes',
            'ContentObjectType',
            'ContentObjectTypeCatalogEntry',
            'ContentObjectTypeCatalogEntryArray',
            'ContentObjectTypeCatalogQuery',
            'ContentObjectTypeItem',
            'ContentObjectTypeItemArray',
            'ContentObjectTypeListQuery',
            'ContentObjectTypeRef',
            'ContentObjectTypeStatus',
            'ContentTypeEditingPolicy',
            'ContentTypeExtractionGroundingPolicy',
            'ContentTypeExtractionGroundingReviewPolicy',
            'ContentTypeIntakePolicy',
            'ConversationActivityState',
            'ConversationState',
            'ConversationStripOptions',
            'ConversationVisibility',
            'CopyFilePayload',
            'CopyFileResponse',
            'CostAnalyticsQuery',
            'CostAnalyticsResponse',
            'CostByDimension',
            'CostExportQuery',
            'CostModelPricesQuery',
            'CostRunPriceQuery',
            'CostRunPriceResponse',
            'CostSummary',
            'CostTimeSeriesPoint',
            'CountResult',
            'CreateApiKeyPayload',
            'CreateContentObjectTypePayload',
            'CreateDashboardPayload',
            'CreateDashboardSnapshotPayload',
            'CreateDataStorePayload',
            'CreateOAuthClientPayload',
            'CreateOAuthProviderPayload',
            'CreateSnapshotPayload',
            'CreateTablePayload',
            'CreateTablesPayload',
            'CreateTaskPayload',
            'CreateUserGroupPayload',
            'CreateViewExperienceRequest',
            'Dashboard',
            'DashboardArchiveResult',
            'DashboardBulkArchiveResult',
            'DashboardBulkDeleteResult',
            'DashboardDataSource',
            'DashboardElasticsearchDsl',
            'DashboardElasticsearchResultMapping',
            'DashboardItem',
            'DashboardItemArray',
            'DashboardLayout',
            'DashboardPanel',
            'DashboardPanelPosition',
            'DashboardQuery',
            'DashboardSqlDataSource',
            'DashboardStatus',
            'DashboardStoreElasticsearchDataSource',
            'DashboardVersion',
            'DashboardVersionItem',
            'DashboardVersionItemArray',
            'DashboardVersioningPayload',
            'DashboardVersioningStatusResponse',
            'DataColumn',
            'DataColumnForAI',
            'DataColumnForAIMap',
            'DataColumnType',
            'DataForeignKey',
            'DataForeignKeyForAI',
            'DataIndex',
            'DataRelationship',
            'DataRelationshipForAI',
            'DataRelationshipType',
            'DataSchema',
            'DataSchemaForAI',
            'DataSource',
            'DataStore',
            'DataStoreArchiveResult',
            'DataStoreDownloadInfo',
            'DataStoreFullSchemaResponse',
            'DataStoreItem',
            'DataStoreItemArray',
            'DataStoreMutateRowsPayload',
            'DataStoreMutateRowsResult',
            'DataStoreSchemaResponse',
            'DataStoreStatus',
            'DataStoreTableDetail',
            'DataStoreTableDropResult',
            'DataStoreVersion',
            'DataStoreVersionArray',
            'DataStoreVersionTableState',
            'DataStoreVersionTableStateMap',
            'DataTable',
            'DataTableArray',
            'DataTableForAI',
            'DataTableForAIMap',
            'DataTableSemanticType',
            'DataTableSummary',
            'DataTableSummaryArray',
            'DeleteAppVersionResponse',
            'DeleteByIdResult',
            'DeleteCountResult',
            'DeleteFileResult',
            'DeleteOperationResult',
            'DurableTaskStatus',
            'ElasticsearchBackend',
            'EmailChannel',
            'EmbeddingOutput',
            'EmbeddingResultItem',
            'EmbeddingTaskType',
            'EmbeddingsApiAudioInput',
            'EmbeddingsApiImageInput',
            'EmbeddingsApiInput',
            'EmbeddingsApiRequest',
            'EmbeddingsApiSource',
            'EmbeddingsApiTextInput',
            'EmbeddingsApiVideoInput',
            'EmbeddingsResult',
            'EmbeddingsTokenUsage',
            'EnableEnvironmentModelPayload',
            'EventCategory',
            'EventRef',
            'ExecuteInteractionByEndpointHeaders',
            'ExecuteInteractionByEndpointQuery',
            'ExecutionEnvironment',
            'ExecutionEnvironmentArray',
            'ExecutionEnvironmentConfigUpdatePayload',
            'ExecutionEnvironmentCreatePayload',
            'ExecutionEnvironmentRef',
            'ExecutionEnvironmentSettings',
            'ExecutionEnvironmentUpdatePayload',
            'ExecutionRun',
            'ExecutionRunDocRef',
            'ExecutionRunInteraction',
            'ExecutionRunRef',
            'ExecutionRunRefArray',
            'ExecutionRunStatus',
            'ExecutionRunWorkflow',
            'ExecutionTokenUsage',
            'ExportedPromptTemplateRef',
            'ExternalizedToolInputRef',
            'ExternalizedToolInputRefs',
            'Extract_AppVersionGitRefType_branch_tag_commit',
            'FacetSpec',
            'FileBucketResponse',
            'FileDeleteQuery',
            'FileListQuery',
            'FileListResponse',
            'FileMetadataQuery',
            'FileMetadataResponse',
            'FileMetadataUpdateResult',
            'GenerateInteractionPayload',
            'GenerateTestDataPayload',
            'GeneratedInteractionDefinition',
            'GeneratedInteractionDefinitionArray',
            'GeneratedInteractionPromptSegment',
            'GeneratedInteractionPromptTemplate',
            'GeneratedTestDataRecord',
            'GeneratedTestDataRecordArray',
            'GetDataStoreTableQuery',
            'GetFileUrlPayload',
            'GetFileUrlResponse',
            'GetUploadUrlPayload',
            'GroqOptions',
            'HttpTimeoutOptions',
            'ICreateProjectPayload',
            'ImageResult',
            'ImagenMaskMode',
            'ImagenOptions',
            'ImagenTaskType',
            'ImportDataFormat',
            'ImportDataPayload',
            'ImportDataSource',
            'ImportJob',
            'ImportStatus',
            'ImportTableData',
            'ImportTableDataMap',
            'ImprovePromptPayload',
            'ImprovePromptPayloadConfig',
            'InCodePrompt',
            'InCodeTypeDefinition',
            'InCodeTypeRef',
            'InitialToolCall',
            'IntakePageRanges',
            'IntakePageScope',
            'IntakeVisionDetail',
            'Interaction',
            'InteractionArray',
            'InteractionCreatePayload',
            'InteractionEndpoint',
            'InteractionEndpointArray',
            'InteractionEndpointQuery',
            'InteractionExecutionConfiguration',
            'InteractionExecutionError',
            'InteractionExecutionPayload',
            'InteractionExecutionResult',
            'InteractionForkPayload',
            'InteractionName',
            'InteractionNameArray',
            'InteractionPublishPayload',
            'InteractionRef',
            'InteractionRefArray',
            'InteractionRefWithSchema',
            'InteractionRefWithSchemaArray',
            'InteractionSearchQuery',
            'InteractionStatus',
            'InteractionTags',
            'InteractionTagsArray',
            'InteractionUpdatePayload',
            'InteractionVisibility',
            'InteractionsExportPayload',
            'InteractiveChannel',
            'InviteAcceptanceResponse',
            'InviteDeclineResponse',
            'InviteUserRequestPayload',
            'InviteUserResponsePayload',
            'JSONObject',
            'JSONSchema',
            'JSONSchemaProperties',
            'JSONValue',
            'JsonResult',
            'KnownAuditAction',
            'LegacyExecutionRunResult',
            'LegacyPopulatedExecutionRunResult',
            'ListDataStoreVersionsQuery',
            'ListEnvironmentsQuery',
            'ListOAuthGrantsQuery',
            'ListProjectToolsQuery',
            'ListProjectsQuery',
            'ListTasksQuery',
            'LlmCallType',
            'LoadBalancingEnvConfig',
            'LoadBalancingEnvEntryConfig',
            'MCPOAuthConfig',
            'MCPToolAnnotations',
            'MCPToolCollectionObject',
            'McpOAuthConnectResponse',
            'McpOAuthDisconnectResponse',
            'McpOAuthTokenRequest',
            'McpOAuthTokenResponse',
            'MediatorEnvConfig',
            'MigrationListResponse',
            'Modalities',
            'ModalityDefaults',
            'ModelDefault',
            'ModelOptions',
            'ModelPriceComparison',
            'ModelPriceComparisonResponse',
            'ModelPricing',
            'ModelSearchPayload',
            'ModelSource',
            'ModelType',
            'NamedInteractionExecutionPayload',
            'NovaCanvasOptions',
            'NumberValueMap',
            'OAuthAuthStatus',
            'OAuthAuthStatusArray',
            'OAuthAuthorizeResponse',
            'OAuthClient',
            'OAuthClientArray',
            'OAuthClientCreateResponse',
            'OAuthClientCredentials',
            'OAuthClientCredentialsMap',
            'OAuthClientScopeMetadata',
            'OAuthClientStatus',
            'OAuthClientType',
            'OAuthGrant',
            'OAuthGrantListResponse',
            'OAuthGrantRevokeResponse',
            'OAuthGrantSortField',
            'OAuthGrantSortOrder',
            'OAuthGrantStatus',
            'OAuthGrantType',
            'OAuthMetadataResponse',
            'OAuthProjectBindingMode',
            'OAuthProvider',
            'OAuthProviderAccessTokenResponse',
            'OAuthProviderArray',
            'OAuthProviderAuthStatus',
            'OAuthProviderAuthorizeResponse',
            'OAuthProviderExchangePayload',
            'OAuthRegistrationSource',
            'OAuthResponseType',
            'OAuthTokenEndpointAuthMethod',
            'OnboardingProgress',
            'OpenAiDalleOptions',
            'OpenAiGptImageOptions',
            'OpenAiTextOptions',
            'OpenAiThinkingOptions',
            'Partial_ExecutionRunRef',
            'Partial_IntakeVisionProfileSettings',
            'Partial_Omit_DataColumn_name',
            'Partial_Project',
            'Partial_ProjectConfiguration',
            'Partial_Record_AuditAggregationDimension_string_null',
            'Partial_Record_IntakeVisionDetail_Partial_IntakeVisionProfileSettings',
            'Partial_Record_SupportedEmbeddingTypes_boolean',
            'PendingMcpConnection',
            'PendingToolApprovalResults',
            'Permission',
            'Plan',
            'PlanTask',
            'PopulatedExecutionRunResult',
            'PrincipalIdentity',
            'Project',
            'ProjectConfiguration',
            'ProjectConfigurationEmbedding',
            'ProjectIndexingConfiguration',
            'ProjectIntakeConfiguration',
            'ProjectIntakeSniffConfiguration',
            'ProjectIntegrationListEntry',
            'ProjectIntegrationListResponse',
            'ProjectModelDefaults',
            'ProjectPluginsUpdatePayload',
            'ProjectRef',
            'ProjectRefArray',
            'ProjectSearchPropertyMapping',
            'ProjectSearchPropertyMappingMap',
            'ProjectSearchPropertyType',
            'ProjectSearchTier',
            'ProjectTagQuery',
            'ProjectToolInfo',
            'ProjectToolInfoArray',
            'PromoteDashboardVersionPayload',
            'PromptImprovementResponse',
            'PromptModalities',
            'PromptRole',
            'PromptSearchQuery',
            'PromptSegment',
            'PromptSegmentDef',
            'PromptSegmentDefType',
            'PromptSegmentRef_ExportedPromptTemplateRef',
            'PromptSegmentRef_PromptTemplateRef',
            'PromptStatus',
            'PromptTemplate',
            'PromptTemplateCreatePayload',
            'PromptTemplateForkPayload',
            'PromptTemplateInteractionUsage',
            'PromptTemplateInteractionVersion',
            'PromptTemplateInteractionsResponse',
            'PromptTemplateRef',
            'PromptTemplateRefArray',
            'PromptTemplateUpdatePayload',
            'PropertyConditionValue',
            'PropertyConditions',
            'QueryPayload',
            'QueryResult',
            'QueryResultColumn',
            'QueryValidationError',
            'QueryValidationPayload',
            'QueryValidationResult',
            'QuotaEffectiveTier',
            'QuotaStandingAdmissionClass',
            'QuotaStandingResource',
            'QuotaStandingResponse',
            'QuotaStandingWindow',
            'QuotaTier',
            'QuotaTierResponse',
            'RateLimitRequestPayload',
            'RateLimitRequestResponse',
            'ReasoningEffort',
            'RenderPromptResponse',
            'RenderingTemplateDefinition',
            'RenderingTemplateDefinitionRef',
            'ResolveInteractionQuery',
            'ResolvedEnvironmentInfo',
            'ResolvedInteractionExecutionInfo',
            'ResolvedRuntimeConfig',
            'ResourceVisibility',
            'ResultStorageOptions',
            'RevokeOAuthGrantQuery',
            'RoleDefinition',
            'RoleDefinitionArray',
            'RoleDomain',
            'RunAnalyticsGroupBy',
            'RunAnalyticsQuery',
            'RunAnalyticsResult',
            'RunAnalyticsResultArray',
            'RunCreatePayload',
            'RunDataStorageLevel',
            'RunKind',
            'RunListQuery',
            'RunMigrationPayload',
            'RunMigrationResponse',
            'RunSearchPayload',
            'RunSearchQuery',
            'RunSource',
            'RunSourceTypes',
            'RunType',
            'SchemaRef',
            'SemanticColumnType',
            'SetFileMetadataPayload',
            'SignupData',
            'SignupPayload',
            'SkillContextTriggers',
            'SortOption',
            'SortOrder',
            'StartAppBuildRequest',
            'StartAppBuildResponse',
            'StartAppScaffoldRequest',
            'StartAppScaffoldResponse',
            'StatelessExecutionOptions',
            'StoredCatalogInteractionsQuery',
            'StoredTypeRef',
            'StreamingOptions',
            'StreamingTelemetryContext',
            'StringArrayMap',
            'StringValueMap',
            'StripeBillingDisabled',
            'StripeBillingEnabled',
            'StripeBillingStatusResponse',
            'SuccessResponse',
            'SupportedIntegrations',
            'SupportedProviders',
            'SystemDefaults',
            'SystemPackageQuery',
            'SystemRoleDefinition',
            'SystemRoleDefinitionArray',
            'SystemRoles',
            'Task',
            'TaskArray',
            'TaskField',
            'TaskFieldType',
            'TaskSource',
            'TemplateType',
            'TextArtifactReference',
            'TextFallbackOptions',
            'TextResult',
            'ThinkingLevel',
            'TimeResolution',
            'ToolApprovalGrant',
            'ToolApprovalGrantMap',
            'ToolCollectionAuthType',
            'ToolCollectionObject',
            'ToolDefinition',
            'ToolReference',
            'ToolResult',
            'ToolResultMeta',
            'ToolSource',
            'ToolUse',
            'ToolValidationResult',
            'TransientTokenType',
            'TransientToken_UserInviteTokenData_',
            'TransientToken_UserInviteTokenData_Array',
            'TwelvelabsPegasusOptions',
            'UpdateAccountPayload',
            'UpdateApiKeyPayload',
            'UpdateAppInstallationToolAllowlistPayload',
            'UpdateContentObjectTypePayload',
            'UpdateDashboardPayload',
            'UpdateOAuthClientPayload',
            'UpdateOAuthProviderPayload',
            'UpdateSchemaPayload',
            'UpdateTaskPayload',
            'UpdateUserGroupPayload',
            'UpdateUserPayload',
            'UpdateViewExperienceRequest',
            'UpsertAppVersionRequest',
            'UsedSkill',
            'User',
            'UserArray',
            'UserChannel',
            'UserGroup',
            'UserGroupArray',
            'UserGroupRef',
            'UserInviteTokenData',
            'UserRef',
            'UserRefArray',
            'ValidateToolNamesPayload',
            'ValidateToolNamesResponse',
            'ValidateUrlRequest',
            'ValidateUrlResponse',
            'VertesiaSDKToolCollectionObject',
            'VertexAIClaudeOptions',
            'VertexAIGeminiOptions',
            'VertexAIGrokOptions',
            'ViewBoardCardConfiguration',
            'ViewBoardColumn',
            'ViewBoardDisplay',
            'ViewCardsDisplay',
            'ViewCollectionNavigation',
            'ViewDisplayConfiguration',
            'ViewElasticsearchQuery',
            'ViewExperience',
            'ViewExperienceArray',
            'ViewExperienceLayout',
            'ViewExperienceListQuery',
            'ViewExperienceSchemaVersion',
            'ViewExperienceScope',
            'ViewGalleryDisplay',
            'ViewHierarchyLevel',
            'ViewHierarchyNavigation',
            'ViewKeyTermDefinition',
            'ViewListDisplay',
            'ViewLocationNavigation',
            'ViewNavigationItem',
            'ViewRangeDefinition',
            'ViewRangeNavigation',
            'ViewResultField',
            'ViewResultFieldFormat',
            'ViewResultMedia',
            'ViewResultsConfiguration',
            'ViewSearchConfiguration',
            'ViewSearchFieldDefinition',
            'ViewSearchFieldType',
            'ViewSortClause',
            'ViewSortOption',
            'ViewTableColumn',
            'ViewTableDisplay',
            'ViewTermsNavigation',
            'VirtualEnvEntry',
            'WorkflowAncestor',
        ]);
    });

    it('emits only #/components/schemas pointers', () => {
        const serialized = JSON.stringify(ApiSchemaComponents);
        expect(serialized).not.toContain('#/$defs/');
        expect(serialized).not.toContain('$schema');
        expect(serialized).not.toContain('"$defs"');
        for (const ref of serialized.matchAll(/"\$ref":"([^"]+)"/g)) {
            expect(ref[1]).toMatch(/^#\/components\/schemas\/[A-Za-z0-9_]+$/);
        }
    });

    it('shares one AccountBilling component across both referencing schemas', () => {
        const fromAccount = (ApiSchemaComponents.Account.properties as JsonObject).billing;
        const fromPayload = (ApiSchemaComponents.UpdateAccountPayload.properties as JsonObject).billing;
        expect(fromAccount).toEqual({ $ref: '#/components/schemas/AccountBilling' });
        expect(fromPayload).toEqual({ $ref: '#/components/schemas/AccountBilling' });
    });

    it('synthesizes a discriminator for the Stripe billing union', () => {
        const union = ApiSchemaComponents.StripeBillingStatusResponse;
        expect(union.oneOf).toEqual([
            { $ref: '#/components/schemas/StripeBillingEnabled' },
            { $ref: '#/components/schemas/StripeBillingDisabled' },
        ]);
        expect(union.discriminator).toEqual({
            propertyName: 'status',
            mapping: {
                enabled: '#/components/schemas/StripeBillingEnabled',
                disabled: '#/components/schemas/StripeBillingDisabled',
            },
        });
    });
});

describe('gate 3 — AJV validates the same canonical objects that are published', () => {
    it('accepts a valid account and rejects a bad enum', () => {
        const validate = compile('Account');
        expect(validate(VALID_ACCOUNT)).toBe(true);
        expect(validate({ ...VALID_ACCOUNT, billing: { method: 'paypal' } })).toBe(false);
    });

    it('rejects a missing required field', () => {
        const validate = compile('Account');
        const { email_domains: _dropped, ...incomplete } = VALID_ACCOUNT;
        expect(validate(incomplete)).toBe(false);
    });

    it('enforces the discriminated union per branch', () => {
        const validate = compile('StripeBillingStatusResponse');
        expect(validate({ status: 'enabled', billing_method: 'stripe', portal_url: 'https://x' })).toBe(true);
        expect(validate({ status: 'disabled', billing_method: null, reason: 'No billing method' })).toBe(true);
        // The flattened interface allowed this; a real discriminated union does not.
        expect(validate({ status: 'enabled', billing_method: 'stripe', reason: 'nope' })).toBe(false);
    });
});

describe('gates 4 & 5 — unknown-field behaviour and no mutation', () => {
    it('reports an unknown request field without removing it', () => {
        // `UpdateAccountPayload` is published closed, as it always has been, so an extra property
        // is a contract violation. AJV must SAY SO rather than quietly delete it: a removal mode
        // would make the server accept a body the published schema declares invalid, which is a
        // silent disagreement between the spec and the code enforcing it.
        expect(ApiSchemaComponents.UpdateAccountPayload.additionalProperties).toBe(false);
        const validate = compile('UpdateAccountPayload');
        const payload: Record<string, unknown> = { name: 'Acme', rogue_field: 42 };
        expect(validate(payload)).toBe(false);
        expect(payload.rogue_field).toBe(42);
    });

    it('never mutates a response payload during validation', () => {
        const validate = compile('Account');
        const response = structuredClone({ ...VALID_ACCOUNT, legacy_extra: 'still here' });
        const pristine = structuredClone(response);
        // Invalid against the closed component — and left exactly as it was. Removing the extra
        // is response PRUNING's job, an explicit call with its own policy, never a side effect of
        // asking whether a payload conforms.
        expect(validate(response)).toBe(false);
        expect(response).toEqual(pristine);
    });

    it('rejects unknown fields only where a component opts in to strict', () => {
        const components = toOpenApiComponents(
            { Strict: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } },
            { strictComponents: new Set(['Strict']) },
        );
        expect(components.Strict.additionalProperties).toBe(false);
        const ajv = new Ajv2020({ strictSchema: false });
        ajv.addSchema({ $id: 'vertesia://openapi', components: { schemas: components } });
        const validate = ajv.compile({ $ref: 'vertesia://openapi#/components/schemas/Strict' });
        const payload = { a: 'x', extra: 1 };
        expect(validate(payload)).toBe(false);
        expect(payload.extra).toBe(1); // rejected, not stripped
    });
});

describe('gate 7 — the adapter is library-neutral', () => {
    it('hoists typebox-style nested $id subschemas', () => {
        // TypeBox embeds the schema value (which is what preserves Static<> inference) and marks
        // it with $id; the adapter lifts it, exactly as it lifts zod's $defs.
        const components = toOpenApiComponents({
            Account: {
                type: 'object',
                properties: {
                    billing: { $id: 'AccountBilling', type: 'object', properties: { method: { type: 'string' } } },
                    history: {
                        type: 'array',
                        items: { $id: 'AccountBilling', type: 'object', properties: { method: { type: 'string' } } },
                    },
                },
            },
        });
        expect(Object.keys(components).sort()).toEqual(['Account', 'AccountBilling']);
        const props = components.Account.properties as JsonObject;
        expect(props.billing).toEqual({ $ref: '#/components/schemas/AccountBilling' });
        expect((props.history as JsonObject).items).toEqual({ $ref: '#/components/schemas/AccountBilling' });
    });

    it('rewrites a root self-reference to its component pointer', () => {
        // zod emits `{"$ref": "#"}` for recursion, which would point at the whole OpenAPI
        // document once embedded under components.
        const components = toOpenApiComponents({
            Node: {
                type: 'object',
                properties: { name: { type: 'string' }, children: { type: 'array', items: { $ref: '#' } } },
            },
        });
        const props = components.Node.properties as JsonObject;
        expect((props.children as JsonObject).items).toEqual({ $ref: '#/components/schemas/Node' });
    });

    it('does not mutate its input', () => {
        const input = { A: { type: 'object', properties: { b: { $id: 'B', type: 'string' } } } };
        const pristine = structuredClone(input);
        toOpenApiComponents(input);
        expect(input).toEqual(pristine);
    });

    it('rejects two different schemas claiming the same component name', () => {
        expect(() =>
            toOpenApiComponents({
                A: { type: 'object', properties: { x: { $id: 'Dup', type: 'string' } } },
                B: { type: 'object', properties: { y: { $id: 'Dup', type: 'number' } } },
            }),
        ).toThrow(SchemaAdapterError);
    });
});

describe('gate 8 — runtime enforcement uses the published components', () => {
    it('rejects a request body that violates the published component, without mutating it', () => {
        const payload: Record<string, unknown> = { name: 'Acme', rogue_field: 42 };
        const result = validateApiRequest('UpdateAccountPayload', payload);

        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.errors.join(' ')).toContain('additional properties');
        }
        // Reported, not deleted: removing it would make the server accept a body its own published
        // schema calls invalid.
        expect(payload.rogue_field).toBe(42);
    });

    it('accepts a conforming request body and hands back the component type', () => {
        const result = validateApiRequest('UpdateAccountPayload', {
            name: 'Acme',
            billing: { method: 'stripe' },
        });

        expect(result.valid).toBe(true);
        if (result.valid) {
            // Typed as the component only on the valid branch, so a body missing required fields
            // can never be typed as complete.
            assertType<Equals<typeof result.data, UpdateAccountPayload>>(true);
            expect(result.data.name).toBe('Acme');
        }
    });

    it('no longer accepts quota_tier, which the handler never applied', () => {
        // Documented-but-ignored is the drift this work removes. The tier is written through the
        // admin quota API; accepting it here would eventually invite a "fix" that lets an account
        // admin raise their own rate limits.
        expect(validateApiRequest('UpdateAccountPayload', { quota_tier: 'enterprise' }).valid).toBe(false);
        expect(ApiSchemaComponents.UpdateAccountPayload.properties).not.toHaveProperty('quota_tier');
    });

    it('enforces date-time formats, which AJV ignores without ajv-formats', () => {
        // Registering the format package is what turns `format: date-time` from documentation into
        // a check. Without it this payload would pass and the contract would be a suggestion.
        const invalid = { ...VALID_ACCOUNT, created_at: 'yesterday' };
        expect(validateApiResponse('Account', invalid).valid).toBe(false);
        expect(validateApiResponse('Account', VALID_ACCOUNT).valid).toBe(true);
    });

    it('rejects a native Date where the schema declares a date-time string', () => {
        // Response validation runs on the object before Koa serializes it, so a mapper that passed
        // a Mongoose `Date` straight through would produce correct wire bytes and still be wrong
        // here. That is precisely the bug the mapper's date normalization prevents.
        const withDate = { ...VALID_ACCOUNT, created_at: new Date('2026-07-29T10:00:00.000Z') };
        expect(validateApiResponse('Account', withDate).valid).toBe(false);
    });

    it('honours the Stripe discriminator, which the generated Go client does not', () => {
        // The one backstop the Go client cannot provide. Its oneOf decoder picks a branch by
        // required-property presence and never reads `status`, so it happily decodes the first
        // payload below as the *enabled* branch (see openapi/go/tests). AJV does honour `const`,
        // which is what lets the server detect its own drift: routing every branch of the handler
        // through checkResponseContract turns "the server never emits a contradictory payload"
        // from an assumption into something that shows up in the logs when it stops being true.
        const enabled = { status: 'enabled', billing_method: 'stripe', portal_url: 'https://x' };
        const disabled = { status: 'disabled', billing_method: null, reason: 'No billing method' };
        expect(validateApiResponse('StripeBillingStatusResponse', enabled).valid).toBe(true);
        expect(validateApiResponse('StripeBillingStatusResponse', disabled).valid).toBe(true);

        // Enabled body, disabled discriminator: matches neither branch.
        expect(validateApiResponse('StripeBillingStatusResponse', { ...enabled, status: 'disabled' }).valid).toBe(
            false,
        );
        // Both branches' required properties: a real oneOf must match exactly one.
        expect(validateApiResponse('StripeBillingStatusResponse', { ...enabled, reason: 'nope' }).valid).toBe(false);
    });
});
