// Imported from llumiverse rather than restated here. These components describe llumiverse's own
// types, and a second declaration in this repository would be a copy that compiles — the drift this
// migration exists to remove. They have no local `./*.ts` module for the same reason: there is
// nothing local to declare.
import {
    AIModelArraySchema,
    AIModelSchema,
    AIModelStatusSchema,
    CompletionResultSchema,
    DataSourceSchema,
    EmbeddingOutputSchema,
    EmbeddingResultItemSchema,
    EmbeddingsResultSchema,
    EmbeddingsTokenUsageSchema,
    EmbeddingTaskTypeSchema,
    ExecutionTokenUsageSchema,
    HttpTimeoutOptionsSchema,
    ImageResultSchema,
    JSONObjectSchema,
    JSONSchemaSchema,
    JSONValueSchema,
    JsonResultSchema,
    ModalitiesSchema,
    ModelOptionsSchema,
    ModelSearchPayloadSchema,
    ModelTypeSchema,
    PromptRoleSchema,
    PromptSegmentSchema,
    StatelessExecutionOptionsSchema,
    TextResultSchema,
    ToolDefinitionSchema,
    ToolUseSchema,
} from '@llumiverse/common/schemas';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import ajvFormats from 'ajv-formats';
import { z } from 'zod';
import type {
    CreateEventSubscriptionPayload,
    EventDeliveryTarget,
    EventDeliveryTargetInput,
    EventSubscription,
    EventSubscriptionMutationResponse,
    ProcessEventDeliveryTarget,
    UpdateEventSubscriptionPayload,
} from '../platform-event.js';
import type {
    AgentRunInternals,
    AgentRunResponse,
    BindRunWorkflowPayload,
    ListAgentRunsResponse,
    ProgrammaticRunResponse,
    RecordRunPayload,
    SupervisedRunResponse,
    UpdateAgentRunStatusPayload,
} from '../store/agent-run.js';
import type * as DSLWorkflowTypes from '../store/dsl-workflow.js';
import type {
    DSLChildWorkflowStep,
    DSLWorkflowDefinition,
    DSLWorkflowDefinitionResponse,
    DSLWorkflowSpec,
    DSLWorkflowSpecWithSteps,
    DSLWorkflowStep,
} from '../store/dsl-workflow.js';
import type {
    BranchNodeBranchDefinition,
    CreateProcessDefinitionPayload,
    NodeDefinition,
    ProcessDefinition,
    ProcessDefinitionBody,
    UpdateProcessDefinitionPayload,
} from '../store/process.js';
import type { ViewNavigationNode } from '../views.js';
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
    AnalyticsAxisSchema,
    RunAnalyticsGroupBySchema,
    RunAnalyticsQuerySchema,
    RunAnalyticsResultArraySchema,
    RunAnalyticsResultSchema,
    TimeResolutionSchema,
} from './analytics.js';
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
    AgentRunSearchHitSchema,
    AgentRunStatusSchema,
    AgentRunTypeSchema,
    AgentToolApprovalClassSchema,
    AgentToolDefinitionSchema,
    AppBuildProgressSchema,
    AppBuildProgressStatusSchema,
    AppBuildTriggerSchema,
    AppDevelopmentTaskDetailsSchema,
    AppDevelopmentTaskListSchema,
    AppDevelopmentTaskSchema,
    AppInspectionCapabilityReportSchema,
    AppInspectionIssueSchema,
    AppInspectionResultSchema,
    AppInstallationKindSchema,
    AppInstallationOAuthBindingSchema,
    AppInstallationPayloadSchema,
    AppInstallationProjectsQuerySchema,
    AppInstallationProviderBindingSchema,
    AppInstallationsQuerySchema,
    AppOAuthCollectionParamsSchema,
    AppOAuthProviderParamsSchema,
    AppPackageScopeSchema,
    AppRepoBranchSchema,
    AppRepoCommitSchema,
    AppRepoCommitsSchema,
    AppRepoDocumentCommitSchema,
    AppRepoRefSchema,
    AppRepoRefsSchema,
    AppRepoTreeEntrySchema,
    AppRepoTreeSchema,
    AppScaffoldModuleSchema,
    AppScaffoldProgressSchema,
    AppScaffoldProgressStatusSchema,
    AppToolCollectionArraySchema,
    AppToolCollectionSchema,
    AppVersionGitRefTypeSchema,
    AppVersionGitSourceSchema,
    AppVersionKindSchema,
    AppVersionRecordArraySchema,
    AppVersionRecordSchema,
    AppVersionStateSchema,
    AppVersionStorageSchema,
    AppVersionTargetSchema,
    AppVersionUrlsSchema,
    ContentObjectTypeRefSchema,
    ConversationActivityStateSchema,
    DeleteAppVersionResponseSchema,
    EventRefSchema,
    Extract_AppVersionGitRefType_branch_tag_commitSchema,
    InCodeTypeRefSchema,
    OAuthClientCredentialsMapSchema,
    OAuthClientCredentialsSchema,
    RunKindSchema,
    RunTypeSchema,
    StartAppBuildRequestSchema,
    StartAppBuildResponseSchema,
    StartAppScaffoldRequestSchema,
    StartAppScaffoldResponseSchema,
    StoredTypeRefSchema,
    SystemPackageQuerySchema,
    UpdateAppInstallationToolAllowlistPayloadSchema,
    UpsertAppVersionRequestSchema,
    ValidateUrlRequestSchema,
    ValidateUrlResponseSchema,
} from './app-lifecycle.js';
import {
    AppAccessControlSchema,
    AppCapabilitiesSchema,
    AppManifestSourceSchema,
    AppSourceConfigSchema,
    AppUIConfigSchema,
    MCPToolAnnotationsSchema,
    McpOAuthConnectResponseSchema,
    McpOAuthDisconnectResponseSchema,
    McpOAuthTokenRequestSchema,
    McpOAuthTokenResponseSchema,
    OAuthAuthorizeResponseSchema,
    OAuthAuthStatusArraySchema,
    OAuthAuthStatusSchema,
    OAuthMetadataResponseSchema,
    ToolCollectionObjectSchema,
} from './apps.js';
import {
    AuditActionSchema,
    AuditAggregationDetailFieldSchema,
    AuditAggregationDetailFilterSchema,
    AuditAggregationDimensionSchema,
    AuditAggregationDistinctFieldSchema,
    AuditAggregationFilterSchema,
    AuditAggregationGroupSchema,
    AuditAggregationMetricSchema,
    AuditAggregationOperationSchema,
    AuditAggregationQuerySchema,
    AuditAggregationResolutionSchema,
    AuditAggregationResponseSchema,
    AuditAggregationRowSchema,
    AuditMeterSchema,
    AuditTrailEventSchema,
    AuditTrailQuerySchema,
    AuditTrailResponseSchema,
    EventCategorySchema,
    KnownAuditActionSchema,
    Partial_Record_AuditAggregationDimension_string_nullSchema,
} from './audit-trail.js';
import {
    BulkObjectCreateResultSchema,
    BulkObjectDeleteResultSchema,
    BulkObjectUpdateResultSchema,
    BulkOperationPayloadSchema,
    BulkOperationResponseSchema,
    BulkOperationResultSchema,
} from './bulk-operation.js';
import {
    DeleteCountResultSchema,
    MigrationListResponseSchema,
    RunMigrationPayloadSchema,
    RunMigrationResponseSchema,
} from './commands.js';
import {
    CostAnalyticsQuerySchema,
    CostAnalyticsResponseSchema,
    CostByDimensionSchema,
    CostExportQuerySchema,
    CostModelPricesQuerySchema,
    CostRunPriceQuerySchema,
    CostRunPriceResponseSchema,
    CostSummarySchema,
    CostTimeSeriesPointSchema,
    ModelPriceComparisonResponseSchema,
    ModelPriceComparisonSchema,
    ModelPricingSchema,
} from './cost-analytics.js';
import {
    CreateDashboardPayloadSchema,
    CreateDashboardSnapshotPayloadSchema,
    DashboardArchiveResultSchema,
    DashboardBulkArchiveResultSchema,
    DashboardBulkDeleteResultSchema,
    DashboardDataSourceSchema,
    DashboardElasticsearchDslSchema,
    DashboardElasticsearchResultMappingSchema,
    DashboardItemArraySchema,
    DashboardItemSchema,
    DashboardLayoutSchema,
    DashboardPanelPositionSchema,
    DashboardPanelSchema,
    DashboardQuerySchema,
    DashboardSchema,
    DashboardSqlDataSourceSchema,
    DashboardStatusSchema,
    DashboardStoreElasticsearchDataSourceSchema,
    DashboardVersionItemArraySchema,
    DashboardVersionItemSchema,
    DashboardVersioningPayloadSchema,
    DashboardVersioningStatusResponseSchema,
    DashboardVersionSchema,
    PromoteDashboardVersionPayloadSchema,
    StringArrayMapSchema,
    UpdateDashboardPayloadSchema,
} from './dashboard.js';
import {
    AlterTableOperationSchema,
    AlterTablePayloadSchema,
    BatchQueryPayloadSchema,
    BatchQueryResultItemSchema,
    BatchQueryResultSchema,
    CreateDataStorePayloadSchema,
    CreateSnapshotPayloadSchema,
    CreateTablePayloadSchema,
    CreateTablesPayloadSchema,
    DataColumnForAIMapSchema,
    DataColumnForAISchema,
    DataColumnSchema,
    DataColumnTypeSchema,
    DataForeignKeyForAISchema,
    DataForeignKeySchema,
    DataIndexSchema,
    DataRelationshipForAISchema,
    DataRelationshipSchema,
    DataRelationshipTypeSchema,
    DataSchemaForAISchema,
    DataSchemaSchema,
    DataStoreArchiveResultSchema,
    DataStoreDownloadInfoSchema,
    DataStoreFullSchemaResponseSchema,
    DataStoreItemArraySchema,
    DataStoreItemSchema,
    DataStoreMutateRowsPayloadSchema,
    DataStoreMutateRowsResultSchema,
    DataStoreSchema,
    DataStoreSchemaResponseSchema,
    DataStoreStatusSchema,
    DataStoreTableDetailSchema,
    DataStoreTableDropResultSchema,
    DataStoreVersionArraySchema,
    DataStoreVersionSchema,
    DataStoreVersionTableStateMapSchema,
    DataStoreVersionTableStateSchema,
    DataTableArraySchema,
    DataTableForAIMapSchema,
    DataTableForAISchema,
    DataTableSchema,
    DataTableSemanticTypeSchema,
    DataTableSummaryArraySchema,
    DataTableSummarySchema,
    GetDataStoreTableQuerySchema,
    ImportDataFormatSchema,
    ImportDataPayloadSchema,
    ImportDataSourceSchema,
    ImportJobSchema,
    ImportStatusSchema,
    ImportTableDataMapSchema,
    ImportTableDataSchema,
    ListDataStoreVersionsQuerySchema,
    Partial_Omit_DataColumn_nameSchema,
    QueryPayloadSchema,
    QueryResultColumnSchema,
    QueryResultSchema,
    QueryValidationErrorSchema,
    QueryValidationPayloadSchema,
    QueryValidationResultSchema,
    SemanticColumnTypeSchema,
    UpdateSchemaPayloadSchema,
} from './data-store.js';
import {
    DocAnalyzeRunStatusResponseSchema,
    DocAnalyzerProgressSchema,
    DocAnalyzerProgressStatusSchema,
    DocProcessorOutputFormatSchema,
    DocumentPrepOptionsSchema,
    DocumentProcessingPhaseSchema,
    GroundedAssistantResponseSchema,
    GroundedExtractionRequestSchema,
    GroundedExtractionResultResponseSchema,
    GroundedExtractionVerdictSchema,
    GroundedVerificationBreakdownSchema,
    MarkdownRenditionFormatSchema,
    PdfRenderingMetadataSchema,
    RenderMarkdownPayloadSchema,
    RenderMarkdownStartResponseSchema,
    RenderMarkdownStatusQuerySchema,
    RenderMarkdownStatusResponseSchema,
    WorkflowExecutionStatusSchema,
} from './document-processing.js';
import {
    EmbeddingsApiAudioInputSchema,
    EmbeddingsApiImageInputSchema,
    EmbeddingsApiInputSchema,
    EmbeddingsApiRequestSchema,
    EmbeddingsApiSourceSchema,
    EmbeddingsApiTextInputSchema,
    EmbeddingsApiVideoInputSchema,
} from './embeddings.js';
import {
    EnableEnvironmentModelPayloadSchema,
    ExecutionEnvironmentArraySchema,
    ExecutionEnvironmentConfigUpdatePayloadSchema,
    ExecutionEnvironmentCreatePayloadSchema,
    ExecutionEnvironmentRefSchema,
    ExecutionEnvironmentSchema,
    ExecutionEnvironmentSettingsSchema,
    ExecutionEnvironmentUpdatePayloadSchema,
    ListEnvironmentsQuerySchema,
    LoadBalancingEnvConfigSchema,
    LoadBalancingEnvEntryConfigSchema,
    MediatorEnvConfigSchema,
    SupportedProvidersSchema,
    VirtualEnvEntrySchema,
} from './environment.js';
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
    AgentResourceActionSchema,
    AgentResourceReferenceSchema,
    AgentResourceTypeSchema,
    AgentRunnerOptionsSchema,
    AgentSearchScope_CollectionSchema,
    AgentSearchScopeSchema,
    AgentToolApprovalModeSchema,
    AsyncCompletionModeSchema,
    AsyncCompletionOptionsSchema,
    AsyncConversationExecutionPayloadSchema,
    AsyncExecutionPayloadSchema,
    AsyncExecutionResultSchema,
    AsyncInteractionExecutionPayloadSchema,
    CachePolicySchema,
    CatalogInteractionRefArraySchema,
    CatalogInteractionRefSchema,
    CatalogTagQuerySchema,
    ComputedFacetResponseSchema,
    ComputeInteractionFacetPayloadSchema,
    ConversationStateSchema,
    ConversationStripOptionsSchema,
    ConversationVisibilitySchema,
    EmailChannelSchema,
    ExecuteInteractionByEndpointHeadersSchema,
    ExecuteInteractionByEndpointQuerySchema,
    ExecutionRunDocRefSchema,
    ExecutionRunInteractionSchema,
    ExecutionRunRefArraySchema,
    ExecutionRunRefSchema,
    ExecutionRunSchema,
    ExecutionRunStatusSchema,
    ExecutionRunWorkflowSchema,
    ExportedPromptTemplateRefSchema,
    ExternalizedToolInputRefSchema,
    ExternalizedToolInputRefsSchema,
    FacetSpecSchema,
    GeneratedInteractionDefinitionArraySchema,
    GeneratedInteractionDefinitionSchema,
    GeneratedInteractionPromptSegmentSchema,
    GeneratedInteractionPromptTemplateSchema,
    GeneratedTestDataRecordArraySchema,
    GeneratedTestDataRecordSchema,
    GenerateInteractionPayloadSchema,
    GenerateTestDataPayloadSchema,
    ImprovePromptPayloadConfigSchema,
    ImprovePromptPayloadSchema,
    InCodePromptSchema,
    InitialToolCallSchema,
    InteractionArraySchema,
    InteractionCreatePayloadSchema,
    InteractionEndpointArraySchema,
    InteractionEndpointQuerySchema,
    InteractionEndpointSchema,
    InteractionExecutionErrorSchema,
    InteractionExecutionPayloadSchema,
    InteractionExecutionResultSchema,
    InteractionForkPayloadSchema,
    InteractionNameArraySchema,
    InteractionNameSchema,
    InteractionPublishPayloadSchema,
    InteractionRefArraySchema,
    InteractionRefSchema,
    InteractionRefWithSchemaArraySchema,
    InteractionRefWithSchemaSchema,
    InteractionSchema,
    InteractionSearchQuerySchema,
    InteractionStatusSchema,
    InteractionsExportPayloadSchema,
    InteractionTagsArraySchema,
    InteractionTagsSchema,
    InteractionUpdatePayloadSchema,
    InteractionVisibilitySchema,
    InteractiveChannelSchema,
    LegacyExecutionRunResultSchema,
    LegacyPopulatedExecutionRunResultSchema,
    LlmCallTypeSchema,
    ModelSourceSchema,
    NamedInteractionExecutionPayloadSchema,
    NumberValueMapSchema,
    Partial_ExecutionRunRefSchema,
    PendingMcpConnectionSchema,
    PendingToolApprovalResultsSchema,
    PlanSchema,
    PlanTaskSchema,
    PopulatedExecutionRunResultSchema,
    PromptImprovementResponseSchema,
    PromptModalitiesSchema,
    PromptSegmentDefSchema,
    PromptSegmentDefTypeSchema,
    PromptSegmentRef_ExportedPromptTemplateRefSchema,
    PromptSegmentRef_PromptTemplateRefSchema,
    PromptStatusSchema,
    PromptTemplateCreatePayloadSchema,
    PromptTemplateRefSchema,
    PromptTemplateSchema,
    PromptTemplateUpdatePayloadSchema,
    RateLimitRequestPayloadSchema,
    RateLimitRequestResponseSchema,
    ResolvedEnvironmentInfoSchema,
    ResolvedInteractionExecutionInfoSchema,
    ResolvedRuntimeConfigSchema,
    ResolveInteractionQuerySchema,
    ResultStorageOptionsSchema,
    RunCreatePayloadSchema,
    RunListQuerySchema,
    RunSearchPayloadSchema,
    RunSearchQuerySchema,
    RunSourceSchema,
    RunSourceTypesSchema,
    SchemaRefSchema,
    SkillContextTriggersSchema,
    SortOptionSchema,
    SortOrderSchema,
    StoredCatalogInteractionsQuerySchema,
    StreamingOptionsSchema,
    StreamingTelemetryContextSchema,
    TemplateTypeSchema,
    TextArtifactReferenceSchema,
    ToolApprovalGrantMapSchema,
    ToolApprovalGrantSchema,
    ToolReferenceSchema,
    ToolResultMetaSchema,
    ToolResultSchema,
    UsedSkillSchema,
    UserChannelSchema,
    WorkflowAncestorSchema,
} from './interaction.js';
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
    CreateOAuthProviderPayloadSchema,
    OAuthProviderAccessTokenResponseSchema,
    OAuthProviderArraySchema,
    OAuthProviderAuthorizeResponseSchema,
    OAuthProviderAuthStatusSchema,
    OAuthProviderExchangePayloadSchema,
    OAuthProviderSchema,
    SuccessResponseSchema,
    UpdateOAuthProviderPayloadSchema,
} from './oauth.js';
import {
    BulkRevokeOAuthGrantsPayloadSchema,
    CreateOAuthClientPayloadSchema,
    ListOAuthGrantsQuerySchema,
    OAuthClientArraySchema,
    OAuthClientCreateResponseSchema,
    OAuthClientSchema,
    OAuthClientScopeMetadataSchema,
    OAuthClientStatusSchema,
    OAuthClientTypeSchema,
    OAuthGrantListResponseSchema,
    OAuthGrantRevokeResponseSchema,
    OAuthGrantSchema,
    OAuthGrantSortFieldSchema,
    OAuthGrantSortOrderSchema,
    OAuthGrantStatusSchema,
    OAuthGrantTypeSchema,
    OAuthProjectBindingModeSchema,
    OAuthRegistrationSourceSchema,
    OAuthResponseTypeSchema,
    OAuthTokenEndpointAuthMethodSchema,
    RevokeOAuthGrantQuerySchema,
    UpdateOAuthClientPayloadSchema,
} from './oauth-server.js';
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
import {
    ComputePromptFacetPayloadSchema,
    PromptSearchQuerySchema,
    PromptTemplateForkPayloadSchema,
    PromptTemplateInteractionsResponseSchema,
    PromptTemplateInteractionUsageSchema,
    PromptTemplateInteractionVersionSchema,
    PromptTemplateRefArraySchema,
    RenderPromptResponseSchema,
} from './prompt.js';
import { QuotaStandingResponseSchema, QuotaTierResponseSchema } from './quota.js';
import {
    ColumnLayoutSchema,
    ContentObjectTypeCatalogEntryArraySchema,
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
    UpdateContentObjectTypePayloadSchema,
} from './store.js';
import * as StsSchemas from './sts.js';
import * as StudioRemainingSchemas from './studio-remaining.js';
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
    AggregatedToolArraySchema,
    AggregatedToolSchema,
    ListProjectToolsQuerySchema,
    ToolSourceSchema,
    ToolValidationResultSchema,
    ValidateToolNamesPayloadSchema,
    ValidateToolNamesResponseSchema,
} from './tools.js';
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
import {
    AgenticViewSearchConfigurationSchema,
    CreateViewExperienceRequestSchema,
    UpdateViewExperienceRequestSchema,
    ViewBoardCardConfigurationSchema,
    ViewBoardColumnSchema,
    ViewBoardDisplaySchema,
    ViewCardsDisplaySchema,
    ViewCollectionNavigationSchema,
    ViewDisplayConfigurationSchema,
    ViewElasticsearchQuerySchema,
    ViewExperienceArraySchema,
    ViewExperienceLayoutSchema,
    ViewExperienceListQuerySchema,
    ViewExperienceSchema,
    ViewExperienceSchemaVersionSchema,
    ViewExperienceScopeSchema,
    ViewGalleryDisplaySchema,
    ViewHierarchyLevelSchema,
    ViewHierarchyNavigationSchema,
    ViewKeyTermDefinitionSchema,
    ViewListDisplaySchema,
    ViewLocationNavigationSchema,
    ViewNavigationItemSchema,
    ViewRangeDefinitionSchema,
    ViewRangeNavigationSchema,
    ViewResultFieldFormatSchema,
    ViewResultFieldSchema,
    ViewResultMediaSchema,
    ViewResultsConfigurationSchema,
    ViewSearchConfigurationSchema,
    ViewSearchFieldDefinitionSchema,
    ViewSearchFieldTypeSchema,
    ViewSortClauseSchema,
    ViewSortOptionSchema,
    ViewTableColumnSchema,
    ViewTableDisplaySchema,
    ViewTermsNavigationSchema,
} from './views.js';
import {
    DriftAnalysisProgressSchema,
    DriftAnalysisResultSchema,
    DriftAnalysisStatusResponseSchema,
    EmbeddingsStatusResponseSchema,
    GenericCommandResponseSchema,
    IndexingStatusResponseSchema,
    ProjectConfigurationEmbeddingEnablePayloadSchema,
    ReindexAgentRunsPayloadSchema,
    ReindexAgentRunsResponseSchema,
    StartProjectReindexPayloadSchema,
} from './zeno-commands.js';
import * as ZenoRemainingSchemas from './zeno-remaining.js';

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
/**
 * The registry, in groups, because the compiler cannot serialize it as one object.
 *
 * At 200 entries `tsc` began refusing the declaration emit with TS7056 — "the inferred type of this
 * node exceeds the maximum length the compiler will serialize". `ApiComponentName` and
 * `ApiComponentType` are both derived from the object, so its full inferred type has to be written
 * into `lib/*.d.ts`, and a Zod schema's type is deeply structural: two hundred of them is the limit.
 * With most of the migration still ahead, raising the ceiling once is not a fix.
 *
 * So the object is declared in groups small enough to serialize, and `ApiSchemaMap` puts them back
 * together as an intersection — which the compiler emits as the type expression it was written as,
 * with no inferred node to serialize. A name is still one of these keys and
 * `ApiComponentType<'Account'>` is still `z.infer<typeof AccountSchema>`.
 *
 * Adding a component means putting it in whichever group fits and nothing else. Add a group when one
 * approaches the size the others already prove is safe, and add its line to `API_SCHEMA_GROUPS` and
 * to `ApiSchemaMap`. The grouping is a compiler accommodation and carries no meaning: nothing reads a
 * component's group, and a component may move between groups freely.
 */
const IAM_AND_ACCOUNT_SCHEMAS = {
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
} as const satisfies Record<string, z.ZodType>;

const PROJECT_AND_APP_SCHEMAS = {
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
} as const satisfies Record<string, z.ZodType>;

/**
 * The studio OAuth surface: providers, clients, grants.
 *
 * A group of its own rather than an addition to one above, for the reason stated on the grouping
 * note: thirty-one components is most of what a group can hold before the declaration emit refuses
 * it, so adding them to an existing group would spend the whole remaining margin at once.
 *
 * The token server's own OAuth surface — authorize, token, device code, consent — is NOT here. It is
 * a different service with its own slots and converts in a later wave; these are the components the
 * three studio resources name.
 */
const OAUTH_SCHEMAS = {
    // Providers: Vertesia as a client of someone else's authorization server.
    SuccessResponse: SuccessResponseSchema,
    OAuthProvider: OAuthProviderSchema,
    OAuthProviderArray: OAuthProviderArraySchema,
    CreateOAuthProviderPayload: CreateOAuthProviderPayloadSchema,
    UpdateOAuthProviderPayload: UpdateOAuthProviderPayloadSchema,
    OAuthProviderAuthStatus: OAuthProviderAuthStatusSchema,
    OAuthProviderAuthorizeResponse: OAuthProviderAuthorizeResponseSchema,
    OAuthProviderAccessTokenResponse: OAuthProviderAccessTokenResponseSchema,
    OAuthProviderExchangePayload: OAuthProviderExchangePayloadSchema,
    // The client and grant enums. Each is published as a component today because it has a
    // TypeScript name, so each is registered rather than inlined — dropping one would rewrite every
    // `$ref` that points at it into an inline enum.
    OAuthClientType: OAuthClientTypeSchema,
    OAuthClientStatus: OAuthClientStatusSchema,
    OAuthRegistrationSource: OAuthRegistrationSourceSchema,
    OAuthProjectBindingMode: OAuthProjectBindingModeSchema,
    OAuthTokenEndpointAuthMethod: OAuthTokenEndpointAuthMethodSchema,
    OAuthGrantType: OAuthGrantTypeSchema,
    OAuthResponseType: OAuthResponseTypeSchema,
    OAuthGrantStatus: OAuthGrantStatusSchema,
    OAuthGrantSortField: OAuthGrantSortFieldSchema,
    OAuthGrantSortOrder: OAuthGrantSortOrderSchema,
    // Clients registered against Vertesia's own OAuth server. `OAuthClientData` is composed into
    // `OAuthClient` rather than hoisted, so it has no component of its own — as today.
    OAuthClient: OAuthClientSchema,
    OAuthClientArray: OAuthClientArraySchema,
    OAuthClientCreateResponse: OAuthClientCreateResponseSchema,
    OAuthClientScopeMetadata: OAuthClientScopeMetadataSchema,
    CreateOAuthClientPayload: CreateOAuthClientPayloadSchema,
    UpdateOAuthClientPayload: UpdateOAuthClientPayloadSchema,
    // Grants. The two query components are registered like any other — they are expanded into
    // parameters rather than published as component bodies, which is what every query contract does.
    OAuthGrant: OAuthGrantSchema,
    ListOAuthGrantsQuery: ListOAuthGrantsQuerySchema,
    RevokeOAuthGrantQuery: RevokeOAuthGrantQuerySchema,
    BulkRevokeOAuthGrantsPayload: BulkRevokeOAuthGrantsPayloadSchema,
    OAuthGrantListResponse: OAuthGrantListResponseSchema,
    OAuthGrantRevokeResponse: OAuthGrantRevokeResponseSchema,
} as const satisfies Record<string, z.ZodType>;

/**
 * The studio execution environments, and everything the twenty slots across `/environments` name.
 *
 * A fifth group, for the same reason the fourth exists: the declaration emit refuses a group much
 * past thirty entries, and this is thirty-six.
 *
 * Half of it is llumiverse's rather than Vertesia's. `AIModel` and the embedding results describe
 * what a driver produces, so their schemas live in `@llumiverse/common/schemas` and are registered
 * from there — the same arrangement `ModelOptions` and `JSONSchema` already use. Registering them
 * here rather than defining them here is the whole point: one definition, whichever package owns it.
 */
const ENVIRONMENT_SCHEMAS = {
    // The environment itself. `ExecutionEnvironmentRef` is the secret-free projection: no
    // environment endpoint returns it, but `ResolvedInteractionExecutionInfo` refs it.
    SupportedProviders: SupportedProvidersSchema,
    ExecutionEnvironmentRef: ExecutionEnvironmentRefSchema,
    ExecutionEnvironment: ExecutionEnvironmentSchema,
    ExecutionEnvironmentArray: ExecutionEnvironmentArraySchema,
    ExecutionEnvironmentSettings: ExecutionEnvironmentSettingsSchema,
    ExecutionEnvironmentCreatePayload: ExecutionEnvironmentCreatePayloadSchema,
    ExecutionEnvironmentUpdatePayload: ExecutionEnvironmentUpdatePayloadSchema,
    ExecutionEnvironmentConfigUpdatePayload: ExecutionEnvironmentConfigUpdatePayloadSchema,
    EnableEnvironmentModelPayload: EnableEnvironmentModelPayloadSchema,
    ListEnvironmentsQuery: ListEnvironmentsQuerySchema,
    // Virtual-environment configuration — the two shapes `config` may take on a virtual provider.
    VirtualEnvEntry: VirtualEnvEntrySchema,
    LoadBalancingEnvConfig: LoadBalancingEnvConfigSchema,
    LoadBalancingEnvEntryConfig: LoadBalancingEnvEntryConfigSchema,
    MediatorEnvConfig: MediatorEnvConfigSchema,
    // Models, from `@llumiverse/common/schemas`. `ModelSearchPayload` is a query contract, so it is
    // expanded into four parameters rather than published as a component body.
    AIModel: AIModelSchema,
    AIModelArray: AIModelArraySchema,
    AIModelStatus: AIModelStatusSchema,
    ModelType: ModelTypeSchema,
    ModelSearchPayload: ModelSearchPayloadSchema,
    // Run analytics, shared with the project-level `/analytics` endpoint.
    RunAnalyticsQuery: RunAnalyticsQuerySchema,
    RunAnalyticsResult: RunAnalyticsResultSchema,
    RunAnalyticsResultArray: RunAnalyticsResultArraySchema,
    RunAnalyticsGroupBy: RunAnalyticsGroupBySchema,
    AnalyticsAxis: AnalyticsAxisSchema,
    TimeResolution: TimeResolutionSchema,
    // Embeddings. The request is Vertesia's (a JSON-friendly source rather than a stream); the
    // result is llumiverse's, unchanged on the wire.
    EmbeddingsApiRequest: EmbeddingsApiRequestSchema,
    EmbeddingsApiInput: EmbeddingsApiInputSchema,
    EmbeddingsApiSource: EmbeddingsApiSourceSchema,
    EmbeddingsApiTextInput: EmbeddingsApiTextInputSchema,
    EmbeddingsApiImageInput: EmbeddingsApiImageInputSchema,
    EmbeddingsApiVideoInput: EmbeddingsApiVideoInputSchema,
    EmbeddingsApiAudioInput: EmbeddingsApiAudioInputSchema,
    EmbeddingTaskType: EmbeddingTaskTypeSchema,
    EmbeddingsResult: EmbeddingsResultSchema,
    EmbeddingResultItem: EmbeddingResultItemSchema,
    EmbeddingOutput: EmbeddingOutputSchema,
    EmbeddingsTokenUsage: EmbeddingsTokenUsageSchema,
} as const satisfies Record<string, z.ZodType>;

/**
 * Interactions, prompts, runs and agent conversations: the sixty-eight slots across the six
 * `/interactions`, `/runs` and `/execute` resources.
 *
 * These are one closure, not six. `Interaction` reaches `PromptSegmentDef` reaches
 * `PromptTemplate`; `InteractionExecutionResult` reaches `ExecutionRun` reaches `ConversationState`
 * reaches the agent plan, the channels and the tool-approval types. A canonical component may not
 * `$ref` a TypeScript-derived one, so the closure holds together or not at all.
 *
 * A hundred and twenty-nine components is far past what one group serializes, so it is five, split
 * along the lines the closure already has. The split is still only a compiler accommodation:
 * nothing reads a component's group.
 *
 * The completion group is llumiverse's. A prompt segment, a tool call and a completion result are
 * llumiverse types, so their schemas live in `@llumiverse/common/schemas` beside the types they
 * derive — the arrangement `ModelOptions`, `JSONSchema` and `AIModel` already use.
 */
const LLM_COMPLETION_SCHEMAS = {
    // What a prompt is made of.
    JSONValue: JSONValueSchema,
    JSONObject: JSONObjectSchema,
    PromptRole: PromptRoleSchema,
    Modalities: ModalitiesSchema,
    DataSource: DataSourceSchema,
    PromptSegment: PromptSegmentSchema,
    // Tools, and what a model returns.
    ToolDefinition: ToolDefinitionSchema,
    ToolUse: ToolUseSchema,
    TextResult: TextResultSchema,
    JsonResult: JsonResultSchema,
    ImageResult: ImageResultSchema,
    CompletionResult: CompletionResultSchema,
    ExecutionTokenUsage: ExecutionTokenUsageSchema,
    // The options a caller may send. `PromptFormatter` is deliberately gone: see the note on
    // `StatelessExecutionOptionsSchema`.
    StatelessExecutionOptions: StatelessExecutionOptionsSchema,
} as const satisfies Record<string, z.ZodType>;

const INTERACTION_SCHEMAS = {
    // The interaction definition and the prompt tree under it.
    InteractionStatus: InteractionStatusSchema,
    InteractionVisibility: InteractionVisibilitySchema,
    PromptModalities: PromptModalitiesSchema,
    PromptStatus: PromptStatusSchema,
    PromptSegmentDefType: PromptSegmentDefTypeSchema,
    TemplateType: TemplateTypeSchema,
    SchemaRef: SchemaRefSchema,
    CachePolicy: CachePolicySchema,
    PromptTemplate: PromptTemplateSchema,
    PromptTemplateCreatePayload: PromptTemplateCreatePayloadSchema,
    PromptTemplateUpdatePayload: PromptTemplateUpdatePayloadSchema,
    PromptTemplateRef: PromptTemplateRefSchema,
    PromptSegmentDef: PromptSegmentDefSchema,
    PromptSegmentRef_PromptTemplateRef: PromptSegmentRef_PromptTemplateRefSchema,
    InCodePrompt: InCodePromptSchema,
    Interaction: InteractionSchema,
    InteractionArray: InteractionArraySchema,
    InteractionRef: InteractionRefSchema,
    InteractionRefArray: InteractionRefArraySchema,
    InteractionName: InteractionNameSchema,
    InteractionNameArray: InteractionNameArraySchema,
    // The export shape and the reduced prompt template it carries.
    ExportedPromptTemplateRef: ExportedPromptTemplateRefSchema,
    PromptSegmentRef_ExportedPromptTemplateRef: PromptSegmentRef_ExportedPromptTemplateRefSchema,
    InteractionRefWithSchema: InteractionRefWithSchemaSchema,
    InteractionRefWithSchemaArray: InteractionRefWithSchemaArraySchema,
    InteractionTags: InteractionTagsSchema,
    InteractionTagsArray: InteractionTagsArraySchema,
    // Endpoints — an interaction's published, executable name.
    InteractionEndpoint: InteractionEndpointSchema,
    InteractionEndpointArray: InteractionEndpointArraySchema,
    InteractionEndpointQuery: InteractionEndpointQuerySchema,
    // Write and search contracts.
    InteractionCreatePayload: InteractionCreatePayloadSchema,
    InteractionUpdatePayload: InteractionUpdatePayloadSchema,
    InteractionPublishPayload: InteractionPublishPayloadSchema,
    InteractionForkPayload: InteractionForkPayloadSchema,
    InteractionsExportPayload: InteractionsExportPayloadSchema,
    InteractionSearchQuery: InteractionSearchQuerySchema,
    ResolveInteractionQuery: ResolveInteractionQuerySchema,
    // The catalog — in-code interactions an app or the system provides, alongside stored ones.
    CatalogInteractionRef: CatalogInteractionRefSchema,
    CatalogInteractionRefArray: CatalogInteractionRefArraySchema,
    CatalogTagQuery: CatalogTagQuerySchema,
    StoredCatalogInteractionsQuery: StoredCatalogInteractionsQuerySchema,
    // What `GET /interactions/resolve/:nameOrId` answers with.
    ModelSource: ModelSourceSchema,
    ResolvedEnvironmentInfo: ResolvedEnvironmentInfoSchema,
    ResolvedInteractionExecutionInfo: ResolvedInteractionExecutionInfoSchema,
    // Facets over the interaction list.
    FacetSpec: FacetSpecSchema,
    NumberValueMap: NumberValueMapSchema,
    ComputeInteractionFacetPayload: ComputeInteractionFacetPayloadSchema,
    ComputedFacetResponse: ComputedFacetResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const INTERACTION_AUTHORING_SCHEMAS = {
    // Prompt improvement, and the two generators behind the authoring screens.
    ImprovePromptPayloadConfig: ImprovePromptPayloadConfigSchema,
    ImprovePromptPayload: ImprovePromptPayloadSchema,
    PromptImprovementResponse: PromptImprovementResponseSchema,
    GenerateTestDataPayload: GenerateTestDataPayloadSchema,
    GeneratedTestDataRecord: GeneratedTestDataRecordSchema,
    GeneratedTestDataRecordArray: GeneratedTestDataRecordArraySchema,
    GenerateInteractionPayload: GenerateInteractionPayloadSchema,
    GeneratedInteractionDefinition: GeneratedInteractionDefinitionSchema,
    GeneratedInteractionDefinitionArray: GeneratedInteractionDefinitionArraySchema,
    GeneratedInteractionPromptTemplate: GeneratedInteractionPromptTemplateSchema,
    GeneratedInteractionPromptSegment: GeneratedInteractionPromptSegmentSchema,
} as const satisfies Record<string, z.ZodType>;

const AGENT_CONVERSATION_SCHEMAS = {
    // How an agent run is configured.
    AgentRunnerOptions: AgentRunnerOptionsSchema,
    AgentSearchScope: AgentSearchScopeSchema,
    AgentSearchScope_Collection: AgentSearchScope_CollectionSchema,
    SkillContextTriggers: SkillContextTriggersSchema,
    InitialToolCall: InitialToolCallSchema,
    ConversationVisibility: ConversationVisibilitySchema,
    ConversationStripOptions: ConversationStripOptionsSchema,
    StreamingOptions: StreamingOptionsSchema,
    StreamingTelemetryContext: StreamingTelemetryContextSchema,
    ResolvedRuntimeConfig: ResolvedRuntimeConfigSchema,
    LlmCallType: LlmCallTypeSchema,
    // Where an interactive agent talks to a human.
    InteractiveChannel: InteractiveChannelSchema,
    EmailChannel: EmailChannelSchema,
    UserChannel: UserChannelSchema,
    // Tools: what was called, what came back, and what a human still has to approve.
    ToolReference: ToolReferenceSchema,
    ToolResult: ToolResultSchema,
    ToolResultMeta: ToolResultMetaSchema,
    ExternalizedToolInputRef: ExternalizedToolInputRefSchema,
    ExternalizedToolInputRefs: ExternalizedToolInputRefsSchema,
    ToolApprovalGrant: ToolApprovalGrantSchema,
    ToolApprovalGrantMap: ToolApprovalGrantMapSchema,
    AgentToolApprovalMode: AgentToolApprovalModeSchema,
    PendingToolApprovalResults: PendingToolApprovalResultsSchema,
    AgentResourceAction: AgentResourceActionSchema,
    AgentResourceType: AgentResourceTypeSchema,
    AgentResourceReference: AgentResourceReferenceSchema,
    PendingMcpConnection: PendingMcpConnectionSchema,
    // The conversation itself, and what it accumulates.
    UsedSkill: UsedSkillSchema,
    PlanTask: PlanTaskSchema,
    Plan: PlanSchema,
    WorkflowAncestor: WorkflowAncestorSchema,
    TextArtifactReference: TextArtifactReferenceSchema,
    ConversationState: ConversationStateSchema,
} as const satisfies Record<string, z.ZodType>;

const EXECUTION_RUN_SCHEMAS = {
    // A run: what was executed, by whom, and how it ended.
    ExecutionRunStatus: ExecutionRunStatusSchema,
    RunSourceTypes: RunSourceTypesSchema,
    RunSource: RunSourceSchema,
    ExecutionRunDocRef: ExecutionRunDocRefSchema,
    ExecutionRunWorkflow: ExecutionRunWorkflowSchema,
    ExecutionRunInteraction: ExecutionRunInteractionSchema,
    ExecutionRun: ExecutionRunSchema,
    ExecutionRunRef: ExecutionRunRefSchema,
    ExecutionRunRefArray: ExecutionRunRefArraySchema,
    Partial_ExecutionRunRef: Partial_ExecutionRunRefSchema,
    RunCreatePayload: RunCreatePayloadSchema,
    // Listing and searching runs.
    SortOrder: SortOrderSchema,
    SortOption: SortOptionSchema,
    RunSearchQuery: RunSearchQuerySchema,
    RunListQuery: RunListQuerySchema,
    RunSearchPayload: RunSearchPayloadSchema,
    // Executing an interaction, synchronously or as a workflow.
    InteractionExecutionPayload: InteractionExecutionPayloadSchema,
    NamedInteractionExecutionPayload: NamedInteractionExecutionPayloadSchema,
    InteractionExecutionResult: InteractionExecutionResultSchema,
    // The retrieve variant, and the two pre-versioning result shapes. See the schema module for why
    // the populated interaction cannot share a component with the create path.
    PopulatedExecutionRunResult: PopulatedExecutionRunResultSchema,
    LegacyExecutionRunResult: LegacyExecutionRunResultSchema,
    LegacyPopulatedExecutionRunResult: LegacyPopulatedExecutionRunResultSchema,
    InteractionExecutionError: InteractionExecutionErrorSchema,
    ResultStorageOptions: ResultStorageOptionsSchema,
    ExecuteInteractionByEndpointQuery: ExecuteInteractionByEndpointQuerySchema,
    ExecuteInteractionByEndpointHeaders: ExecuteInteractionByEndpointHeadersSchema,
    AsyncCompletionMode: AsyncCompletionModeSchema,
    AsyncCompletionOptions: AsyncCompletionOptionsSchema,
    AsyncExecutionPayload: AsyncExecutionPayloadSchema,
    AsyncInteractionExecutionPayload: AsyncInteractionExecutionPayloadSchema,
    AsyncConversationExecutionPayload: AsyncConversationExecutionPayloadSchema,
    AsyncExecutionResult: AsyncExecutionResultSchema,
    // The execution rate limiter.
    RateLimitRequestPayload: RateLimitRequestPayloadSchema,
    RateLimitRequestResponse: RateLimitRequestResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_SCHEMAS = {
    // Zeno files, durable tasks, the content-type catalog and the migration commands.
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
    ContentObjectTypeCatalogEntryArray: ContentObjectTypeCatalogEntryArraySchema,
    InCodeTypeDefinition: InCodeTypeDefinitionSchema,
    CreateContentObjectTypePayload: CreateContentObjectTypePayloadSchema,
    UpdateContentObjectTypePayload: UpdateContentObjectTypePayloadSchema,
    ContentObjectType: ContentObjectTypeSchema,
    ContentObjectTypeCatalogQuery: ContentObjectTypeCatalogQuerySchema,
    ContentObjectTypeListQuery: ContentObjectTypeListQuerySchema,

    DeleteCountResult: DeleteCountResultSchema,
    MigrationListResponse: MigrationListResponseSchema,
    RunMigrationPayload: RunMigrationPayloadSchema,
    RunMigrationResponse: RunMigrationResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_DASHBOARD_SCHEMAS = {
    DashboardElasticsearchResultMapping: DashboardElasticsearchResultMappingSchema,
    DashboardElasticsearchDsl: DashboardElasticsearchDslSchema,
    DashboardSqlDataSource: DashboardSqlDataSourceSchema,
    DashboardVersioningStatusResponse: DashboardVersioningStatusResponseSchema,
    DashboardVersioningPayload: DashboardVersioningPayloadSchema,
    PromoteDashboardVersionPayload: PromoteDashboardVersionPayloadSchema,
    DashboardVersionItem: DashboardVersionItemSchema,
    DashboardStatus: DashboardStatusSchema,
    DashboardLayout: DashboardLayoutSchema,
    DashboardPanelPosition: DashboardPanelPositionSchema,
    DashboardQuery: DashboardQuerySchema,
    DashboardBulkDeleteResult: DashboardBulkDeleteResultSchema,
    DashboardArchiveResult: DashboardArchiveResultSchema,
    CreateDashboardSnapshotPayload: CreateDashboardSnapshotPayloadSchema,
    DashboardBulkArchiveResult: DashboardBulkArchiveResultSchema,
    StringArrayMap: StringArrayMapSchema,
    DashboardStoreElasticsearchDataSource: DashboardStoreElasticsearchDataSourceSchema,
    DashboardVersionItemArray: DashboardVersionItemArraySchema,
    DashboardItem: DashboardItemSchema,
    DashboardPanel: DashboardPanelSchema,
    DashboardDataSource: DashboardDataSourceSchema,
    DashboardItemArray: DashboardItemArraySchema,
    DashboardVersion: DashboardVersionSchema,
    Dashboard: DashboardSchema,
    CreateDashboardPayload: CreateDashboardPayloadSchema,
    UpdateDashboardPayload: UpdateDashboardPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_DATA_STORE_CORE_SCHEMAS = {
    QueryValidationError: QueryValidationErrorSchema,
    QueryValidationPayload: QueryValidationPayloadSchema,
    ListDataStoreVersionsQuery: ListDataStoreVersionsQuerySchema,
    GetDataStoreTableQuery: GetDataStoreTableQuerySchema,
    DataTableSemanticType: DataTableSemanticTypeSchema,
    DataIndex: DataIndexSchema,
    DataForeignKey: DataForeignKeySchema,
    SemanticColumnType: SemanticColumnTypeSchema,
    DataColumnType: DataColumnTypeSchema,
    Partial_Omit_DataColumn_name: Partial_Omit_DataColumn_nameSchema,
    DataRelationshipType: DataRelationshipTypeSchema,
    QueryResultColumn: QueryResultColumnSchema,
    BatchQueryPayload: BatchQueryPayloadSchema,
    QueryResult: QueryResultSchema,
    QueryPayload: QueryPayloadSchema,
    DataStoreMutateRowsResult: DataStoreMutateRowsResultSchema,
    DataStoreMutateRowsPayload: DataStoreMutateRowsPayloadSchema,
    DataTableSummary: DataTableSummarySchema,
    DataStoreVersionTableState: DataStoreVersionTableStateSchema,
    DataStoreStatus: DataStoreStatusSchema,
    ImportDataFormat: ImportDataFormatSchema,
    ImportDataSource: ImportDataSourceSchema,
    DataRelationshipForAI: DataRelationshipForAISchema,
    DataForeignKeyForAI: DataForeignKeyForAISchema,
    DataColumnForAI: DataColumnForAISchema,
    ImportStatus: ImportStatusSchema,
    DataStoreTableDropResult: DataStoreTableDropResultSchema,
    DataStoreArchiveResult: DataStoreArchiveResultSchema,
    CreateSnapshotPayload: CreateSnapshotPayloadSchema,
    DataStoreDownloadInfo: DataStoreDownloadInfoSchema,
    CreateDataStorePayload: CreateDataStorePayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_DATA_STORE_SCHEMA_SCHEMAS = {
    QueryValidationResult: QueryValidationResultSchema,
    DataColumn: DataColumnSchema,
    AlterTableOperation: AlterTableOperationSchema,
    DataRelationship: DataRelationshipSchema,
    CreateTablePayload: CreateTablePayloadSchema,
    BatchQueryResultItem: BatchQueryResultItemSchema,
    DataTableSummaryArray: DataTableSummaryArraySchema,
    DataStoreVersionTableStateMap: DataStoreVersionTableStateMapSchema,
    DataStoreItem: DataStoreItemSchema,
    ImportTableData: ImportTableDataSchema,
    DataStoreTableDetail: DataStoreTableDetailSchema,
    DataColumnForAIMap: DataColumnForAIMapSchema,
    ImportJob: ImportJobSchema,
    CreateTablesPayload: CreateTablesPayloadSchema,
    DataTable: DataTableSchema,
    AlterTablePayload: AlterTablePayloadSchema,
    UpdateSchemaPayload: UpdateSchemaPayloadSchema,
    BatchQueryResult: BatchQueryResultSchema,
    DataStoreVersion: DataStoreVersionSchema,
    DataStoreItemArray: DataStoreItemArraySchema,
    ImportTableDataMap: ImportTableDataMapSchema,
    DataTableForAI: DataTableForAISchema,
    DataStoreFullSchemaResponse: DataStoreFullSchemaResponseSchema,
    DataTableArray: DataTableArraySchema,
    DataSchema: DataSchemaSchema,
    DataStoreVersionArray: DataStoreVersionArraySchema,
    ImportDataPayload: ImportDataPayloadSchema,
    DataTableForAIMap: DataTableForAIMapSchema,
    DataStore: DataStoreSchema,
    DataSchemaForAI: DataSchemaForAISchema,
    DataStoreSchemaResponse: DataStoreSchemaResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_COST_SCHEMAS = {
    CostAnalyticsQuery: CostAnalyticsQuerySchema,
    CostRunPriceQuery: CostRunPriceQuerySchema,
    CostModelPricesQuery: CostModelPricesQuerySchema,
    CostExportQuery: CostExportQuerySchema,
    ModelPricing: ModelPricingSchema,
    CostTimeSeriesPoint: CostTimeSeriesPointSchema,
    CostSummary: CostSummarySchema,
    ModelPriceComparison: ModelPriceComparisonSchema,
    CostByDimension: CostByDimensionSchema,
    ModelPriceComparisonResponse: ModelPriceComparisonResponseSchema,
    CostAnalyticsResponse: CostAnalyticsResponseSchema,
    CostRunPriceResponse: CostRunPriceResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_BULK_OPERATION_SCHEMAS = {
    BulkObjectDeleteResult: BulkObjectDeleteResultSchema,
    BulkObjectUpdateResult: BulkObjectUpdateResultSchema,
    BulkObjectCreateResult: BulkObjectCreateResultSchema,
    BulkOperationResult: BulkOperationResultSchema,
    BulkOperationPayload: BulkOperationPayloadSchema,
    BulkOperationResponse: BulkOperationResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_DOCUMENT_PROCESSING_SCHEMAS = {
    GroundedAssistantResponse: GroundedAssistantResponseSchema,
    GroundedExtractionRequest: GroundedExtractionRequestSchema,
    GroundedVerificationBreakdown: GroundedVerificationBreakdownSchema,
    GroundedExtractionVerdict: GroundedExtractionVerdictSchema,
    DocProcessorOutputFormat: DocProcessorOutputFormatSchema,
    DocAnalyzerProgressStatus: DocAnalyzerProgressStatusSchema,
    DocumentProcessingPhase: DocumentProcessingPhaseSchema,
    WorkflowExecutionStatus: WorkflowExecutionStatusSchema,
    DocumentPrepOptions: DocumentPrepOptionsSchema,
    MarkdownRenditionFormat: MarkdownRenditionFormatSchema,
    RenderMarkdownStatusQuery: RenderMarkdownStatusQuerySchema,
    RenderMarkdownStartResponse: RenderMarkdownStartResponseSchema,
    PdfRenderingMetadata: PdfRenderingMetadataSchema,
    GroundedExtractionResultResponse: GroundedExtractionResultResponseSchema,
    DocAnalyzerProgress: DocAnalyzerProgressSchema,
    RenderMarkdownStatusResponse: RenderMarkdownStatusResponseSchema,
    RenderMarkdownPayload: RenderMarkdownPayloadSchema,
    DocAnalyzeRunStatusResponse: DocAnalyzeRunStatusResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_COMMAND_SCHEMAS = {
    StartProjectReindexPayload: StartProjectReindexPayloadSchema,
    ReindexAgentRunsResponse: ReindexAgentRunsResponseSchema,
    ReindexAgentRunsPayload: ReindexAgentRunsPayloadSchema,
    IndexingStatusResponse: IndexingStatusResponseSchema,
    DriftAnalysisResult: DriftAnalysisResultSchema,
    DriftAnalysisProgress: DriftAnalysisProgressSchema,
    EmbeddingsStatusResponse: EmbeddingsStatusResponseSchema,
    ProjectConfigurationEmbeddingEnablePayload: ProjectConfigurationEmbeddingEnablePayloadSchema,
    GenericCommandResponse: GenericCommandResponseSchema,
    DriftAnalysisStatusResponse: DriftAnalysisStatusResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_1 = {
    DSLWorkflowDefinition: ZenoRemainingSchemas.DSLWorkflowDefinitionSchema,
    AgentMessageType: ZenoRemainingSchemas.AgentMessageTypeSchema,
    DurationValue: ZenoRemainingSchemas.DurationValueSchema,
    ProcessDefinitionMetadata: ZenoRemainingSchemas.ProcessDefinitionMetadataSchema,
    JsonLogicRule: ZenoRemainingSchemas.JsonLogicRuleSchema,
    BranchJoinPolicy: ZenoRemainingSchemas.BranchJoinPolicySchema,
    ParallelFailurePolicy: ZenoRemainingSchemas.ParallelFailurePolicySchema,
    ParallelCollectField: ZenoRemainingSchemas.ParallelCollectFieldSchema,
    ParallelCollectMode: ZenoRemainingSchemas.ParallelCollectModeSchema,
    HumanTaskDefinition: ZenoRemainingSchemas.HumanTaskDefinitionSchema,
    TransitionTrigger: ZenoRemainingSchemas.TransitionTriggerSchema,
    ProcessNodeReturnsDefinition: ZenoRemainingSchemas.ProcessNodeReturnsDefinitionSchema,
    ProcessNodeRunType: ZenoRemainingSchemas.ProcessNodeRunTypeSchema,
    ProcessNodeType: ZenoRemainingSchemas.ProcessNodeTypeSchema,
    ProcessContextDefinition: ZenoRemainingSchemas.ProcessContextDefinitionSchema,
    ProcessScriptInlineSource: ZenoRemainingSchemas.ProcessScriptInlineSourceSchema,
    ProcessScriptLanguage: ZenoRemainingSchemas.ProcessScriptLanguageSchema,
    ProcessDefinitionFormatVersion: ZenoRemainingSchemas.ProcessDefinitionFormatVersionSchema,
    ProcessDefinitionStatus: ZenoRemainingSchemas.ProcessDefinitionStatusSchema,
    GenerationRunMetadata: ZenoRemainingSchemas.GenerationRunMetadataSchema,
    ContentObjectUserPermissions: ZenoRemainingSchemas.ContentObjectUserPermissionsSchema,
    RevisionInfo: ZenoRemainingSchemas.RevisionInfoSchema,
    ContentSource: ZenoRemainingSchemas.ContentSourceSchema,
    ContentObjectStatus: ZenoRemainingSchemas.ContentObjectStatusSchema,
    InheritedPropertyMetadata: ZenoRemainingSchemas.InheritedPropertyMetadataSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_2 = {
    TranscriptSegment: ZenoRemainingSchemas.TranscriptSegmentSchema,
    Embedding: ZenoRemainingSchemas.EmbeddingSchema,
    EventPriority: ZenoRemainingSchemas.EventPrioritySchema,
    ProcessRunType: ZenoRemainingSchemas.ProcessRunTypeSchema,
    AgentDeliveryMatchMode: ZenoRemainingSchemas.AgentDeliveryMatchModeSchema,
    WebhookPayloadMode: ZenoRemainingSchemas.WebhookPayloadModeSchema,
    WebhookSigningMode: ZenoRemainingSchemas.WebhookSigningModeSchema,
    WorkflowRuleInputType: ZenoRemainingSchemas.WorkflowRuleInputTypeSchema,
    SemanticConditionOnError: ZenoRemainingSchemas.SemanticConditionOnErrorSchema,
    SemanticConditionMode: ZenoRemainingSchemas.SemanticConditionModeSchema,
    AgentSemanticEvaluator: ZenoRemainingSchemas.AgentSemanticEvaluatorSchema,
    InteractionSemanticEvaluator: ZenoRemainingSchemas.InteractionSemanticEvaluatorSchema,
    EventIngestSignatureEncoding: ZenoRemainingSchemas.EventIngestSignatureEncodingSchema,
    EventIngestSignatureAlgorithm: ZenoRemainingSchemas.EventIngestSignatureAlgorithmSchema,
    EventIngestResourceRule: ZenoRemainingSchemas.EventIngestResourceRuleSchema,
    CollectionSecuritySettingsResponse: ZenoRemainingSchemas.CollectionSecuritySettingsResponseSchema,
    CollectionMembersUpdateResult: ZenoRemainingSchemas.CollectionMembersUpdateResultSchema,
    CollectionMembersUpdatePayload: ZenoRemainingSchemas.CollectionMembersUpdatePayloadSchema,
    CollectionChildrenUpdateResult: ZenoRemainingSchemas.CollectionChildrenUpdateResultSchema,
    CollectionChildrenUpdatePayload: ZenoRemainingSchemas.CollectionChildrenUpdatePayloadSchema,
    UpdateAgentArtifactContentResponse: ZenoRemainingSchemas.UpdateAgentArtifactContentResponseSchema,
    UpdateAgentArtifactContentPayload: ZenoRemainingSchemas.UpdateAgentArtifactContentPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_3 = {
    TerminateAgentRunResponse: ZenoRemainingSchemas.TerminateAgentRunResponseSchema,
    StartContentObjectExportResponse: ZenoRemainingSchemas.StartContentObjectExportResponseSchema,
    ExportContentObjectsIncludeOptions: ZenoRemainingSchemas.ExportContentObjectsIncludeOptionsSchema,
    ExportContentObjectsFilter: ZenoRemainingSchemas.ExportContentObjectsFilterSchema,
    SupportedEmbeddingTypes: ZenoRemainingSchemas.SupportedEmbeddingTypesSchema,
    SignalAgentPayload: ZenoRemainingSchemas.SignalAgentPayloadSchema,
    SetObjectEmbeddingsResponse: ZenoRemainingSchemas.SetObjectEmbeddingsResponseSchema,
    SemanticEvaluationStatus: ZenoRemainingSchemas.SemanticEvaluationStatusSchema,
    EventDeliveryIntentStatus: ZenoRemainingSchemas.EventDeliveryIntentStatusSchema,
    EventOutboxStatus: ZenoRemainingSchemas.EventOutboxStatusSchema,
    EventDeliverySortField: ZenoRemainingSchemas.EventDeliverySortFieldSchema,
    ContentObjectApiRevision: ZenoRemainingSchemas.ContentObjectApiRevisionSchema,
    scoreAggregationTypes: ZenoRemainingSchemas.scoreAggregationTypesSchema,
    dynamicScalingTypes: ZenoRemainingSchemas.dynamicScalingTypesSchema,
    Record_SearchTypes_number: ZenoRemainingSchemas.Record_SearchTypes_numberSchema,
    EmbeddingSearchConfig: ZenoRemainingSchemas.EmbeddingSearchConfigSchema,
    CollectionStatus: ZenoRemainingSchemas.CollectionStatusSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_4 = {
    RevertProcessDefinitionPayload: ZenoRemainingSchemas.RevertProcessDefinitionPayloadSchema,
    RetryProcessNodePayload: ZenoRemainingSchemas.RetryProcessNodePayloadSchema,
    nd_restart_count_number: ZenoRemainingSchemas.nd_restart_count_numberSchema,
    WorkflowQueryResult: ZenoRemainingSchemas.WorkflowQueryResultSchema,
    PublishProcessDefinitionPayload: ZenoRemainingSchemas.PublishProcessDefinitionPayloadSchema,
    CollectionPropagationResponse: ZenoRemainingSchemas.CollectionPropagationResponseSchema,
    WorkflowUpdatePublishResponse: ZenoRemainingSchemas.WorkflowUpdatePublishResponseSchema,
    PostAgentRunUpdateResponse: ZenoRemainingSchemas.PostAgentRunUpdateResponseSchema,
    FileProcessingStatus: ZenoRemainingSchemas.FileProcessingStatusSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_5 = {
    ListWorkflowRunsPayload: ZenoRemainingSchemas.ListWorkflowRunsPayloadSchema,
    WorkflowRuleItem: ZenoRemainingSchemas.WorkflowRuleItemSchema,
    WorkflowDefinitionRef: ZenoRemainingSchemas.WorkflowDefinitionRefSchema,
    ProcessDefinitionRevisionInfo: ZenoRemainingSchemas.ProcessDefinitionRevisionInfoSchema,
    WebhookEventDeliveryTarget: ZenoRemainingSchemas.WebhookEventDeliveryTargetSchema,
    WorkflowEventDeliveryTarget: ZenoRemainingSchemas.WorkflowEventDeliveryTargetSchema,
    ContentObjectTypeArray: ZenoRemainingSchemas.ContentObjectTypeArraySchema,
    ContentObjectExportArtifactFile: ZenoRemainingSchemas.ContentObjectExportArtifactFileSchema,
    ProcessRunConfig: ZenoRemainingSchemas.ProcessRunConfigSchema,
    ProcessHistoryRef: ZenoRemainingSchemas.ProcessHistoryRefSchema,
    NodeHistoryEntry: ZenoRemainingSchemas.NodeHistoryEntrySchema,
    AgentRunArchiveState: ZenoRemainingSchemas.AgentRunArchiveStateSchema,
    ResourceRef: ZenoRemainingSchemas.ResourceRefSchema,
    WorkflowRun: ZenoRemainingSchemas.WorkflowRunSchema,
    ProcessHistoryResponse: ZenoRemainingSchemas.ProcessHistoryResponseSchema,
    ProcessContextResponse: ZenoRemainingSchemas.ProcessContextResponseSchema,
    ContentObjectTextResponse: ZenoRemainingSchemas.ContentObjectTextResponseSchema,
    GetRenditionResponse: ZenoRemainingSchemas.GetRenditionResponseSchema,
    EventDeliveryQueueFailureSummary: ZenoRemainingSchemas.EventDeliveryQueueFailureSummarySchema,
    EventOutboxQueueSummary: ZenoRemainingSchemas.EventOutboxQueueSummarySchema,
    EventDeliveryQueueSortField: ZenoRemainingSchemas.EventDeliveryQueueSortFieldSchema,
    ContentObjectExportResult: ZenoRemainingSchemas.ContentObjectExportResultSchema,
    ContentObjectExportProgress: ZenoRemainingSchemas.ContentObjectExportProgressSchema,
    PendingActivity: ZenoRemainingSchemas.PendingActivitySchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_6 = {
    AgentTask: ZenoRemainingSchemas.AgentTaskSchema,
    TaskStatus: ZenoRemainingSchemas.TaskStatusSchema,
    TaskType_TIMER: ZenoRemainingSchemas.TaskType_TIMERSchema,
    TaskType_SIGNAL: ZenoRemainingSchemas.TaskType_SIGNALSchema,
    TaskType_CHILD_WORKFLOW: ZenoRemainingSchemas.TaskType_CHILD_WORKFLOWSchema,
    TaskType_ACTIVITY: ZenoRemainingSchemas.TaskType_ACTIVITYSchema,
    EventError: ZenoRemainingSchemas.EventErrorSchema,
    SignalEventProperties: ZenoRemainingSchemas.SignalEventPropertiesSchema,
    AgentArtifactContentResponse: ZenoRemainingSchemas.AgentArtifactContentResponseSchema,
    ExportPropertiesResponse: ZenoRemainingSchemas.ExportPropertiesResponseSchema,
    WorkflowExecutionStartResult: ZenoRemainingSchemas.WorkflowExecutionStartResultSchema,
    WorkflowInputFile: ZenoRemainingSchemas.WorkflowInputFileSchema,
    ViewNavigationNode: ZenoRemainingSchemas.ViewNavigationNodeSchema,
    ViewHitAnnotation: ZenoRemainingSchemas.ViewHitAnnotationSchema,
    ViewExecutionWarning: ZenoRemainingSchemas.ViewExecutionWarningSchema,
    ViewQueryPlanningFailureCode: ZenoRemainingSchemas.ViewQueryPlanningFailureCodeSchema,
    ExecuteViewRequest: ZenoRemainingSchemas.ExecuteViewRequestSchema,
    DeleteContentObjectResult: ZenoRemainingSchemas.DeleteContentObjectResultSchema,
    DeleteContentObjectExportResponse: ZenoRemainingSchemas.DeleteContentObjectExportResponseSchema,
    WorkflowRule: ZenoRemainingSchemas.WorkflowRuleSchema,
    CreateWorkflowRulePayload: ZenoRemainingSchemas.CreateWorkflowRulePayloadSchema,
    ActivityFetchSpec: ZenoRemainingSchemas.ActivityFetchSpecSchema,
    ImportSpec: ZenoRemainingSchemas.ImportSpecSchema,
    WorkflowSearchAttributeValue: ZenoRemainingSchemas.WorkflowSearchAttributeValueSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_7 = {
    EmbeddingMap: ZenoRemainingSchemas.EmbeddingMapSchema,
    CreateCollectionPayload: ZenoRemainingSchemas.CreateCollectionPayloadSchema,
    AgentArtifactUrlResponse: ZenoRemainingSchemas.AgentArtifactUrlResponseSchema,
    FindPayload: ZenoRemainingSchemas.FindPayloadSchema,
    WorkflowActionResponse: ZenoRemainingSchemas.WorkflowActionResponseSchema,
    AnswerProcessTaskPayload: ZenoRemainingSchemas.AnswerProcessTaskPayloadSchema,
    SignalAgentResponse: ZenoRemainingSchemas.SignalAgentResponseSchema,
    AdvanceProcessPayload: ZenoRemainingSchemas.AdvanceProcessPayloadSchema,
    BranchDefinition: ZenoRemainingSchemas.BranchDefinitionSchema,
    ParallelCollectDefinition: ZenoRemainingSchemas.ParallelCollectDefinitionSchema,
    TransitionDefinition: ZenoRemainingSchemas.TransitionDefinitionSchema,
    ProcessScriptSource: ZenoRemainingSchemas.ProcessScriptSourceSchema,
    Transcript: ZenoRemainingSchemas.TranscriptSchema,
    Partial_Record_SupportedEmbeddingTypes_Embedding:
        ZenoRemainingSchemas.Partial_Record_SupportedEmbeddingTypes_EmbeddingSchema,
    AgentEventDeliveryTarget: ZenoRemainingSchemas.AgentEventDeliveryTargetSchema,
    WebhookEventDeliveryTargetInput: ZenoRemainingSchemas.WebhookEventDeliveryTargetInputSchema,
    WorkflowEventDeliveryTargetInput: ZenoRemainingSchemas.WorkflowEventDeliveryTargetInputSchema,
    SemanticEvaluator: ZenoRemainingSchemas.SemanticEvaluatorSchema,
    EventIngestSignatureConfig: ZenoRemainingSchemas.EventIngestSignatureConfigSchema,
    EventIngestTransform: ZenoRemainingSchemas.EventIngestTransformSchema,
    StartContentObjectExportRequest: ZenoRemainingSchemas.StartContentObjectExportRequestSchema,
    SemanticEvaluationRecord: ZenoRemainingSchemas.SemanticEvaluationRecordSchema,
    ListEventDeliveriesPayload: ZenoRemainingSchemas.ListEventDeliveriesPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_8 = {
    VectorSearchQuery: ZenoRemainingSchemas.VectorSearchQuerySchema,
    ComplexCollectionSearchQuery: ZenoRemainingSchemas.ComplexCollectionSearchQuerySchema,
    ConversationFile: ZenoRemainingSchemas.ConversationFileSchema,
    WorkflowRuleItemArray: ZenoRemainingSchemas.WorkflowRuleItemArraySchema,
    WorkflowDefinitionRefArray: ZenoRemainingSchemas.WorkflowDefinitionRefArraySchema,
    Collection: ZenoRemainingSchemas.CollectionSchema,
    EventIngestChannel: ZenoRemainingSchemas.EventIngestChannelSchema,
    ContentObjectExportArtifact: ZenoRemainingSchemas.ContentObjectExportArtifactSchema,
    ProcessState: ZenoRemainingSchemas.ProcessStateSchema,
    AutonomousRunResponse: ZenoRemainingSchemas.AutonomousRunResponseSchema,
    ListWorkflowRunsResponse: ZenoRemainingSchemas.ListWorkflowRunsResponseSchema,
    EventDeliveryQueueSubscriptionSummary: ZenoRemainingSchemas.EventDeliveryQueueSubscriptionSummarySchema,
    EventDeliveryQueueSummaryPayload: ZenoRemainingSchemas.EventDeliveryQueueSummaryPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_9 = {
    ContentObjectExportStatusResponse: ZenoRemainingSchemas.ContentObjectExportStatusResponseSchema,
    TimerTask: ZenoRemainingSchemas.TimerTaskSchema,
    SignalTask: ZenoRemainingSchemas.SignalTaskSchema,
    ChildWorkflowTask: ZenoRemainingSchemas.ChildWorkflowTaskSchema,
    ActivityTask: ZenoRemainingSchemas.ActivityTaskSchema,
    WorkflowRunEvent: ZenoRemainingSchemas.WorkflowRunEventSchema,
    WorkflowExecutionStartResultArray: ZenoRemainingSchemas.WorkflowExecutionStartResultArraySchema,
    WorkflowInput: ZenoRemainingSchemas.WorkflowInputSchema,
    ViewNavigationResult: ZenoRemainingSchemas.ViewNavigationResultSchema,
    ViewExecutionQueryPlan: ZenoRemainingSchemas.ViewExecutionQueryPlanSchema,
    ViewExecutionSearchConfiguration: ZenoRemainingSchemas.ViewExecutionSearchConfigurationSchema,
    DSLRetryPolicy: ZenoRemainingSchemas.DSLRetryPolicySchema,
    ActivityFetchSpecMap: ZenoRemainingSchemas.ActivityFetchSpecMapSchema,
    WorkflowSearchAttributeValueMap: ZenoRemainingSchemas.WorkflowSearchAttributeValueMapSchema,
    CreateContentObjectPayload: ZenoRemainingSchemas.CreateContentObjectPayloadSchema,
    EventIngestChannelMutationResponse: ZenoRemainingSchemas.EventIngestChannelMutationResponseSchema,
    CreateEventIngestChannelPayload: ZenoRemainingSchemas.CreateEventIngestChannelPayloadSchema,
    AgentRun: ZenoRemainingSchemas.AgentRunSchema,
    CreateAgentRunPayload: ZenoRemainingSchemas.CreateAgentRunPayloadSchema,
    ComputeCollectionFacetPayload: ZenoRemainingSchemas.ComputeCollectionFacetPayloadSchema,
    ProcessScriptResource: ZenoRemainingSchemas.ProcessScriptResourceSchema,
    Partial_CreateContentObjectPayload: ZenoRemainingSchemas.Partial_CreateContentObjectPayloadSchema,
    EventSemanticCondition: ZenoRemainingSchemas.EventSemanticConditionSchema,
    UpdateEventIngestChannelPayload: ZenoRemainingSchemas.UpdateEventIngestChannelPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_10 = {
    EventDeliveryIntentSummary: ZenoRemainingSchemas.EventDeliveryIntentSummarySchema,
    ContentObjectApiTypeRef: ZenoRemainingSchemas.ContentObjectApiTypeRefSchema,
    ComplexSearchQuery: ZenoRemainingSchemas.ComplexSearchQuerySchema,
    SearchAgentRunsResponse: ZenoRemainingSchemas.SearchAgentRunsResponseSchema,
    AgentMessageDetails: ZenoRemainingSchemas.AgentMessageDetailsSchema,
    CompactMessage: ZenoRemainingSchemas.CompactMessageSchema,
    CollectionArray: ZenoRemainingSchemas.CollectionArraySchema,
    EventIngestChannelArray: ZenoRemainingSchemas.EventIngestChannelArraySchema,
    ListContentObjectExportsResponse: ZenoRemainingSchemas.ListContentObjectExportsResponseSchema,
    WorkflowRunUpdatesResponse: ZenoRemainingSchemas.WorkflowRunUpdatesResponseSchema,
    EventDeliveryQueueSummaryResponse: ZenoRemainingSchemas.EventDeliveryQueueSummaryResponseSchema,
    WorkflowTask: ZenoRemainingSchemas.WorkflowTaskSchema,
    ExportPropertiesPayload: ZenoRemainingSchemas.ExportPropertiesPayloadSchema,
    ExecuteWorkflowPayload: ZenoRemainingSchemas.ExecuteWorkflowPayloadSchema,
    ViewNavigationResultMap: ZenoRemainingSchemas.ViewNavigationResultMapSchema,
    ViewExecutionSearchResult: ZenoRemainingSchemas.ViewExecutionSearchResultSchema,
    DSLActivityOptions: ZenoRemainingSchemas.DSLActivityOptionsSchema,
    DSLActivitySpec: ZenoRemainingSchemas.DSLActivitySpecSchema,
    WorkflowSearchAttributes: ZenoRemainingSchemas.WorkflowSearchAttributesSchema,
    DSLActivityStep: ZenoRemainingSchemas.DSLActivityStepSchema,
    ContentObjectApiResponse: ZenoRemainingSchemas.ContentObjectApiResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_11 = {
    ComputeObjectFacetPayload: ZenoRemainingSchemas.ComputeObjectFacetPayloadSchema,
    ProcessScriptResourceMap: ZenoRemainingSchemas.ProcessScriptResourceMapSchema,
    EventSubscriptionFilter: ZenoRemainingSchemas.EventSubscriptionFilterSchema,
    EventDeliverySummary: ZenoRemainingSchemas.EventDeliverySummarySchema,
    ContentObjectItemApiResponse: ZenoRemainingSchemas.ContentObjectItemApiResponseSchema,
    ComplexSearchPayload: ZenoRemainingSchemas.ComplexSearchPayloadSchema,
    Partial_AgentMessage: ZenoRemainingSchemas.Partial_AgentMessageSchema,
    ContentObjectItemApiResponseArray: ZenoRemainingSchemas.ContentObjectItemApiResponseArraySchema,
    AgentRunUpdatesResponse: ZenoRemainingSchemas.AgentRunUpdatesResponseSchema,
    WorkflowHistory: ZenoRemainingSchemas.WorkflowHistorySchema,
    ViewHit: ZenoRemainingSchemas.ViewHitSchema,
    ProcessResourcesDefinition: ZenoRemainingSchemas.ProcessResourcesDefinitionSchema,
    ListEventDeliveriesResponse: ZenoRemainingSchemas.ListEventDeliveriesResponseSchema,
    ObjectSearchResponse: ZenoRemainingSchemas.ObjectSearchResponseSchema,
    PostAgentRunUpdatePayload: ZenoRemainingSchemas.PostAgentRunUpdatePayloadSchema,
    WorkflowRunWithDetails: ZenoRemainingSchemas.WorkflowRunWithDetailsSchema,
    ViewExecutionDefinition: ZenoRemainingSchemas.ViewExecutionDefinitionSchema,
    ViewExperienceConfiguration: ZenoRemainingSchemas.ViewExperienceConfigurationSchema,
    ViewExecutionResult: ZenoRemainingSchemas.ViewExecutionResultSchema,
    PreviewViewExperienceRequest: ZenoRemainingSchemas.PreviewViewExperienceRequestSchema,
    AgentRunResponse: ZenoRemainingSchemas.AgentRunResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_12 = {
    BranchNodeBranchDefinition: ZenoRemainingSchemas.BranchNodeBranchDefinitionSchema,
    CreateEventSubscriptionPayload: ZenoRemainingSchemas.CreateEventSubscriptionPayloadSchema,
    CreateProcessDefinitionPayload: ZenoRemainingSchemas.CreateProcessDefinitionPayloadSchema,
    DSLChildWorkflowStep: ZenoRemainingSchemas.DSLChildWorkflowStepSchema,
    DSLWorkflowDefinitionResponse: ZenoRemainingSchemas.DSLWorkflowDefinitionResponseSchema,
    DSLWorkflowSpec: ZenoRemainingSchemas.DSLWorkflowSpecSchema,
    DSLWorkflowSpecWithActivities: ZenoRemainingSchemas.DSLWorkflowSpecWithActivitiesSchema,
    DSLWorkflowSpecWithSteps: ZenoRemainingSchemas.DSLWorkflowSpecWithStepsSchema,
    DSLWorkflowStep: ZenoRemainingSchemas.DSLWorkflowStepSchema,
    EventDeliveryTarget: ZenoRemainingSchemas.EventDeliveryTargetSchema,
    EventDeliveryTargetInput: ZenoRemainingSchemas.EventDeliveryTargetInputSchema,
    EventSubscription: ZenoRemainingSchemas.EventSubscriptionSchema,
    EventSubscriptionArray: ZenoRemainingSchemas.EventSubscriptionArraySchema,
    EventSubscriptionMutationResponse: ZenoRemainingSchemas.EventSubscriptionMutationResponseSchema,
    ListAgentRunsResponse: ZenoRemainingSchemas.ListAgentRunsResponseSchema,
    NodeDefinition: ZenoRemainingSchemas.NodeDefinitionSchema,
    NodeDefinitionMap: ZenoRemainingSchemas.NodeDefinitionMapSchema,
    ProcessDefinition: ZenoRemainingSchemas.ProcessDefinitionSchema,
    ProcessDefinitionArray: ZenoRemainingSchemas.ProcessDefinitionArraySchema,
    ProcessDefinitionBody: ZenoRemainingSchemas.ProcessDefinitionBodySchema,
    ProcessEventDeliveryTarget: ZenoRemainingSchemas.ProcessEventDeliveryTargetSchema,
    ProgrammaticRunResponse: ZenoRemainingSchemas.ProgrammaticRunResponseSchema,
    SupervisedRunResponse: ZenoRemainingSchemas.SupervisedRunResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_SCHEMAS_13 = {
    UpdateEventSubscriptionPayload: ZenoRemainingSchemas.UpdateEventSubscriptionPayloadSchema,
    UpdateProcessDefinitionPayload: ZenoRemainingSchemas.UpdateProcessDefinitionPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const ZENO_REMAINING_PARAMETER_SCHEMAS = {
    AgentRunInternals: ZenoRemainingSchemas.AgentRunInternalsSchema,
    AgentRunArtifactPathArray: ZenoRemainingSchemas.AgentRunArtifactPathArraySchema,
    ContentObjectProcessingPriority: ZenoRemainingSchemas.ContentObjectProcessingPrioritySchema,
    ContentObjectApiResponseArray: ZenoRemainingSchemas.ContentObjectApiResponseArraySchema,
    CostExportCsvResponse: ZenoRemainingSchemas.CostExportCsvResponseSchema,
    AgentRunArtifactUploadHeaders: ZenoRemainingSchemas.AgentRunArtifactUploadHeadersSchema,
    BindRunWorkflowPayload: ZenoRemainingSchemas.BindRunWorkflowPayloadSchema,
    CreateContentObjectHeaders: ZenoRemainingSchemas.CreateContentObjectHeadersSchema,
    CreateContentObjectQuery: ZenoRemainingSchemas.CreateContentObjectQuerySchema,
    AgentRunArtifactQuery: ZenoRemainingSchemas.AgentRunArtifactQuerySchema,
    AgentRunDetailsQuery: ZenoRemainingSchemas.AgentRunDetailsQuerySchema,
    GetObjectRenditionQuery: ZenoRemainingSchemas.GetObjectRenditionQuerySchema,
    WorkflowRunDetailsQuery: ZenoRemainingSchemas.WorkflowRunDetailsQuerySchema,
    WorkflowRunUpdatesQuery: ZenoRemainingSchemas.WorkflowRunUpdatesQuerySchema,
    AgentRunArtifactsQuery: ZenoRemainingSchemas.AgentRunArtifactsQuerySchema,
    ListAgentRunsQuery: ZenoRemainingSchemas.ListAgentRunsQuerySchema,
    RecordAgentRunPayload: ZenoRemainingSchemas.RecordAgentRunPayloadSchema,
    RecordProcessRunPayload: ZenoRemainingSchemas.RecordProcessRunPayloadSchema,
    RecordRunPayload: ZenoRemainingSchemas.RecordRunPayloadSchema,
    AgentRunUpdatesQuery: ZenoRemainingSchemas.AgentRunUpdatesQuerySchema,
    CollectionMembersQuery: ZenoRemainingSchemas.CollectionMembersQuerySchema,
    ListProcessDefinitionsQuery: ZenoRemainingSchemas.ListProcessDefinitionsQuerySchema,
    SearchAgentRunsQuery: ZenoRemainingSchemas.SearchAgentRunsQuerySchema,
    ServerSentEventsResponse: ZenoRemainingSchemas.ServerSentEventsResponseSchema,
    StreamAgentRunQuery: ZenoRemainingSchemas.StreamAgentRunQuerySchema,
    StreamEventDeliveriesQuery: ZenoRemainingSchemas.StreamEventDeliveriesQuerySchema,
    WorkflowRunStreamQuery: ZenoRemainingSchemas.WorkflowRunStreamQuerySchema,
    UpdateContentObjectHeaders: ZenoRemainingSchemas.UpdateContentObjectHeadersSchema,
    UpdateContentObjectQuery: ZenoRemainingSchemas.UpdateContentObjectQuerySchema,
    UpdateAgentRunStatusPayload: ZenoRemainingSchemas.UpdateAgentRunStatusPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

/**
 * Merges the groups, refusing a name that appears in more than one.
 *
 * A spread would accept the duplicate and keep the LAST group's schema, while
 * {@link ApiComponentType} — which indexes the intersection of the groups — would resolve to the
 * intersection of BOTH. That is the exact type/runtime split this registry exists to make impossible:
 * validation would enforce one shape while every handler was typed against another, and nothing
 * downstream would report it. Registering a component twice is always a mistake, so it fails loudly
 * at module load rather than being resolved by an ordering rule nobody can see.
 *
 * Not expressible in the type system: the groups are separate objects, so a name in two of them is
 * a legal union member, not a compile error.
 *
 * Exported only so the registry's tests can drive it with groups that DO collide; the real call is
 * the one below, and it runs at module load, so a duplicate in the real groups fails every import
 * of this module rather than waiting for a test to look.
 */
export function mergeComponentGroups(groups: Record<string, z.ZodType>[]): Record<string, z.ZodType> {
    const merged: Record<string, z.ZodType> = {};
    const duplicates: string[] = [];
    for (const group of groups) {
        for (const [name, schema] of Object.entries(group)) {
            if (name in merged) {
                duplicates.push(name);
            }
            merged[name] = schema;
        }
    }
    if (duplicates.length > 0) {
        throw new Error(
            `API component${duplicates.length > 1 ? 's' : ''} registered in more than one group: ` +
                `${duplicates.sort().join(', ')}. Each component must be listed in exactly one group — ` +
                'a duplicate makes the runtime schema and ApiComponentType disagree.',
        );
    }
    return merged;
}

const PROMPT_AUTHORING_SCHEMAS = {
    // The prompt-authoring endpoints: fork, render, search and the interaction usages a prompt
    // reports. `PromptTemplate` itself and its write payloads live with the interactions, which is
    // where the prompt tree they reference is defined.
    RenderPromptResponse: RenderPromptResponseSchema,
    PromptTemplateInteractionVersion: PromptTemplateInteractionVersionSchema,
    PromptTemplateForkPayload: PromptTemplateForkPayloadSchema,
    PromptSearchQuery: PromptSearchQuerySchema,
    PromptTemplateInteractionUsage: PromptTemplateInteractionUsageSchema,
    ComputePromptFacetPayload: ComputePromptFacetPayloadSchema,
    PromptTemplateInteractionsResponse: PromptTemplateInteractionsResponseSchema,
    PromptTemplateRefArray: PromptTemplateRefArraySchema,
} as const satisfies Record<string, z.ZodType>;

const PROJECT_TOOL_SCHEMAS = {
    // The unified project-scoped tool registry: what `GET /tools` aggregates across
    // builtins, installed apps and interactions, and what `POST /tools/validate` resolves.
    ToolSource: ToolSourceSchema,
    ValidateToolNamesPayload: ValidateToolNamesPayloadSchema,
    ToolValidationResult: ToolValidationResultSchema,
    AggregatedTool: AggregatedToolSchema,
    ValidateToolNamesResponse: ValidateToolNamesResponseSchema,
    AggregatedToolArray: AggregatedToolArraySchema,
    ListProjectToolsQuery: ListProjectToolsQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const REMOTE_MCP_SCHEMAS = {
    // The OAuth handshake a remote MCP tool collection performs. Grouped by the
    // endpoints that serve it, though the schemas live in `./apps.js` beside the installation
    // they belong to.
    MCPToolAnnotations: MCPToolAnnotationsSchema,
    McpOAuthTokenResponse: McpOAuthTokenResponseSchema,
    McpOAuthTokenRequest: McpOAuthTokenRequestSchema,
    OAuthAuthStatus: OAuthAuthStatusSchema,
    OAuthMetadataResponse: OAuthMetadataResponseSchema,
    McpOAuthDisconnectResponse: McpOAuthDisconnectResponseSchema,
    McpOAuthConnectResponse: McpOAuthConnectResponseSchema,
    OAuthAuthorizeResponse: OAuthAuthorizeResponseSchema,
    OAuthAuthStatusArray: OAuthAuthStatusArraySchema,
} as const satisfies Record<string, z.ZodType>;

const AUDIT_TRAIL_SCHEMAS = {
    // The audit trail: the events the endpoint pages through and the aggregation it
    // computes over them.
    AuditMeter: AuditMeterSchema,
    KnownAuditAction: KnownAuditActionSchema,
    EventCategory: EventCategorySchema,
    Partial_Record_AuditAggregationDimension_string_null: Partial_Record_AuditAggregationDimension_string_nullSchema,
    AuditAggregationDistinctField: AuditAggregationDistinctFieldSchema,
    AuditAggregationOperation: AuditAggregationOperationSchema,
    AuditAggregationResolution: AuditAggregationResolutionSchema,
    AuditAggregationDimension: AuditAggregationDimensionSchema,
    AuditAggregationDetailField: AuditAggregationDetailFieldSchema,
    AuditAction: AuditActionSchema,
    AuditAggregationRow: AuditAggregationRowSchema,
    AuditAggregationMetric: AuditAggregationMetricSchema,
    AuditAggregationGroup: AuditAggregationGroupSchema,
    AuditAggregationDetailFilter: AuditAggregationDetailFilterSchema,
    AuditTrailEvent: AuditTrailEventSchema,
    AuditAggregationResponse: AuditAggregationResponseSchema,
    AuditAggregationFilter: AuditAggregationFilterSchema,
    AuditTrailResponse: AuditTrailResponseSchema,
    AuditAggregationQuery: AuditAggregationQuerySchema,
    AuditTrailQuery: AuditTrailQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const VIEW_EXPERIENCE_SCHEMAS = {
    // View experiences: the search, navigation, results and display configuration a
    // curated content view is assembled from. The largest single closure in the migration so far.
    ViewExperienceSchemaVersion: ViewExperienceSchemaVersionSchema,
    ViewSortClause: ViewSortClauseSchema,
    ViewResultMedia: ViewResultMediaSchema,
    ViewResultFieldFormat: ViewResultFieldFormatSchema,
    ViewBoardColumn: ViewBoardColumnSchema,
    ViewTableColumn: ViewTableColumnSchema,
    AgenticViewSearchConfiguration: AgenticViewSearchConfigurationSchema,
    ViewSearchFieldType: ViewSearchFieldTypeSchema,
    ViewSearchFieldDefinition: ViewSearchFieldDefinitionSchema,
    ViewRangeDefinition: ViewRangeDefinitionSchema,
    ViewHierarchyLevel: ViewHierarchyLevelSchema,
    ViewTermsNavigation: ViewTermsNavigationSchema,
    ViewCollectionNavigation: ViewCollectionNavigationSchema,
    ViewLocationNavigation: ViewLocationNavigationSchema,
    ViewElasticsearchQuery: ViewElasticsearchQuerySchema,
    ViewExperienceLayout: ViewExperienceLayoutSchema,
    ViewSortOption: ViewSortOptionSchema,
    ViewResultField: ViewResultFieldSchema,
    ViewTableDisplay: ViewTableDisplaySchema,
    ViewListDisplay: ViewListDisplaySchema,
    ViewKeyTermDefinition: ViewKeyTermDefinitionSchema,
    ViewRangeNavigation: ViewRangeNavigationSchema,
    ViewHierarchyNavigation: ViewHierarchyNavigationSchema,
    ViewExperienceScope: ViewExperienceScopeSchema,
    ViewBoardCardConfiguration: ViewBoardCardConfigurationSchema,
    ViewSearchConfiguration: ViewSearchConfigurationSchema,
    ViewNavigationItem: ViewNavigationItemSchema,
    ViewBoardDisplay: ViewBoardDisplaySchema,
    ViewCardsDisplay: ViewCardsDisplaySchema,
    ViewGalleryDisplay: ViewGalleryDisplaySchema,
    ViewDisplayConfiguration: ViewDisplayConfigurationSchema,
    ViewResultsConfiguration: ViewResultsConfigurationSchema,
    CreateViewExperienceRequest: CreateViewExperienceRequestSchema,
    ViewExperience: ViewExperienceSchema,
    UpdateViewExperienceRequest: UpdateViewExperienceRequestSchema,
    ViewExperienceArray: ViewExperienceArraySchema,
    ViewExperienceListQuery: ViewExperienceListQuerySchema,
} as const satisfies Record<string, z.ZodType>;

/**
 * Every registered component, keyed by the name it publishes under.
 *
 * Annotated rather than inferred: the precise per-key types live on the groups above, and this
 * is only ever iterated, so widening the values here is what keeps the merged object from
 * re-creating the type the split exists to avoid.
 */
const APP_LIFECYCLE_SCHEMAS = {
    // What an app does once it exists: versions, builds, scaffolds, git repositories,
    // development tasks, installations and inspection. The manifest itself is still derived; see
    // the note in `./app-lifecycle.js` for what blocks it.
    UpdateAppInstallationToolAllowlistPayload: UpdateAppInstallationToolAllowlistPayloadSchema,
    ValidateUrlResponse: ValidateUrlResponseSchema,
    ValidateUrlRequest: ValidateUrlRequestSchema,
    AppVersionUrls: AppVersionUrlsSchema,
    AppVersionGitRefType: AppVersionGitRefTypeSchema,
    AppVersionTarget: AppVersionTargetSchema,
    AppVersionState: AppVersionStateSchema,
    AppVersionKind: AppVersionKindSchema,
    StartAppScaffoldResponse: StartAppScaffoldResponseSchema,
    AppScaffoldModule: AppScaffoldModuleSchema,
    AppBuildTrigger: AppBuildTriggerSchema,
    Extract_AppVersionGitRefType_branch_tag_commit: Extract_AppVersionGitRefType_branch_tag_commitSchema,
    StartAppBuildResponse: StartAppBuildResponseSchema,
    AgentToolApprovalClass: AgentToolApprovalClassSchema,
    AppDevelopmentTask: AppDevelopmentTaskSchema,
    AppInstallationProviderBinding: AppInstallationProviderBindingSchema,
    AppInstallationOAuthBinding: AppInstallationOAuthBindingSchema,
    OAuthClientCredentials: OAuthClientCredentialsSchema,
    AppPackageScope: AppPackageScopeSchema,
    AppInspectionCapabilityReport: AppInspectionCapabilityReportSchema,
    AppScaffoldProgressStatus: AppScaffoldProgressStatusSchema,
    AppRepoTreeEntry: AppRepoTreeEntrySchema,
    AppRepoRef: AppRepoRefSchema,
    AppRepoCommit: AppRepoCommitSchema,
    AgentRunType: AgentRunTypeSchema,
    EventRef: EventRefSchema,
    InCodeTypeRef: InCodeTypeRefSchema,
    StoredTypeRef: StoredTypeRefSchema,
    ConversationActivityState: ConversationActivityStateSchema,
    AgentRunStatus: AgentRunStatusSchema,
    RunKind: RunKindSchema,
    RunType: RunTypeSchema,
    AppBuildProgressStatus: AppBuildProgressStatusSchema,
    DeleteAppVersionResponse: DeleteAppVersionResponseSchema,
    AppRepoBranch: AppRepoBranchSchema,
    AppRepoDocumentCommit: AppRepoDocumentCommitSchema,
    AppVersionGitSource: AppVersionGitSourceSchema,
    StartAppScaffoldRequest: StartAppScaffoldRequestSchema,
    StartAppBuildRequest: StartAppBuildRequestSchema,
    AgentToolDefinition: AgentToolDefinitionSchema,
    AppDevelopmentTaskList: AppDevelopmentTaskListSchema,
    OAuthClientCredentialsMap: OAuthClientCredentialsMapSchema,
    AppOAuthCollectionParams: AppOAuthCollectionParamsSchema,
    AppInspectionIssue: AppInspectionIssueSchema,
    AppScaffoldProgress: AppScaffoldProgressSchema,
    AppRepoTree: AppRepoTreeSchema,
    AppRepoRefs: AppRepoRefsSchema,
    AppRepoCommits: AppRepoCommitsSchema,
    ContentObjectTypeRef: ContentObjectTypeRefSchema,
    AppBuildProgress: AppBuildProgressSchema,
    AppVersionStorage: AppVersionStorageSchema,
    AppToolCollection: AppToolCollectionSchema,
    AppOAuthProviderParams: AppOAuthProviderParamsSchema,
    AppInspectionResult: AppInspectionResultSchema,
    AppVersionRecord: AppVersionRecordSchema,
    AgentRunSearchHit: AgentRunSearchHitSchema,
    UpsertAppVersionRequest: UpsertAppVersionRequestSchema,
    AppInstallationPayload: AppInstallationPayloadSchema,
    AppDevelopmentTaskDetails: AppDevelopmentTaskDetailsSchema,
    AppVersionRecordArray: AppVersionRecordArraySchema,
    AppToolCollectionArray: AppToolCollectionArraySchema,
    AppInstallationKind: AppInstallationKindSchema,
    AppInstallationsQuery: AppInstallationsQuerySchema,
    AppInstallationProjectsQuery: AppInstallationProjectsQuerySchema,
    SystemPackageQuery: SystemPackageQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const STUDIO_REMAINING_SCHEMAS_1 = {
    WebsiteCredentialTotpAlgorithm: StudioRemainingSchemas.WebsiteCredentialTotpAlgorithmSchema,
    WebsiteCredentialTotpMetadata: StudioRemainingSchemas.WebsiteCredentialTotpMetadataSchema,
    WebsiteCredentialSecretInput: StudioRemainingSchemas.WebsiteCredentialSecretInputSchema,
    WebsiteCredentialCapability: StudioRemainingSchemas.WebsiteCredentialCapabilitySchema,
    WebsiteCredentialWebsite: StudioRemainingSchemas.WebsiteCredentialWebsiteSchema,
    SecretKind: StudioRemainingSchemas.SecretKindSchema,
    SupportedIntegrations_ask_user_webhook: StudioRemainingSchemas.SupportedIntegrations_ask_user_webhookSchema,
    SupportedIntegrations_resend: StudioRemainingSchemas.SupportedIntegrations_resendSchema,
    SupportedIntegrations_linkup: StudioRemainingSchemas.SupportedIntegrations_linkupSchema,
    SupportedIntegrations_exa: StudioRemainingSchemas.SupportedIntegrations_exaSchema,
    SupportedIntegrations_serper: StudioRemainingSchemas.SupportedIntegrations_serperSchema,
    SupportedIntegrations_magic_pdf: StudioRemainingSchemas.SupportedIntegrations_magic_pdfSchema,
    SupportedIntegrations_aws: StudioRemainingSchemas.SupportedIntegrations_awsSchema,
    SupportedIntegrations_github: StudioRemainingSchemas.SupportedIntegrations_githubSchema,
    SupportedIntegrations_gladia: StudioRemainingSchemas.SupportedIntegrations_gladiaSchema,
    CompositeAppNavItemPermissions: StudioRemainingSchemas.CompositeAppNavItemPermissionsSchema,
    CompositeAppEntry: StudioRemainingSchemas.CompositeAppEntrySchema,
    CompositeAppHomePlugin: StudioRemainingSchemas.CompositeAppHomePluginSchema,
    CompositeAppThemeOverrides: StudioRemainingSchemas.CompositeAppThemeOverridesSchema,
    CompositeAppHeaderItemTarget: StudioRemainingSchemas.CompositeAppHeaderItemTargetSchema,
} as const satisfies Record<string, z.ZodType>;

const STUDIO_REMAINING_SCHEMAS_2 = {
    CompositeAppHeaderItemKind: StudioRemainingSchemas.CompositeAppHeaderItemKindSchema,
    CompositeAppUserMenuOverrides: StudioRemainingSchemas.CompositeAppUserMenuOverridesSchema,
    CompositeAppHeaderOverrides: StudioRemainingSchemas.CompositeAppHeaderOverridesSchema,
    CompositeAppSidebarOverrides: StudioRemainingSchemas.CompositeAppSidebarOverridesSchema,
    CompositeAppSwitchersOverrides: StudioRemainingSchemas.CompositeAppSwitchersOverridesSchema,
    CompositeAppMessageStyle: StudioRemainingSchemas.CompositeAppMessageStyleSchema,
    CompositeAppLogoOverrides: StudioRemainingSchemas.CompositeAppLogoOverridesSchema,
    CompositeAppCardOverrides: StudioRemainingSchemas.CompositeAppCardOverridesSchema,
    MCPOAuthConfigMap: StudioRemainingSchemas.MCPOAuthConfigMapSchema,
    WebsiteCredentialRecord: StudioRemainingSchemas.WebsiteCredentialRecordSchema,
    InCodeViewDefinition: StudioRemainingSchemas.InCodeViewDefinitionSchema,
    InCodeTypeDefinitionArray: StudioRemainingSchemas.InCodeTypeDefinitionArraySchema,
    RenderingTemplateDefinitionRefArray: StudioRemainingSchemas.RenderingTemplateDefinitionRefArraySchema,
    InCodeProcessDefinition: StudioRemainingSchemas.InCodeProcessDefinitionSchema,
    AppInstallation: StudioRemainingSchemas.AppInstallationSchema,
    AskUserWebhookConfiguration: StudioRemainingSchemas.AskUserWebhookConfigurationSchema,
    ResendConfiguration: StudioRemainingSchemas.ResendConfigurationSchema,
    LinkupConfiguration: StudioRemainingSchemas.LinkupConfigurationSchema,
    ExaConfiguration: StudioRemainingSchemas.ExaConfigurationSchema,
    SerperConfiguration: StudioRemainingSchemas.SerperConfigurationSchema,
} as const satisfies Record<string, z.ZodType>;

const STUDIO_REMAINING_SCHEMAS_3 = {
    GithubConfiguration: StudioRemainingSchemas.GithubConfigurationSchema,
    GladiaConfiguration: StudioRemainingSchemas.GladiaConfigurationSchema,
    RemoteActivityDefinition: StudioRemainingSchemas.RemoteActivityDefinitionSchema,
    AppWidgetInfo: StudioRemainingSchemas.AppWidgetInfoSchema,
    AppDashboardDefinition: StudioRemainingSchemas.AppDashboardDefinitionSchema,
    WebsiteCredentialFillResponse: StudioRemainingSchemas.WebsiteCredentialFillResponseSchema,
    WebsiteCredentialFillRequest: StudioRemainingSchemas.WebsiteCredentialFillRequestSchema,
    ok_boolean: StudioRemainingSchemas.ok_booleanSchema,
    WebsiteCredentialMetadata: StudioRemainingSchemas.WebsiteCredentialMetadataSchema,
    AppManifestData: StudioRemainingSchemas.AppManifestDataSchema,
    Partial_WebsiteCredentialMetadata: StudioRemainingSchemas.Partial_WebsiteCredentialMetadataSchema,
    AskUserWebhookConfigurationInput: StudioRemainingSchemas.AskUserWebhookConfigurationInputSchema,
    ResendConfigurationInput: StudioRemainingSchemas.ResendConfigurationInputSchema,
    LinkupConfigurationInput: StudioRemainingSchemas.LinkupConfigurationInputSchema,
    ExaConfigurationInput: StudioRemainingSchemas.ExaConfigurationInputSchema,
    SerperConfigurationInput: StudioRemainingSchemas.SerperConfigurationInputSchema,
    MagicPdfConfiguration: StudioRemainingSchemas.MagicPdfConfigurationSchema,
    AwsConfiguration: StudioRemainingSchemas.AwsConfigurationSchema,
    GithubConfigurationInput: StudioRemainingSchemas.GithubConfigurationInputSchema,
    GladiaConfigurationInput: StudioRemainingSchemas.GladiaConfigurationInputSchema,
} as const satisfies Record<string, z.ZodType>;

const STUDIO_REMAINING_SCHEMAS_4 = {
    CompositeAppMenuNavItem: StudioRemainingSchemas.CompositeAppMenuNavItemSchema,
    CompositeAppHeaderItem: StudioRemainingSchemas.CompositeAppHeaderItemSchema,
    CompositeAppMessageOverrides: StudioRemainingSchemas.CompositeAppMessageOverridesSchema,
    AppManifest: StudioRemainingSchemas.AppManifestSchema,
    SecretRecord: StudioRemainingSchemas.SecretRecordSchema,
    InCodeViewDefinitionArray: StudioRemainingSchemas.InCodeViewDefinitionArraySchema,
    InCodeProcessDefinitionArray: StudioRemainingSchemas.InCodeProcessDefinitionArraySchema,
    AppManifestArray: StudioRemainingSchemas.AppManifestArraySchema,
    AppInstallationWithManifest: StudioRemainingSchemas.AppInstallationWithManifestSchema,
    AppInstallationArray: StudioRemainingSchemas.AppInstallationArraySchema,
    AppInstallationListEntry: StudioRemainingSchemas.AppInstallationListEntrySchema,
    ProjectIntegrationConfigResponse: StudioRemainingSchemas.ProjectIntegrationConfigResponseSchema,
    AppWidgetInfoMap: StudioRemainingSchemas.AppWidgetInfoMapSchema,
    CreateSecretRequest: StudioRemainingSchemas.CreateSecretRequestSchema,
    UpdateSecretRequest: StudioRemainingSchemas.UpdateSecretRequestSchema,
    ProjectIntegrationConfigRequest: StudioRemainingSchemas.ProjectIntegrationConfigRequestSchema,
    CompositeAppMenuSection: StudioRemainingSchemas.CompositeAppMenuSectionSchema,
    PromoteAppVersionResponse: StudioRemainingSchemas.PromoteAppVersionResponseSchema,
    ListSecretsResponse: StudioRemainingSchemas.ListSecretsResponseSchema,
    AppInstallationWithManifestArray: StudioRemainingSchemas.AppInstallationWithManifestArraySchema,
} as const satisfies Record<string, z.ZodType>;

const STUDIO_REMAINING_SCHEMAS_5 = {
    AppInstallationListEntryArray: StudioRemainingSchemas.AppInstallationListEntryArraySchema,
    CompositeAppConfig: StudioRemainingSchemas.CompositeAppConfigSchema,
    AppPackage: StudioRemainingSchemas.AppPackageSchema,
    Partial_Omit_CompositeAppConfig_id_project: StudioRemainingSchemas.Partial_Omit_CompositeAppConfig_id_projectSchema,
    CompositeAppConfigPayload: StudioRemainingSchemas.CompositeAppConfigPayloadSchema,
    SecretProjectQuery: StudioRemainingSchemas.SecretProjectQuerySchema,
    ListSecretsQuery: StudioRemainingSchemas.ListSecretsQuerySchema,
    SecretLookupQuery: StudioRemainingSchemas.SecretLookupQuerySchema,
    RenderPromptPayload: StudioRemainingSchemas.RenderPromptPayloadSchema,
    ProjectPluginArray: StudioRemainingSchemas.ProjectPluginArraySchema,
    BinaryFileResponse: StudioRemainingSchemas.BinaryFileResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const STS_SCHEMAS = {
    SigningAlgorithm: StsSchemas.SigningAlgorithmSchema,
    ApiKeyTokenRequest: StsSchemas.ApiKeyTokenRequestSchema,
    UserTokenRequest: StsSchemas.UserTokenRequestSchema,
    ProjectTokenRequest: StsSchemas.ProjectTokenRequestSchema,
    EnvironmentTokenRequest: StsSchemas.EnvironmentTokenRequestSchema,
    AgentTokenRequest: StsSchemas.AgentTokenRequestSchema,
    ServiceAccountTokenRequest: StsSchemas.ServiceAccountTokenRequestSchema,
    IssueTokenRequest: StsSchemas.IssueTokenRequestSchema,
    IssueTokenResponse: StsSchemas.IssueTokenResponseSchema,
    error_string_message_string: StsSchemas.IssueTokenUnavailableResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const API_SCHEMA_GROUPS = [
    IAM_AND_ACCOUNT_SCHEMAS,
    PROJECT_AND_APP_SCHEMAS,
    OAUTH_SCHEMAS,
    ENVIRONMENT_SCHEMAS,
    LLM_COMPLETION_SCHEMAS,
    INTERACTION_SCHEMAS,
    INTERACTION_AUTHORING_SCHEMAS,
    AGENT_CONVERSATION_SCHEMAS,
    EXECUTION_RUN_SCHEMAS,
    PROMPT_AUTHORING_SCHEMAS,
    PROJECT_TOOL_SCHEMAS,
    REMOTE_MCP_SCHEMAS,
    AUDIT_TRAIL_SCHEMAS,
    VIEW_EXPERIENCE_SCHEMAS,
    APP_LIFECYCLE_SCHEMAS,
    STUDIO_REMAINING_SCHEMAS_1,
    STUDIO_REMAINING_SCHEMAS_2,
    STUDIO_REMAINING_SCHEMAS_3,
    STUDIO_REMAINING_SCHEMAS_4,
    STUDIO_REMAINING_SCHEMAS_5,
    STS_SCHEMAS,
    ZENO_SCHEMAS,
    ZENO_DASHBOARD_SCHEMAS,
    ZENO_DATA_STORE_CORE_SCHEMAS,
    ZENO_DATA_STORE_SCHEMA_SCHEMAS,
    ZENO_COST_SCHEMAS,
    ZENO_BULK_OPERATION_SCHEMAS,
    ZENO_DOCUMENT_PROCESSING_SCHEMAS,
    ZENO_COMMAND_SCHEMAS,
    ZENO_REMAINING_SCHEMAS_1,
    ZENO_REMAINING_SCHEMAS_2,
    ZENO_REMAINING_SCHEMAS_3,
    ZENO_REMAINING_SCHEMAS_4,
    ZENO_REMAINING_SCHEMAS_5,
    ZENO_REMAINING_SCHEMAS_6,
    ZENO_REMAINING_SCHEMAS_7,
    ZENO_REMAINING_SCHEMAS_8,
    ZENO_REMAINING_SCHEMAS_9,
    ZENO_REMAINING_SCHEMAS_10,
    ZENO_REMAINING_SCHEMAS_11,
    ZENO_REMAINING_SCHEMAS_12,
    ZENO_REMAINING_SCHEMAS_13,
    ZENO_REMAINING_PARAMETER_SCHEMAS,
];

/**
 * The registry as one type: the groups intersected, which is what a single object literal would
 * have inferred to. `mergeComponentGroups` rejects a name declared by two groups, so no key is ever
 * intersected with a second schema.
 */
type ApiSchemaMap = typeof IAM_AND_ACCOUNT_SCHEMAS &
    typeof PROJECT_AND_APP_SCHEMAS &
    typeof OAUTH_SCHEMAS &
    typeof ENVIRONMENT_SCHEMAS &
    typeof LLM_COMPLETION_SCHEMAS &
    typeof INTERACTION_SCHEMAS &
    typeof INTERACTION_AUTHORING_SCHEMAS &
    typeof AGENT_CONVERSATION_SCHEMAS &
    typeof EXECUTION_RUN_SCHEMAS &
    typeof PROMPT_AUTHORING_SCHEMAS &
    typeof PROJECT_TOOL_SCHEMAS &
    typeof REMOTE_MCP_SCHEMAS &
    typeof AUDIT_TRAIL_SCHEMAS &
    typeof VIEW_EXPERIENCE_SCHEMAS &
    typeof APP_LIFECYCLE_SCHEMAS &
    typeof STUDIO_REMAINING_SCHEMAS_1 &
    typeof STUDIO_REMAINING_SCHEMAS_2 &
    typeof STUDIO_REMAINING_SCHEMAS_3 &
    typeof STUDIO_REMAINING_SCHEMAS_4 &
    typeof STUDIO_REMAINING_SCHEMAS_5 &
    typeof STS_SCHEMAS &
    typeof ZENO_SCHEMAS &
    typeof ZENO_DASHBOARD_SCHEMAS &
    typeof ZENO_DATA_STORE_CORE_SCHEMAS &
    typeof ZENO_DATA_STORE_SCHEMA_SCHEMAS &
    typeof ZENO_COST_SCHEMAS &
    typeof ZENO_BULK_OPERATION_SCHEMAS &
    typeof ZENO_DOCUMENT_PROCESSING_SCHEMAS &
    typeof ZENO_COMMAND_SCHEMAS &
    typeof ZENO_REMAINING_SCHEMAS_1 &
    typeof ZENO_REMAINING_SCHEMAS_2 &
    typeof ZENO_REMAINING_SCHEMAS_3 &
    typeof ZENO_REMAINING_SCHEMAS_4 &
    typeof ZENO_REMAINING_SCHEMAS_5 &
    typeof ZENO_REMAINING_SCHEMAS_6 &
    typeof ZENO_REMAINING_SCHEMAS_7 &
    typeof ZENO_REMAINING_SCHEMAS_8 &
    typeof ZENO_REMAINING_SCHEMAS_9 &
    typeof ZENO_REMAINING_SCHEMAS_10 &
    typeof ZENO_REMAINING_SCHEMAS_11 &
    typeof ZENO_REMAINING_SCHEMAS_12 &
    typeof ZENO_REMAINING_SCHEMAS_13 &
    typeof ZENO_REMAINING_PARAMETER_SCHEMAS;

export type ApiComponentName = keyof ApiSchemaMap;

const API_SCHEMAS: Readonly<Record<ApiComponentName, z.ZodType>> = mergeComponentGroups(API_SCHEMA_GROUPS) as Record<
    ApiComponentName,
    z.ZodType
>;

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
    // STS token contracts. The request root is a discriminated union; its six object branches and
    // both response objects are the closed components that carry the property policy.
    'ApiKeyTokenRequest',
    'UserTokenRequest',
    'ProjectTokenRequest',
    'EnvironmentTokenRequest',
    'AgentTokenRequest',
    'ServiceAccountTokenRequest',
    'IssueTokenResponse',
    'error_string_message_string',
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
    // The agent configuration block under `ProjectConfiguration`, published closed on both sides.
    'AgentProjectConfiguration',
    'AgentCheckpointConfiguration',
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
    // The zeno file, task, content-type and migration components. Every one is published closed
    // today; `StringValueMap`, `MigrationListResponse`, `TaskArray`, the two content-type array
    // wrappers and the three enums are not objects and take none.
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
    'UpdateContentObjectTypePayload',
    'ContentObjectType',
    'ContentObjectTypeCatalogQuery',
    'ContentObjectTypeListQuery',
    'DeleteCountResult',
    'RunMigrationPayload',
    'RunMigrationResponse',
    'MigrationListResponse',
    // Zeno dashboards. StringArrayMap and the two array wrappers are not object schemas, while the
    // discriminated unions and enum carry closedness on their object members or no object policy.
    'DashboardElasticsearchDsl',
    'DashboardSqlDataSource',
    'DashboardVersioningStatusResponse',
    'DashboardVersioningPayload',
    'PromoteDashboardVersionPayload',
    'DashboardVersionItem',
    'DashboardLayout',
    'DashboardPanelPosition',
    'DashboardQuery',
    'DashboardBulkDeleteResult',
    'DashboardArchiveResult',
    'CreateDashboardSnapshotPayload',
    'DashboardBulkArchiveResult',
    'DashboardStoreElasticsearchDataSource',
    'DashboardItem',
    'DashboardPanel',
    'DashboardVersion',
    'Dashboard',
    'CreateDashboardPayload',
    'UpdateDashboardPayload',
    // Zeno data stores. Map, array, enum and discriminated-union components carry no component-level
    // additionalProperties policy; every named object below is already closed in the published spec.
    'QueryValidationError',
    'QueryValidationPayload',
    'ListDataStoreVersionsQuery',
    'GetDataStoreTableQuery',
    'DataIndex',
    'DataForeignKey',
    'Partial_Omit_DataColumn_name',
    'QueryResultColumn',
    'BatchQueryPayload',
    'QueryResult',
    'QueryPayload',
    'DataStoreMutateRowsResult',
    'DataStoreMutateRowsPayload',
    'DataTableSummary',
    'DataStoreVersionTableState',
    'DataRelationshipForAI',
    'DataForeignKeyForAI',
    'DataColumnForAI',
    'DataStoreTableDropResult',
    'DataStoreArchiveResult',
    'CreateSnapshotPayload',
    'DataStoreDownloadInfo',
    'CreateDataStorePayload',
    'QueryValidationResult',
    'DataColumn',
    'DataRelationship',
    'CreateTablePayload',
    'BatchQueryResultItem',
    'DataStoreItem',
    'ImportTableData',
    'DataStoreTableDetail',
    'ImportJob',
    'CreateTablesPayload',
    'DataTable',
    'AlterTablePayload',
    'UpdateSchemaPayload',
    'BatchQueryResult',
    'DataStoreVersion',
    'DataTableForAI',
    'DataStoreFullSchemaResponse',
    'DataSchema',
    'ImportDataPayload',
    'DataStore',
    'DataSchemaForAI',
    // Zeno cost analytics. The GET query components are intentionally open because query
    // enforcement ignores undeclared parameters; the two request bodies and all responses were
    // already published closed.
    'CostAnalyticsQuery',
    'CostRunPriceQuery',
    'ModelPricing',
    'CostTimeSeriesPoint',
    'CostSummary',
    'ModelPriceComparison',
    'CostByDimension',
    'ModelPriceComparisonResponse',
    'CostAnalyticsResponse',
    'CostRunPriceResponse',
    // Zeno's bulk-operation endpoint. The response union carries closedness on each branch rather
    // than on the union component itself.
    'BulkObjectDeleteResult',
    'BulkObjectUpdateResult',
    'BulkObjectCreateResult',
    'BulkOperationResult',
    'BulkOperationPayload',
    // Zeno rendering and document analysis. Request/response objects reproduce the closed
    // published components; DocumentPrepOptions stays open by design, and the query follows the
    // shared query policy of validating declared fields without rejecting unrelated parameters.
    'GroundedAssistantResponse',
    'GroundedExtractionRequest',
    'GroundedVerificationBreakdown',
    'DocAnalyzerProgressStatus',
    'RenderMarkdownStartResponse',
    'PdfRenderingMetadata',
    'GroundedExtractionResultResponse',
    'DocAnalyzerProgress',
    'RenderMarkdownStatusResponse',
    'RenderMarkdownPayload',
    'DocAnalyzeRunStatusResponse',
    // Zeno command responses and their two request payloads are all published closed today.
    'StartProjectReindexPayload',
    'ReindexAgentRunsResponse',
    'ReindexAgentRunsPayload',
    'IndexingStatusResponse',
    'DriftAnalysisResult',
    'DriftAnalysisProgress',
    'EmbeddingsStatusResponse',
    'ProjectConfigurationEmbeddingEnablePayload',
    'GenericCommandResponse',
    'DriftAnalysisStatusResponse',
    // Remaining Zeno closure. These objects were already published closed.
    'HumanTaskDefinition',
    'ProcessNodeReturnsDefinition',
    'ProcessContextDefinition',
    'ProcessScriptInlineSource',
    'GenerationRunMetadata',
    'ContentObjectUserPermissions',
    'RevisionInfo',
    'ContentSource',
    'InheritedPropertyMetadata',
    'TranscriptSegment',
    'Embedding',
    'AgentSemanticEvaluator',
    'InteractionSemanticEvaluator',
    'EventIngestResourceRule',
    'CollectionSecuritySettingsResponse',
    'CollectionMembersUpdateResult',
    'CollectionMembersUpdatePayload',
    'CollectionChildrenUpdateResult',
    'CollectionChildrenUpdatePayload',
    'UpdateAgentArtifactContentResponse',
    'UpdateAgentArtifactContentPayload',
    'TerminateAgentRunResponse',
    'StartContentObjectExportResponse',
    'ExportContentObjectsIncludeOptions',
    'ExportContentObjectsFilter',
    'SetObjectEmbeddingsResponse',
    'ContentObjectApiRevision',
    'InCodeTypeRef',
    'StoredTypeRef',
    'EventRef',
    'RevertProcessDefinitionPayload',
    'RetryProcessNodePayload',
    'nd_restart_count_number',
    'PublishProcessDefinitionPayload',
    'CollectionPropagationResponse',
    'ViewSortClause',
    'ViewResultMedia',
    'ViewBoardColumn',
    'ViewTableColumn',
    'AgenticViewSearchConfiguration',
    'ViewSearchFieldDefinition',
    'ViewRangeDefinition',
    'ViewHierarchyLevel',
    'ViewTermsNavigation',
    'ViewCollectionNavigation',
    'ViewLocationNavigation',
    'ViewExperienceLayout',
    'WorkflowUpdatePublishResponse',
    'PostAgentRunUpdateResponse',
    'ListWorkflowRunsPayload',
    'WorkflowRuleItem',
    'WorkflowDefinitionRef',
    'ProcessDefinitionRevisionInfo',
    'WebhookEventDeliveryTarget',
    'WorkflowEventDeliveryTarget',
    'ContentObjectExportArtifactFile',
    'ProcessRunConfig',
    'ProcessHistoryRef',
    'NodeHistoryEntry',
    'ResourceRef',
    'WorkflowRun',
    'ProcessHistoryResponse',
    'ProcessContextResponse',
    'ContentObjectTextResponse',
    'GetRenditionResponse',
    'EventDeliveryQueueFailureSummary',
    'EventOutboxQueueSummary',
    'ContentObjectExportResult',
    'ContentObjectExportProgress',
    'PendingActivity',
    'AgentTask',
    'EventError',
    'SignalEventProperties',
    'AgentArtifactContentResponse',
    'ExportPropertiesResponse',
    'WorkflowExecutionStartResult',
    'WorkflowInputFile',
    'ViewNavigationNode',
    'ViewHitAnnotation',
    'ViewExecutionWarning',
    'ExecuteViewRequest',
    'DeleteContentObjectResult',
    'DeleteContentObjectExportResponse',
    'WorkflowRule',
    'CreateWorkflowRulePayload',
    'ActivityFetchSpec',
    'CreateCollectionPayload',
    'AgentArtifactUrlResponse',
    'FindPayload',
    'WorkflowActionResponse',
    'AnswerProcessTaskPayload',
    'SignalAgentResponse',
    'AdvanceProcessPayload',
    'BranchDefinition',
    'ParallelCollectDefinition',
    'TransitionDefinition',
    'Transcript',
    'Partial_Record_SupportedEmbeddingTypes_Embedding',
    'AgentEventDeliveryTarget',
    'WebhookEventDeliveryTargetInput',
    'WorkflowEventDeliveryTargetInput',
    'EventIngestSignatureConfig',
    'EventIngestTransform',
    'StartContentObjectExportRequest',
    'SemanticEvaluationRecord',
    'ListEventDeliveriesPayload',
    'VectorSearchQuery',
    'ComplexCollectionSearchQuery',
    'AgentRunSearchHit',
    'ViewSortOption',
    'ViewResultField',
    'ViewTableDisplay',
    'ViewListDisplay',
    'ViewKeyTermDefinition',
    'ViewRangeNavigation',
    'ViewHierarchyNavigation',
    'ViewExperienceScope',
    'ConversationFile',
    'Collection',
    'EventIngestChannel',
    'ContentObjectExportArtifact',
    'ProcessState',
    'AutonomousRunResponse',
    'ListWorkflowRunsResponse',
    'EventDeliveryQueueSubscriptionSummary',
    'EventDeliveryQueueSummaryPayload',
    'ContentObjectExportStatusResponse',
    'TimerTask',
    'SignalTask',
    'ChildWorkflowTask',
    'ActivityTask',
    'WorkflowRunEvent',
    'ViewNavigationResult',
    'ViewExecutionQueryPlan',
    'ViewExecutionSearchConfiguration',
    'DSLRetryPolicy',
    'CreateContentObjectPayload',
    'EventIngestChannelMutationResponse',
    'CreateEventIngestChannelPayload',
    'AgentRun',
    'CreateAgentRunPayload',
    'ComputeCollectionFacetPayload',
    'ProcessScriptResource',
    'Partial_CreateContentObjectPayload',
    'EventSemanticCondition',
    'UpdateEventIngestChannelPayload',
    'EventDeliveryIntentSummary',
    'ComplexSearchQuery',
    'SearchAgentRunsResponse',
    'ViewBoardCardConfiguration',
    'ViewSearchConfiguration',
    'ListContentObjectExportsResponse',
    'WorkflowRunUpdatesResponse',
    'EventDeliveryQueueSummaryResponse',
    'ExportPropertiesPayload',
    'ExecuteWorkflowPayload',
    'ViewExecutionSearchResult',
    'DSLActivityOptions',
    'DSLActivitySpec',
    'DSLActivityStep',
    'ContentObjectApiResponse',
    'ComputeObjectFacetPayload',
    'EventSubscriptionFilter',
    'EventDeliverySummary',
    'ContentObjectItemApiResponse',
    'ComplexSearchPayload',
    'ViewBoardDisplay',
    'Partial_AgentMessage',
    'AgentRunUpdatesResponse',
    'ViewHit',
    'ProcessResourcesDefinition',
    'ListEventDeliveriesResponse',
    'ObjectSearchResponse',
    'WorkflowRunWithDetails',
    'ViewResultsConfiguration',
    'ViewExecutionDefinition',
    'ViewExperienceConfiguration',
    'ViewExecutionResult',
    'PreviewViewExperienceRequest',
    'BranchNodeBranchDefinition',
    'CreateEventSubscriptionPayload',
    'CreateProcessDefinitionPayload',
    'DSLChildWorkflowStep',
    'DSLWorkflowDefinition',
    'DSLWorkflowDefinitionResponse',
    'DSLWorkflowSpecWithActivities',
    'DSLWorkflowSpecWithSteps',
    'EventSubscription',
    'EventSubscriptionMutationResponse',
    'ListAgentRunsResponse',
    'NodeDefinition',
    'ProcessDefinition',
    'ProcessDefinitionBody',
    'ProcessEventDeliveryTarget',
    'ProgrammaticRunResponse',
    'SupervisedRunResponse',
    'UpdateEventSubscriptionPayload',
    'UpdateProcessDefinitionPayload',
    'ViewCardsDisplay',
    'ViewGalleryDisplay',
    'CompactMessage',
    // The OAuth closure. Every object in it is published closed today; the ten enums and the two
    // array components take no additionalProperties at all, and `OAuthProviderData`/`OAuthClientData`
    // are composed rather than hoisted so they have no component to list.
    'SuccessResponse',
    'OAuthProvider',
    'CreateOAuthProviderPayload',
    'UpdateOAuthProviderPayload',
    'OAuthProviderAuthStatus',
    'OAuthProviderAuthorizeResponse',
    'OAuthProviderAccessTokenResponse',
    'OAuthProviderExchangePayload',
    'OAuthClient',
    'OAuthClientCreateResponse',
    'OAuthClientScopeMetadata',
    'CreateOAuthClientPayload',
    'UpdateOAuthClientPayload',
    'OAuthGrant',
    'BulkRevokeOAuthGrantsPayload',
    'OAuthGrantListResponse',
    'OAuthGrantRevokeResponse',
    // Expanded into parameters rather than published, like the zeno and project query components.
    'ListOAuthGrantsQuery',
    'RevokeOAuthGrantQuery',
    // The environment closure. Every object here is published closed today EXCEPT
    // `ExecutionEnvironmentSettings`, which carries an index signature and publishes
    // `additionalProperties: {}` so a driver-specific setting this build has never heard of still
    // round-trips; it is deliberately absent from this list. The six enums take no
    // additionalProperties at all.
    'ExecutionEnvironment',
    'ExecutionEnvironmentRef',
    'ExecutionEnvironmentCreatePayload',
    'ExecutionEnvironmentUpdatePayload',
    'ExecutionEnvironmentConfigUpdatePayload',
    'EnableEnvironmentModelPayload',
    'VirtualEnvEntry',
    'LoadBalancingEnvConfig',
    'LoadBalancingEnvEntryConfig',
    'MediatorEnvConfig',
    'AIModel',
    'RunAnalyticsQuery',
    'RunAnalyticsResult',
    'AnalyticsAxis',
    'EmbeddingsApiRequest',
    'EmbeddingsApiSource',
    'EmbeddingsApiTextInput',
    'EmbeddingsApiImageInput',
    'EmbeddingsApiVideoInput',
    'EmbeddingsApiAudioInput',
    'EmbeddingsResult',
    'EmbeddingResultItem',
    'EmbeddingOutput',
    'EmbeddingsTokenUsage',
    // Expanded into parameters. `ListEnvironmentsQuery` and `ModelSearchPayload` are the two the
    // `/environments` resources take.
    'ListEnvironmentsQuery',
    'ModelSearchPayload',
    // The interaction, prompt, run and agent-conversation closure. Every name here is published
    // closed today.
    //
    // What is deliberately absent, and why, because the list is long enough that absence has to be
    // readable: the enums and string constants (`InteractionStatus`, `PromptStatus`, `TemplateType`,
    // `PromptSegmentDefType`, `InteractionVisibility`, `ExecutionRunStatus`, `RunSourceTypes`,
    // `ModelSource`, `LlmCallType`, `AgentSearchScope`, `AgentSearchScope_Collection`,
    // `AgentResourceAction`, `AgentResourceType`, `AgentToolApprovalMode`, `ConversationVisibility`,
    // `SortOrder`, `AsyncCompletionMode`, `PromptRole`, `Modalities`) and the array components take
    // no `additionalProperties` at all; the unions (`UserChannel`, `CompletionResult`,
    // `AsyncExecutionPayload`) and the `$ref` alias `ExecutionRunInteraction` take none either; and
    // the maps (`NumberValueMap`, `ToolApprovalGrantMap`, `ExternalizedToolInputRefs`,
    // `GeneratedTestDataRecord`, `GeneratedTestDataRecordArray`, `JSONObject`,
    // `ComputedFacetResponse`) publish a VALUE schema there rather than a policy. `ToolResultMeta`,
    // `AsyncInteractionExecutionPayload` and `AsyncConversationExecutionPayload` are open today and
    // stay open.
    'PromptSegment',
    'DataSource',
    'ToolDefinition',
    'ToolUse',
    'TextResult',
    'JsonResult',
    'ImageResult',
    'ExecutionTokenUsage',
    'StatelessExecutionOptions',
    'SchemaRef',
    'CachePolicy',
    'PromptModalities',
    'PromptTemplate',
    'PromptTemplateCreatePayload',
    'PromptTemplateUpdatePayload',
    'PromptTemplateRef',
    'PromptSegmentDef',
    'PromptSegmentRef_PromptTemplateRef',
    'InCodePrompt',
    'Interaction',
    'InteractionRef',
    'InteractionName',
    'ExportedPromptTemplateRef',
    'PromptSegmentRef_ExportedPromptTemplateRef',
    'InteractionRefWithSchema',
    'InteractionTags',
    'InteractionEndpoint',
    'InteractionEndpointQuery',
    'InteractionCreatePayload',
    'InteractionUpdatePayload',
    'InteractionPublishPayload',
    'InteractionForkPayload',
    'InteractionsExportPayload',
    'CatalogInteractionRef',
    'ResolvedEnvironmentInfo',
    'ResolvedInteractionExecutionInfo',
    'FacetSpec',
    'ComputeInteractionFacetPayload',
    'ImprovePromptPayloadConfig',
    'ImprovePromptPayload',
    'PromptImprovementResponse',
    'GenerateTestDataPayload',
    'GenerateInteractionPayload',
    'GeneratedInteractionDefinition',
    'GeneratedInteractionPromptTemplate',
    'GeneratedInteractionPromptSegment',
    'AgentRunnerOptions',
    'SkillContextTriggers',
    'InitialToolCall',
    'ConversationStripOptions',
    'StreamingOptions',
    'StreamingTelemetryContext',
    'ResolvedRuntimeConfig',
    'InteractiveChannel',
    'EmailChannel',
    'ToolReference',
    'ToolResult',
    'ExternalizedToolInputRef',
    'ToolApprovalGrant',
    'PendingToolApprovalResults',
    'AgentResourceReference',
    'PendingMcpConnection',
    'UsedSkill',
    'PlanTask',
    'Plan',
    'WorkflowAncestor',
    'TextArtifactReference',
    'ConversationState',
    'RunSource',
    'ExecutionRunDocRef',
    'ExecutionRunWorkflow',
    'ExecutionRun',
    'ExecutionRunRef',
    'Partial_ExecutionRunRef',
    'RunCreatePayload',
    'SortOption',
    'RunSearchPayload',
    'InteractionExecutionPayload',
    'NamedInteractionExecutionPayload',
    'InteractionExecutionResult',
    'PopulatedExecutionRunResult',
    'LegacyExecutionRunResult',
    'LegacyPopulatedExecutionRunResult',
    'InteractionExecutionError',
    'ResultStorageOptions',
    'AsyncCompletionOptions',
    'AsyncExecutionResult',
    'RateLimitRequestPayload',
    'RateLimitRequestResponse',
    // Expanded into parameters rather than published, like every query contract above.
    // `ExecuteInteractionByEndpointHeaders` is listed for symmetry only: header validation matches
    // declared names and leaves everything else alone, so strictness cannot reject a real request.
    'InteractionSearchQuery',
    'RunSearchQuery',
    'RunListQuery',
    'CatalogTagQuery',
    'StoredCatalogInteractionsQuery',
    'ResolveInteractionQuery',
    'ExecuteInteractionByEndpointQuery',
    'ExecuteInteractionByEndpointHeaders',
    // The prompt-authoring, project-tool, remote-MCP, audit-trail and view-experience closures.
    // Every name here is published closed today.
    'ValidateToolNamesPayload',
    'ToolValidationResult',
    'AggregatedTool',
    'ValidateToolNamesResponse',
    'RenderPromptResponse',
    'PromptTemplateInteractionVersion',
    'PromptTemplateForkPayload',
    'PromptSearchQuery',
    'PromptTemplateInteractionUsage',
    'ComputePromptFacetPayload',
    'PromptTemplateInteractionsResponse',
    'MCPToolAnnotations',
    'McpOAuthTokenResponse',
    'McpOAuthTokenRequest',
    'OAuthAuthStatus',
    'OAuthMetadataResponse',
    'McpOAuthDisconnectResponse',
    'McpOAuthConnectResponse',
    'OAuthAuthorizeResponse',
    'AuditMeter',
    'Partial_Record_AuditAggregationDimension_string_null',
    'AuditAggregationRow',
    'AuditAggregationMetric',
    'AuditAggregationGroup',
    'AuditAggregationDetailFilter',
    'AuditTrailEvent',
    'AuditAggregationResponse',
    'AuditAggregationFilter',
    'AuditTrailResponse',
    'AuditAggregationQuery',
    'ViewSortClause',
    'ViewResultMedia',
    'ViewBoardColumn',
    'ViewTableColumn',
    'AgenticViewSearchConfiguration',
    'ViewSearchFieldDefinition',
    'ViewRangeDefinition',
    'ViewHierarchyLevel',
    'ViewTermsNavigation',
    'ViewCollectionNavigation',
    'ViewLocationNavigation',
    'ViewExperienceLayout',
    'ViewSortOption',
    'ViewResultField',
    'ViewTableDisplay',
    'ViewListDisplay',
    'ViewKeyTermDefinition',
    'ViewRangeNavigation',
    'ViewHierarchyNavigation',
    'ViewExperienceScope',
    'ViewBoardCardConfiguration',
    'ViewSearchConfiguration',
    'ViewBoardDisplay',
    'ViewCardsDisplay',
    'ViewGalleryDisplay',
    'ViewResultsConfiguration',
    'CreateViewExperienceRequest',
    'ViewExperience',
    'UpdateViewExperienceRequest',
    'ListProjectToolsQuery',
    'AuditTrailQuery',
    'ViewExperienceListQuery',
    'UpdateAppInstallationToolAllowlistPayload',
    'ValidateUrlResponse',
    'ValidateUrlRequest',
    'AppVersionUrls',
    'StartAppScaffoldResponse',
    'StartAppBuildResponse',
    'AppDevelopmentTask',
    'AppInstallationProviderBinding',
    'AppInstallationOAuthBinding',
    'OAuthClientCredentials',
    'AppInspectionCapabilityReport',
    'AppRepoTreeEntry',
    'AppRepoRef',
    'AppRepoCommit',
    'EventRef',
    'InCodeTypeRef',
    'StoredTypeRef',
    'DeleteAppVersionResponse',
    'AppRepoBranch',
    'AppRepoDocumentCommit',
    'AppVersionGitSource',
    'StartAppScaffoldRequest',
    'StartAppBuildRequest',
    'AgentToolDefinition',
    'AppDevelopmentTaskList',
    'AppInspectionIssue',
    'AppScaffoldProgress',
    'AppRepoTree',
    'AppRepoRefs',
    'AppRepoCommits',
    'AppBuildProgress',
    'AppVersionStorage',
    'AppToolCollection',
    'AppInspectionResult',
    'AppVersionRecord',
    'AgentRunSearchHit',
    'UpsertAppVersionRequest',
    'AppInstallationPayload',
    'AppDevelopmentTaskDetails',
    'AppInstallationsQuery',
    'AppInstallationProjectsQuery',
    'SystemPackageQuery',
    'WebsiteCredentialTotpMetadata',
    'WebsiteCredentialSecretInput',
    'WebsiteCredentialWebsite',
    'CompositeAppNavItemPermissions',
    'CompositeAppEntry',
    'CompositeAppHomePlugin',
    'CompositeAppThemeOverrides',
    'CompositeAppUserMenuOverrides',
    'CompositeAppHeaderOverrides',
    'CompositeAppSidebarOverrides',
    'CompositeAppSwitchersOverrides',
    'CompositeAppLogoOverrides',
    'CompositeAppCardOverrides',
    'WebsiteCredentialRecord',
    'InCodeViewDefinition',
    'InCodeProcessDefinition',
    'AppInstallation',
    'AskUserWebhookConfiguration',
    'ResendConfiguration',
    'LinkupConfiguration',
    'ExaConfiguration',
    'SerperConfiguration',
    'GithubConfiguration',
    'GladiaConfiguration',
    'RemoteActivityDefinition',
    'AppWidgetInfo',
    'AppDashboardDefinition',
    'WebsiteCredentialFillResponse',
    'WebsiteCredentialFillRequest',
    'ok_boolean',
    'WebsiteCredentialMetadata',
    'AppManifestData',
    'Partial_WebsiteCredentialMetadata',
    'AskUserWebhookConfigurationInput',
    'ResendConfigurationInput',
    'LinkupConfigurationInput',
    'ExaConfigurationInput',
    'SerperConfigurationInput',
    'MagicPdfConfiguration',
    'AwsConfiguration',
    'GithubConfigurationInput',
    'GladiaConfigurationInput',
    'CompositeAppMenuNavItem',
    'CompositeAppHeaderItem',
    'CompositeAppMessageOverrides',
    'AppManifest',
    'SecretRecord',
    'AppInstallationWithManifest',
    'AppInstallationListEntry',
    'CreateSecretRequest',
    'UpdateSecretRequest',
    'CompositeAppMenuSection',
    'PromoteAppVersionResponse',
    'ListSecretsResponse',
    'CompositeAppConfig',
    'AppPackage',
    'Partial_Omit_CompositeAppConfig_id_project',
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
    // A schema may deliberately reference an already-canonical neighbour without embedding its
    // body (AppManifestData.settings_schema -> JSONSchema is the first live case). Supply the
    // registry as the reference environment while replacing only the root under examination. The
    // compared root still comes from `schema`; a disagreeing embedded definition still collides and
    // fails, while a bare canonical pointer can resolve exactly as it does in the published document.
    const referenceEnvironment = Object.fromEntries(
        Object.entries(ApiSchemaComponents).filter(([component]) => component !== name),
    );
    const produced = new Set(
        Object.keys(toOpenApiComponents({ [name]: raw }, { referenceComponents: referenceEnvironment })),
    );
    const strictComponents = new Set([...STRICT_COMPONENTS].filter((component) => produced.has(component)));
    const emitted = toOpenApiComponents(
        { [name]: raw },
        { strictComponents, referenceComponents: referenceEnvironment },
    );
    for (const [component, body] of Object.entries(emitted)) {
        if (component === name) continue;
        const published = ApiSchemaComponents[component];
        if (published && JSON.stringify(body) !== JSON.stringify(published)) {
            throw new Error(
                `Component '${component}' is defined twice with different shapes (seen while adapting '${name}'). ` +
                    'Component names must be globally unique.',
            );
        }
    }
    return emitted[name];
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

/**
 * Explicit TypeScript recursion boundary for schemas whose runtime graph is lazy.
 *
 * Zod cannot infer a finite named type through a mutually-recursive graph. The schemas remain the
 * runtime and OpenAPI authority; these names preserve the recursive TypeScript declarations until
 * TypeScript can infer recursive aliases without collapsing them to `unknown`.
 */
interface ZenoRecursiveComponentTypes {
    ViewNavigationNode: ViewNavigationNode;
    AgentRunResponse: AgentRunResponse;
    AgentRunInternals: AgentRunInternals;
    BindRunWorkflowPayload: BindRunWorkflowPayload;
    BranchNodeBranchDefinition: BranchNodeBranchDefinition;
    CreateEventSubscriptionPayload: CreateEventSubscriptionPayload;
    CreateProcessDefinitionPayload: CreateProcessDefinitionPayload;
    DSLChildWorkflowStep: DSLChildWorkflowStep;
    DSLWorkflowDefinition: DSLWorkflowDefinition;
    DSLWorkflowDefinitionResponse: DSLWorkflowDefinitionResponse;
    DSLWorkflowSpec: DSLWorkflowSpec;
    DSLWorkflowSpecWithActivities: DSLWorkflowTypes.DSLWorkflowSpecWithActivities;
    DSLWorkflowSpecWithSteps: DSLWorkflowSpecWithSteps;
    DSLWorkflowStep: DSLWorkflowStep;
    EventDeliveryTarget: EventDeliveryTarget;
    EventDeliveryTargetInput: EventDeliveryTargetInput;
    EventSubscription: EventSubscription;
    EventSubscriptionArray: EventSubscription[];
    EventSubscriptionMutationResponse: EventSubscriptionMutationResponse;
    ListAgentRunsResponse: ListAgentRunsResponse;
    NodeDefinition: NodeDefinition;
    NodeDefinitionMap: Record<string, NodeDefinition>;
    ProcessDefinition: ProcessDefinition;
    ProcessDefinitionArray: ProcessDefinition[];
    ProcessDefinitionBody: ProcessDefinitionBody;
    ProcessEventDeliveryTarget: ProcessEventDeliveryTarget;
    ProgrammaticRunResponse: ProgrammaticRunResponse;
    RecordRunPayload: RecordRunPayload;
    SupervisedRunResponse: SupervisedRunResponse;
    UpdateAgentRunStatusPayload: UpdateAgentRunStatusPayload;
    UpdateEventSubscriptionPayload: UpdateEventSubscriptionPayload;
    UpdateProcessDefinitionPayload: UpdateProcessDefinitionPayload;
}

/**
 * The wire type a component publishes.
 *
 * `ApiComponentType<'Account'>` is `z.infer<typeof AccountSchema>` — the map is indexed directly
 * rather than dispatched through the groups, which the intersection makes possible.
 */
export type ApiComponentType<N extends ApiComponentName> = N extends keyof ZenoRecursiveComponentTypes
    ? ZenoRecursiveComponentTypes[N]
    : z.infer<ApiSchemaMap[N]>;

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
