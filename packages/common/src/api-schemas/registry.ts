// Imported from llumiverse rather than restated here. These components describe llumiverse's own
// types, and a second declaration in this repository would create an independent source of truth.
// They have no local `./*.ts` module because there is nothing local to declare.
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
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
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
import { findUnprunablePaths, isPlainObject, type JsonObject, pruneToSchema, toOpenApiComponents } from './adapter.js';
import * as AgentCommunicationSchemas from './agent-communication.js';
import * as AgentRunSchemas from './agent-runs.js';
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
    AppApiKeyCollectionParamsSchema,
    AppBuildProgressSchema,
    AppBuildProgressStatusSchema,
    AppBuildTriggerSchema,
    AppDeleteSummarySchema,
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
    McpApiKeyCredentialSchema,
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
import * as AppRuntimeSchemas from './app-runtime.js';
import {
    AppAccessControlSchema,
    AppCapabilitiesSchema,
    AppManifestSourceSchema,
    AppSourceConfigSchema,
    AppUIConfigSchema,
    MCPToolAnnotationsSchema,
    McpApiKeyStatusSchema,
    McpOAuthConnectResponseSchema,
    McpOAuthDisconnectResponseSchema,
    McpOAuthTokenRequestSchema,
    McpOAuthTokenResponseSchema,
    OAuthAuthorizeResponseSchema,
    OAuthAuthStatusArraySchema,
    OAuthAuthStatusSchema,
    OAuthMetadataResponseSchema,
    SetMcpApiKeyRequestSchema,
    ToolCollectionObjectSchema,
} from './apps.js';
import {
    AuditActionSchema,
    AuditAggregationDetailFieldSchema,
    AuditAggregationDetailFilterSchema,
    AuditAggregationDimensionMapSchema,
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
    GenericCommandResponseSchema,
    MigrationListResponseSchema,
    RunMigrationPayloadSchema,
    RunMigrationResponseSchema,
} from './commands.js';
import * as ContentSchemas from './content.js';
import * as ContentQuerySchemas from './content-query.js';
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
    PricingSyncDayResultSchema,
    PricingSyncPayloadSchema,
    PricingSyncResultSchema,
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
    DataColumnUpdateSchema,
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
    EmbeddingsStatusResponseSchema,
    ProjectConfigurationEmbeddingEnablePayloadSchema,
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
    MigrateInteractionsPayloadSchema,
    MigrateInteractionsResultSchema,
    SupportedProvidersSchema,
    VirtualEnvEntrySchema,
} from './environment.js';
import * as EventSchemas from './events.js';
import {
    BucketReadAccessQuerySchema,
    BucketReadAccessStatusResponseSchema,
    BulkUploadUrlsPayloadSchema,
    BulkUploadUrlsResponseSchema,
    CopyFilePayloadSchema,
    CopyFileResponseSchema,
    DeleteFileResultSchema,
    EnsureBucketReadAccessPayloadSchema,
    EnsureBucketReadAccessResponseSchema,
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
    ListUserGroupsQuerySchema,
    UpdateUserGroupPayloadSchema,
    UserGroupArraySchema,
    UserGroupRefSchema,
    UserGroupSchema,
} from './group.js';
import {
    DriftAnalysisProgressSchema,
    DriftAnalysisResultSchema,
    DriftAnalysisStatusResponseSchema,
    IndexingStatusResponseSchema,
    ReindexAgentRunsPayloadSchema,
    ReindexAgentRunsResponseSchema,
    StartProjectReindexPayloadSchema,
} from './indexing.js';
import * as IntegrationSchemas from './integrations.js';
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
    ComputeRunFacetPayloadSchema,
    ComputeRunFacetsResponseSchema,
    ConversationStateSchema,
    ConversationStripOptionsSchema,
    ConversationVisibilitySchema,
    EmailChannelSchema,
    ExecuteInteractionByEndpointHeadersSchema,
    ExecuteInteractionByEndpointQuerySchema,
    ExecutionResponseSchema,
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
    FindRunResultArraySchema,
    FindRunResultSchema,
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
    RunClonePayloadSchema,
    RunCreatePayloadSchema,
    RunListQuerySchema,
    RunSearchMetaResponseSchema,
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
    ToolResultsPayloadSchema,
    UpdateExecutionRunPayloadSchema,
    UsedSkillSchema,
    UserChannelSchema,
    UserMessagePayloadSchema,
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
    ApproveOAuthAuthorizationRequestPayloadSchema,
    BulkRevokeOAuthGrantsPayloadSchema,
    CreateOAuthAuthorizationRequestPayloadSchema,
    CreateOAuthClientPayloadSchema,
    ListOAuthGrantsQuerySchema,
    OAuthAuthorizationDecisionResponseSchema,
    OAuthAuthorizationRequestSchema,
    OAuthAuthorizationRequestStatusSchema,
    OAuthAuthorizationServerMetadataSchema,
    OAuthAuthorizeQuerySchema,
    OAuthClientArraySchema,
    OAuthClientCreateResponseSchema,
    OAuthClientDisplayMetadataSchema,
    OAuthClientRegistrationModeSchema,
    OAuthClientSchema,
    OAuthClientScopeMetadataSchema,
    OAuthClientStatusSchema,
    OAuthClientTypeSchema,
    OAuthDeviceAuthorizationRequestSchema,
    OAuthDeviceAuthorizationResponseSchema,
    OAuthGrantableScopesResponseSchema,
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
    OAuthTokenResponseSchema,
    RevokeOAuthGrantQuerySchema,
    UpdateOAuthClientPayloadSchema,
} from './oauth-server.js';
import {
    type ApiParameterLocation,
    type NormalizedApiParameters,
    normalizeParameters,
    type RawApiParameters,
} from './parameters.js';
import * as ProcessSchemas from './process.js';
import {
    CountResultSchema,
    CreateProjectPayloadSchema,
    ListProjectsQuerySchema,
    ProjectIntegrationListResponseSchema,
    ProjectPluginsUpdatePayloadSchema,
    ProjectSchema,
    ProjectTagQuerySchema,
    ProjectToolInfoArraySchema,
    ProjectToolInfoSchema,
    RenderingTemplateDefinitionRefSchema,
    RenderingTemplateDefinitionSchema,
    UpdateProjectConfigurationPayloadSchema,
    UpdateProjectPayloadSchema,
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
    RenderPromptPayloadSchema,
    RenderPromptResponseSchema,
} from './prompt.js';
import { QuotaStandingResponseSchema, QuotaTierResponseSchema } from './quota.js';
import * as SecretSchemas from './secrets.js';
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
import * as ViewExecutionSchemas from './view-execution.js';
import {
    AgenticViewRerankConfigurationSchema,
    AgenticViewSearchConfigurationSchema,
    CreateViewExperienceRequestSchema,
    UpdateViewExperienceRequestSchema,
    ViewActionConfigurationSchema,
    ViewActionPlacementSchema,
    ViewActionSelectionRequirementSchema,
    ViewActionsConfigurationSchema,
    ViewAgenticSearchModeSchema,
    ViewBoardCardConfigurationSchema,
    ViewBoardColumnSchema,
    ViewBoardDisplaySchema,
    ViewCardsDisplaySchema,
    ViewCollectionNavigationSchema,
    ViewDisplayConfigurationSchema,
    ViewDropConfigurationSchema,
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
    ViewSelectionConfigurationSchema,
    ViewSelectionModeSchema,
    ViewSortClauseSchema,
    ViewSortOptionSchema,
    ViewTableColumnSchema,
    ViewTableDisplaySchema,
    ViewTermsNavigationSchema,
    ViewUploadDropParametersSchema,
} from './views.js';
import * as WorkflowRunSchemas from './workflow-runs.js';

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
 * Entries named by no endpoint are roots or leaves referenced by another registered component.
 * The adapter hoists those references into the same canonical component graph.
 */
/**
 * The registry, in groups, because the compiler cannot serialize it as one object.
 *
 * At 200 entries `tsc` began refusing the declaration emit with TS7056 — "the inferred type of this
 * node exceeds the maximum length the compiler will serialize". `ApiComponentName` and
 * `ApiComponentType` are both derived from the object, so its full inferred type has to be written
 * into `lib/*.d.ts`, and a Zod schema's type is deeply structural: two hundred of them is the limit.
 * So the object is declared in groups small enough to serialize, and `ApiSchemaMap` puts them back
 * together as an intersection — which the compiler emits as the type expression it was written as,
 * with no inferred node to serialize. A name is still one of these keys and
 * `ApiComponentType<'Account'>` is still `z.infer<typeof AccountSchema>`.
 *
 * Groups follow API domains so ownership stays visible while satisfying the compiler limit. Adding a
 * component means placing it in its domain group and adding a new, specifically named group if that
 * group approaches the proven-safe size.
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
    ListUserGroupsQuery: ListUserGroupsQuerySchema,
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
    // Leaves of the Project closure. `ModelOptions` hoists its
    // twenty-three driver option sets and four enums; `JSONSchema` hoists `JSONSchemaProperties`.
    JSONSchema: JSONSchemaSchema,
    ModelOptions: ModelOptionsSchema,
    HttpTimeoutOptions: HttpTimeoutOptionsSchema,
    // The intake policy tree. Everything it reaches — InteractionExecutionConfiguration, the two
    // grounding policies, the page/vision enums and the embedding switches — is hoisted from here.
    ContentTypeIntakePolicy: ContentTypeIntakePolicySchema,
    // Registered after the policy it references. `IntakeVisionProfileSettingsUpdate` and the
    // per-detail override map are hoisted from here; neither has a TypeScript name to alias.
    ProjectIntakeConfiguration: ProjectIntakeConfigurationSchema,
    // The roots of the Project closure, registered last because every leaf above is a `$ref` target
    // of one of them.
    ProjectConfiguration: ProjectConfigurationSchema,
    Project: ProjectSchema,
    // The two explicitly named update payloads derived from the corresponding response schemas.
    UpdateProjectPayload: UpdateProjectPayloadSchema,
    UpdateProjectConfigurationPayload: UpdateProjectConfigurationPayloadSchema,
    // App-manifest leaves hoisted by the registered manifest roots.
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
 * A group of its own because thirty-one components is near TypeScript's declaration-emit
 * serialization limit for this registry shape.
 *
 * The token server's authorize, token, device-code, and consent contracts live in its own group.
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
    OAuthAuthorizationRequestStatus: OAuthAuthorizationRequestStatusSchema,
    OAuthClientRegistrationMode: OAuthClientRegistrationModeSchema,
    OAuthGrantStatus: OAuthGrantStatusSchema,
    OAuthGrantSortField: OAuthGrantSortFieldSchema,
    OAuthGrantSortOrder: OAuthGrantSortOrderSchema,
    // OAuth authorization-server discovery, consent, device-code, and token contracts.
    OAuthAuthorizationServerMetadata: OAuthAuthorizationServerMetadataSchema,
    OAuthClientDisplayMetadata: OAuthClientDisplayMetadataSchema,
    OAuthAuthorizeQuery: OAuthAuthorizeQuerySchema,
    CreateOAuthAuthorizationRequestPayload: CreateOAuthAuthorizationRequestPayloadSchema,
    OAuthAuthorizationRequest: OAuthAuthorizationRequestSchema,
    ApproveOAuthAuthorizationRequestPayload: ApproveOAuthAuthorizationRequestPayloadSchema,
    OAuthGrantableScopesResponse: OAuthGrantableScopesResponseSchema,
    OAuthAuthorizationDecisionResponse: OAuthAuthorizationDecisionResponseSchema,
    OAuthDeviceAuthorizationRequest: OAuthDeviceAuthorizationRequestSchema,
    OAuthDeviceAuthorizationResponse: OAuthDeviceAuthorizationResponseSchema,
    OAuthTokenResponse: OAuthTokenResponseSchema,
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
    MigrateInteractionsPayload: MigrateInteractionsPayloadSchema,
    MigrateInteractionsResult: MigrateInteractionsResultSchema,
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
    UpdateExecutionRunPayload: UpdateExecutionRunPayloadSchema,
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
    FindRunResult: FindRunResultSchema,
    FindRunResultArray: FindRunResultArraySchema,
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
    ComputeRunFacetPayload: ComputeRunFacetPayloadSchema,
    ComputeRunFacetsResponse: ComputeRunFacetsResponseSchema,
    RunSearchMetaResponse: RunSearchMetaResponseSchema,
    ToolResultsPayload: ToolResultsPayloadSchema,
    UserMessagePayload: UserMessagePayloadSchema,
    ExecutionResponse: ExecutionResponseSchema,
    RunClonePayload: RunClonePayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const FILE_STORAGE_SCHEMAS = {
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
    BucketReadAccessQuery: BucketReadAccessQuerySchema,
    BucketReadAccessStatusResponse: BucketReadAccessStatusResponseSchema,
    EnsureBucketReadAccessPayload: EnsureBucketReadAccessPayloadSchema,
    EnsureBucketReadAccessResponse: EnsureBucketReadAccessResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const DURABLE_TASK_SCHEMAS = {
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
} as const satisfies Record<string, z.ZodType>;

const CONTENT_TYPE_CATALOG_SCHEMAS = {
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
} as const satisfies Record<string, z.ZodType>;

const MIGRATION_COMMAND_SCHEMAS = {
    DeleteCountResult: DeleteCountResultSchema,
    MigrationListResponse: MigrationListResponseSchema,
    RunMigrationPayload: RunMigrationPayloadSchema,
    RunMigrationResponse: RunMigrationResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const DASHBOARD_SCHEMAS = {
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

const DATA_STORE_CORE_SCHEMAS = {
    QueryValidationError: QueryValidationErrorSchema,
    QueryValidationPayload: QueryValidationPayloadSchema,
    ListDataStoreVersionsQuery: ListDataStoreVersionsQuerySchema,
    GetDataStoreTableQuery: GetDataStoreTableQuerySchema,
    DataTableSemanticType: DataTableSemanticTypeSchema,
    DataIndex: DataIndexSchema,
    DataForeignKey: DataForeignKeySchema,
    SemanticColumnType: SemanticColumnTypeSchema,
    DataColumnType: DataColumnTypeSchema,
    DataColumnUpdate: DataColumnUpdateSchema,
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

const DATA_STORE_SCHEMA_SCHEMAS = {
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

const COST_ANALYTICS_SCHEMAS = {
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
    PricingSyncPayload: PricingSyncPayloadSchema,
    PricingSyncDayResult: PricingSyncDayResultSchema,
    PricingSyncResult: PricingSyncResultSchema,
} as const satisfies Record<string, z.ZodType>;

const BULK_CONTENT_OPERATION_SCHEMAS = {
    BulkObjectDeleteResult: BulkObjectDeleteResultSchema,
    BulkObjectUpdateResult: BulkObjectUpdateResultSchema,
    BulkObjectCreateResult: BulkObjectCreateResultSchema,
    BulkOperationResult: BulkOperationResultSchema,
    BulkOperationPayload: BulkOperationPayloadSchema,
    BulkOperationResponse: BulkOperationResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const DOCUMENT_PROCESSING_SCHEMAS = {
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

const INDEXING_SCHEMAS = {
    StartProjectReindexPayload: StartProjectReindexPayloadSchema,
    ReindexAgentRunsResponse: ReindexAgentRunsResponseSchema,
    ReindexAgentRunsPayload: ReindexAgentRunsPayloadSchema,
    IndexingStatusResponse: IndexingStatusResponseSchema,
    DriftAnalysisResult: DriftAnalysisResultSchema,
    DriftAnalysisProgress: DriftAnalysisProgressSchema,
    DriftAnalysisStatusResponse: DriftAnalysisStatusResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const EMBEDDING_ADMIN_SCHEMAS = {
    EmbeddingsStatusResponse: EmbeddingsStatusResponseSchema,
    ProjectConfigurationEmbeddingEnablePayload: ProjectConfigurationEmbeddingEnablePayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const COMMAND_SCHEMAS = {
    GenericCommandResponse: GenericCommandResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const PROCESS_DSL_SCHEMAS = {
    DurationValue: ProcessSchemas.DurationValueSchema,
    JsonLogicRule: ProcessSchemas.JsonLogicRuleSchema,
    DSLWorkflowDefinition: ProcessSchemas.DSLWorkflowDefinitionSchema,
    ActivityFetchSpec: ProcessSchemas.ActivityFetchSpecSchema,
    WorkflowSearchAttributeValue: ProcessSchemas.WorkflowSearchAttributeValueSchema,
    DSLRetryPolicy: ProcessSchemas.DSLRetryPolicySchema,
    ActivityFetchSpecMap: ProcessSchemas.ActivityFetchSpecMapSchema,
    WorkflowSearchAttributeValueMap: ProcessSchemas.WorkflowSearchAttributeValueMapSchema,
    DSLActivityOptions: ProcessSchemas.DSLActivityOptionsSchema,
    DSLActivitySpec: ProcessSchemas.DSLActivitySpecSchema,
    WorkflowSearchAttributes: ProcessSchemas.WorkflowSearchAttributesSchema,
    DSLActivityStep: ProcessSchemas.DSLActivityStepSchema,
    DSLChildWorkflowStep: ProcessSchemas.DSLChildWorkflowStepSchema,
    DSLWorkflowDefinitionResponse: ProcessSchemas.DSLWorkflowDefinitionResponseSchema,
    DSLWorkflowSpec: ProcessSchemas.DSLWorkflowSpecSchema,
    DSLWorkflowSpecWithActivities: ProcessSchemas.DSLWorkflowSpecWithActivitiesSchema,
    DSLWorkflowSpecWithSteps: ProcessSchemas.DSLWorkflowSpecWithStepsSchema,
    DSLWorkflowStep: ProcessSchemas.DSLWorkflowStepSchema,
    WorkflowDefinitionPayload: ProcessSchemas.WorkflowDefinitionPayloadSchema,
    WorkflowDefinitionPayloadWithActivities: ProcessSchemas.WorkflowDefinitionPayloadWithActivitiesSchema,
    WorkflowDefinitionPayloadWithSteps: ProcessSchemas.WorkflowDefinitionPayloadWithStepsSchema,
} as const satisfies Record<string, z.ZodType>;

const AGENT_MESSAGE_SCHEMAS = {
    AgentMessageType: AgentRunSchemas.AgentMessageTypeSchema,
    ConversationFile: AgentRunSchemas.ConversationFileSchema,
    AgentMessageDetails: AgentRunSchemas.AgentMessageDetailsSchema,
    CompactMessage: AgentRunSchemas.CompactMessageSchema,
} as const satisfies Record<string, z.ZodType>;

const PROCESS_DEFINITION_SCHEMAS = {
    ProcessDefinitionMetadata: ProcessSchemas.ProcessDefinitionMetadataSchema,
    BranchJoinPolicy: ProcessSchemas.BranchJoinPolicySchema,
    ParallelFailurePolicy: ProcessSchemas.ParallelFailurePolicySchema,
    ParallelCollectField: ProcessSchemas.ParallelCollectFieldSchema,
    ParallelCollectMode: ProcessSchemas.ParallelCollectModeSchema,
    HumanTaskDefinition: ProcessSchemas.HumanTaskDefinitionSchema,
    TransitionTrigger: ProcessSchemas.TransitionTriggerSchema,
    ProcessNodeReturnsDefinition: ProcessSchemas.ProcessNodeReturnsDefinitionSchema,
    ProcessNodeRunType: ProcessSchemas.ProcessNodeRunTypeSchema,
    ProcessNodeType: ProcessSchemas.ProcessNodeTypeSchema,
    ProcessContextDefinition: ProcessSchemas.ProcessContextDefinitionSchema,
    ProcessDefinitionFormatVersion: ProcessSchemas.ProcessDefinitionFormatVersionSchema,
    ProcessDefinitionStatus: ProcessSchemas.ProcessDefinitionStatusSchema,
    RevertProcessDefinitionPayload: ProcessSchemas.RevertProcessDefinitionPayloadSchema,
    RetryProcessNodePayload: ProcessSchemas.RetryProcessNodePayloadSchema,
    PublishProcessDefinitionPayload: ProcessSchemas.PublishProcessDefinitionPayloadSchema,
    ProcessDefinitionRevisionInfo: ProcessSchemas.ProcessDefinitionRevisionInfoSchema,
    NodeHistoryEntry: ProcessSchemas.NodeHistoryEntrySchema,
    BranchDefinition: ProcessSchemas.BranchDefinitionSchema,
    ParallelCollectDefinition: ProcessSchemas.ParallelCollectDefinitionSchema,
    TransitionDefinition: ProcessSchemas.TransitionDefinitionSchema,
    BranchNodeBranchDefinition: ProcessSchemas.BranchNodeBranchDefinitionSchema,
    CreateProcessDefinitionPayload: ProcessSchemas.CreateProcessDefinitionPayloadSchema,
    NodeDefinition: ProcessSchemas.NodeDefinitionSchema,
    NodeDefinitionMap: ProcessSchemas.NodeDefinitionMapSchema,
    ProcessDefinition: ProcessSchemas.ProcessDefinitionSchema,
    ProcessDefinitionArray: ProcessSchemas.ProcessDefinitionArraySchema,
    ProcessDefinitionBody: ProcessSchemas.ProcessDefinitionBodySchema,
    UpdateProcessDefinitionPayload: ProcessSchemas.UpdateProcessDefinitionPayloadSchema,
    ListProcessDefinitionsQuery: ProcessSchemas.ListProcessDefinitionsQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const PROCESS_SCRIPT_SCHEMAS = {
    ProcessScriptInlineSource: ProcessSchemas.ProcessScriptInlineSourceSchema,
    ProcessScriptLanguage: ProcessSchemas.ProcessScriptLanguageSchema,
    ProcessScriptSource: ProcessSchemas.ProcessScriptSourceSchema,
    ProcessScriptResource: ProcessSchemas.ProcessScriptResourceSchema,
    ProcessScriptResourceMap: ProcessSchemas.ProcessScriptResourceMapSchema,
    ProcessResourcesDefinition: ProcessSchemas.ProcessResourcesDefinitionSchema,
} as const satisfies Record<string, z.ZodType>;

const CONTENT_OBJECT_SCHEMAS = {
    GenerationRunMetadata: ContentSchemas.GenerationRunMetadataSchema,
    ContentObjectUserPermissions: ContentSchemas.ContentObjectUserPermissionsSchema,
    ContentSource: ContentSchemas.ContentSourceSchema,
    ContentObjectStatus: ContentSchemas.ContentObjectStatusSchema,
    InheritedPropertyMetadata: ContentSchemas.InheritedPropertyMetadataSchema,
    TranscriptSegment: ContentSchemas.TranscriptSegmentSchema,
    ContentObjectTypeArray: ContentSchemas.ContentObjectTypeArraySchema,
    ContentObjectTextResponse: ContentSchemas.ContentObjectTextResponseSchema,
    DeleteContentObjectResult: ContentSchemas.DeleteContentObjectResultSchema,
    Transcript: ContentSchemas.TranscriptSchema,
    CreateContentObjectPayload: ContentSchemas.CreateContentObjectPayloadSchema,
    UpdateContentObjectPayload: ContentSchemas.UpdateContentObjectPayloadSchema,
    ContentObjectApiTypeRef: ContentSchemas.ContentObjectApiTypeRefSchema,
    ContentObjectApiResponse: ContentSchemas.ContentObjectApiResponseSchema,
    ProjectedContentObjectApiResponse: ContentSchemas.ProjectedContentObjectApiResponseSchema,
    ProjectedContentObjectApiResponseArray: ContentSchemas.ProjectedContentObjectApiResponseArraySchema,
    ContentObjectItemApiResponse: ContentSchemas.ContentObjectItemApiResponseSchema,
    ContentObjectItemApiResponseArray: ContentSchemas.ContentObjectItemApiResponseArraySchema,
    ContentObjectProcessingPriority: ContentSchemas.ContentObjectProcessingPrioritySchema,
    ContentObjectApiResponseArray: ContentSchemas.ContentObjectApiResponseArraySchema,
    CreateContentObjectHeaders: ContentSchemas.CreateContentObjectHeadersSchema,
    CreateContentObjectQuery: ContentSchemas.CreateContentObjectQuerySchema,
    UpdateContentObjectHeaders: ContentSchemas.UpdateContentObjectHeadersSchema,
    UpdateContentObjectQuery: ContentSchemas.UpdateContentObjectQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const CONTENT_EXPORT_SCHEMAS = {
    RevisionInfo: ContentSchemas.RevisionInfoSchema,
    StartContentObjectExportResponse: ContentSchemas.StartContentObjectExportResponseSchema,
    ExportContentObjectsIncludeOptions: ContentSchemas.ExportContentObjectsIncludeOptionsSchema,
    ExportContentObjectsFilter: ContentSchemas.ExportContentObjectsFilterSchema,
    ContentObjectApiRevision: ContentSchemas.ContentObjectApiRevisionSchema,
    ContentObjectExportArtifactFile: ContentSchemas.ContentObjectExportArtifactFileSchema,
    GetRenditionResponse: ContentSchemas.GetRenditionResponseSchema,
    ContentObjectExportResult: ContentSchemas.ContentObjectExportResultSchema,
    ContentObjectExportProgress: ContentSchemas.ContentObjectExportProgressSchema,
    ExportPropertiesResponse: ContentSchemas.ExportPropertiesResponseSchema,
    DeleteContentObjectExportResponse: ContentSchemas.DeleteContentObjectExportResponseSchema,
    StartContentObjectExportRequest: ContentSchemas.StartContentObjectExportRequestSchema,
    ContentObjectExportArtifact: ContentSchemas.ContentObjectExportArtifactSchema,
    ContentObjectExportStatusResponse: ContentSchemas.ContentObjectExportStatusResponseSchema,
    ListContentObjectExportsResponse: ContentSchemas.ListContentObjectExportsResponseSchema,
    ExportPropertiesPayload: ContentSchemas.ExportPropertiesPayloadSchema,
    CostExportCsvResponse: ContentSchemas.CostExportCsvResponseSchema,
    GetObjectRenditionQuery: ContentSchemas.GetObjectRenditionQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const CONTENT_SEARCH_SCHEMAS = {
    scoreAggregationTypes: ContentSchemas.scoreAggregationTypesSchema,
    dynamicScalingTypes: ContentSchemas.dynamicScalingTypesSchema,
    Embedding: ContentSchemas.EmbeddingSchema,
    SupportedEmbeddingTypes: ContentSchemas.SupportedEmbeddingTypesSchema,
    SetObjectEmbeddingsResponse: ContentSchemas.SetObjectEmbeddingsResponseSchema,
    Record_SearchTypes_number: ContentSchemas.Record_SearchTypes_numberSchema,
    EmbeddingSearchConfig: ContentSchemas.EmbeddingSearchConfigSchema,
    EmbeddingMap: ContentSchemas.EmbeddingMapSchema,
    FindPayload: ContentSchemas.FindPayloadSchema,
    ContentEmbeddingMap: ContentSchemas.ContentEmbeddingMapSchema,
    VectorSearchQuery: ContentSchemas.VectorSearchQuerySchema,
    ComplexSearchQuery: ContentSchemas.ComplexSearchQuerySchema,
    ComputeObjectFacetPayload: ContentSchemas.ComputeObjectFacetPayloadSchema,
    ComplexSearchPayload: ContentSchemas.ComplexSearchPayloadSchema,
    ObjectSearchResponse: ContentSchemas.ObjectSearchResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const EVENT_SUBSCRIPTION_SCHEMAS = {
    EventPriority: EventSchemas.EventPrioritySchema,
    WorkflowRuleInputType: EventSchemas.WorkflowRuleInputTypeSchema,
    WorkflowRuleItem: EventSchemas.WorkflowRuleItemSchema,
    WorkflowRule: EventSchemas.WorkflowRuleSchema,
    CreateWorkflowRulePayload: EventSchemas.CreateWorkflowRulePayloadSchema,
    UpdateWorkflowRulePayload: EventSchemas.UpdateWorkflowRulePayloadSchema,
    ListEventDeliveriesPayload: EventSchemas.ListEventDeliveriesPayloadSchema,
    WorkflowRuleItemArray: EventSchemas.WorkflowRuleItemArraySchema,
    EventSubscriptionFilter: EventSchemas.EventSubscriptionFilterSchema,
    ListEventDeliveriesResponse: EventSchemas.ListEventDeliveriesResponseSchema,
    CreateEventSubscriptionPayload: EventSchemas.CreateEventSubscriptionPayloadSchema,
    EventSubscription: EventSchemas.EventSubscriptionSchema,
    EventSubscriptionArray: EventSchemas.EventSubscriptionArraySchema,
    EventSubscriptionMutationResponse: EventSchemas.EventSubscriptionMutationResponseSchema,
    UpdateEventSubscriptionPayload: EventSchemas.UpdateEventSubscriptionPayloadSchema,
    ServerSentEventsResponse: EventSchemas.ServerSentEventsResponseSchema,
    StreamEventDeliveriesQuery: EventSchemas.StreamEventDeliveriesQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const PROCESS_RUNTIME_SCHEMAS = {
    ProcessRunType: ProcessSchemas.ProcessRunTypeSchema,
    ProcessRunConfig: ProcessSchemas.ProcessRunConfigSchema,
    ProcessHistoryRef: ProcessSchemas.ProcessHistoryRefSchema,
    ProcessHistoryResponse: ProcessSchemas.ProcessHistoryResponseSchema,
    ProcessContextResponse: ProcessSchemas.ProcessContextResponseSchema,
    WorkflowExecutionStartResult: ProcessSchemas.WorkflowExecutionStartResultSchema,
    ImportSpec: ProcessSchemas.ImportSpecSchema,
    AnswerProcessTaskPayload: ProcessSchemas.AnswerProcessTaskPayloadSchema,
    AdvanceProcessPayload: ProcessSchemas.AdvanceProcessPayloadSchema,
    ProcessState: ProcessSchemas.ProcessStateSchema,
    WorkflowExecutionStartResultArray: ProcessSchemas.WorkflowExecutionStartResultArraySchema,
    RecordProcessRunPayload: ProcessSchemas.RecordProcessRunPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const EVENT_DELIVERY_SCHEMAS = {
    AgentDeliveryMatchMode: EventSchemas.AgentDeliveryMatchModeSchema,
    WebhookPayloadMode: EventSchemas.WebhookPayloadModeSchema,
    WebhookSigningMode: EventSchemas.WebhookSigningModeSchema,
    SemanticConditionOnError: EventSchemas.SemanticConditionOnErrorSchema,
    SemanticConditionMode: EventSchemas.SemanticConditionModeSchema,
    AgentSemanticEvaluator: EventSchemas.AgentSemanticEvaluatorSchema,
    InteractionSemanticEvaluator: EventSchemas.InteractionSemanticEvaluatorSchema,
    SemanticEvaluationStatus: EventSchemas.SemanticEvaluationStatusSchema,
    EventDeliveryIntentStatus: EventSchemas.EventDeliveryIntentStatusSchema,
    EventOutboxStatus: EventSchemas.EventOutboxStatusSchema,
    EventDeliverySortField: EventSchemas.EventDeliverySortFieldSchema,
    WebhookEventDeliveryTarget: EventSchemas.WebhookEventDeliveryTargetSchema,
    AppEventDeliveryTarget: EventSchemas.AppEventDeliveryTargetSchema,
    WorkflowEventDeliveryTarget: EventSchemas.WorkflowEventDeliveryTargetSchema,
    EventDeliveryQueueFailureSummary: EventSchemas.EventDeliveryQueueFailureSummarySchema,
    EventOutboxQueueSummary: EventSchemas.EventOutboxQueueSummarySchema,
    EventDeliveryQueueSortField: EventSchemas.EventDeliveryQueueSortFieldSchema,
    AgentEventDeliveryTarget: EventSchemas.AgentEventDeliveryTargetSchema,
    WebhookEventDeliveryTargetInput: EventSchemas.WebhookEventDeliveryTargetInputSchema,
    AppEventDeliveryTargetInput: EventSchemas.AppEventDeliveryTargetInputSchema,
    WorkflowEventDeliveryTargetInput: EventSchemas.WorkflowEventDeliveryTargetInputSchema,
    SemanticEvaluator: EventSchemas.SemanticEvaluatorSchema,
    SemanticEvaluationRecord: EventSchemas.SemanticEvaluationRecordSchema,
    EventDeliveryQueueSubscriptionSummary: EventSchemas.EventDeliveryQueueSubscriptionSummarySchema,
    EventDeliveryQueueSummaryPayload: EventSchemas.EventDeliveryQueueSummaryPayloadSchema,
    CancelEventDeliveryIntentsPayload: EventSchemas.CancelEventDeliveryIntentsPayloadSchema,
    CancelEventDeliveryIntentsResponse: EventSchemas.CancelEventDeliveryIntentsResponseSchema,
    EventSemanticCondition: EventSchemas.EventSemanticConditionSchema,
    EventDeliveryIntentSummary: EventSchemas.EventDeliveryIntentSummarySchema,
    EventDeliveryQueueSummaryResponse: EventSchemas.EventDeliveryQueueSummaryResponseSchema,
    EventDeliverySummary: EventSchemas.EventDeliverySummarySchema,
    EventDeliveryTarget: EventSchemas.EventDeliveryTargetSchema,
    EventDeliveryTargetInput: EventSchemas.EventDeliveryTargetInputSchema,
    ProcessEventDeliveryTarget: EventSchemas.ProcessEventDeliveryTargetSchema,
} as const satisfies Record<string, z.ZodType>;

const EVENT_INGEST_SCHEMAS = {
    EventIngestSignatureEncoding: EventSchemas.EventIngestSignatureEncodingSchema,
    EventIngestSignatureAlgorithm: EventSchemas.EventIngestSignatureAlgorithmSchema,
    EventIngestResourceRule: EventSchemas.EventIngestResourceRuleSchema,
    EventIngestSignatureConfig: EventSchemas.EventIngestSignatureConfigSchema,
    EventIngestTransform: EventSchemas.EventIngestTransformSchema,
    EventIngestChannel: EventSchemas.EventIngestChannelSchema,
    EventIngestChannelMutationResponse: EventSchemas.EventIngestChannelMutationResponseSchema,
    CreateEventIngestChannelPayload: EventSchemas.CreateEventIngestChannelPayloadSchema,
    UpdateEventIngestChannelPayload: EventSchemas.UpdateEventIngestChannelPayloadSchema,
    EventIngestChannelArray: EventSchemas.EventIngestChannelArraySchema,
} as const satisfies Record<string, z.ZodType>;

const COLLECTION_SCHEMAS = {
    CollectionSecuritySettingsResponse: ContentSchemas.CollectionSecuritySettingsResponseSchema,
    CollectionMembersUpdateResult: ContentSchemas.CollectionMembersUpdateResultSchema,
    CollectionMembersUpdatePayload: ContentSchemas.CollectionMembersUpdatePayloadSchema,
    CollectionChildrenUpdateResult: ContentSchemas.CollectionChildrenUpdateResultSchema,
    CollectionChildrenUpdatePayload: ContentSchemas.CollectionChildrenUpdatePayloadSchema,
    CollectionStatus: ContentSchemas.CollectionStatusSchema,
    CollectionPropagationResponse: ContentSchemas.CollectionPropagationResponseSchema,
    CreateCollectionPayload: ContentSchemas.CreateCollectionPayloadSchema,
    UpdateCollectionPayload: ContentSchemas.UpdateCollectionPayloadSchema,
    ComplexCollectionSearchQuery: ContentSchemas.ComplexCollectionSearchQuerySchema,
    Collection: ContentSchemas.CollectionSchema,
    ComputeCollectionFacetPayload: ContentSchemas.ComputeCollectionFacetPayloadSchema,
    CollectionArray: ContentSchemas.CollectionArraySchema,
    CollectionMembersQuery: ContentSchemas.CollectionMembersQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const AGENT_ARTIFACT_SCHEMAS = {
    UpdateAgentArtifactContentResponse: AgentRunSchemas.UpdateAgentArtifactContentResponseSchema,
    UpdateAgentArtifactContentPayload: AgentRunSchemas.UpdateAgentArtifactContentPayloadSchema,
    AgentArtifactContentResponse: AgentRunSchemas.AgentArtifactContentResponseSchema,
    AgentArtifactUrlResponse: AgentRunSchemas.AgentArtifactUrlResponseSchema,
    AgentRunArtifactPathArray: AgentRunSchemas.AgentRunArtifactPathArraySchema,
    AgentRunArtifactUploadHeaders: AgentRunSchemas.AgentRunArtifactUploadHeadersSchema,
    AgentRunArtifactQuery: AgentRunSchemas.AgentRunArtifactQuerySchema,
    AgentRunArtifactsQuery: AgentRunSchemas.AgentRunArtifactsQuerySchema,
} as const satisfies Record<string, z.ZodType>;

const AGENT_RUN_SCHEMAS = {
    TerminateAgentRunResponse: AgentRunSchemas.TerminateAgentRunResponseSchema,
    SignalAgentPayload: AgentRunSchemas.SignalAgentPayloadSchema,
    PostAgentRunUpdateResponse: AgentRunSchemas.PostAgentRunUpdateResponseSchema,
    FileProcessingStatus: AgentRunSchemas.FileProcessingStatusSchema,
    AgentRunArchiveState: AgentRunSchemas.AgentRunArchiveStateSchema,
    ResourceRef: AgentRunSchemas.ResourceRefSchema,
    SignalAgentResponse: AgentRunSchemas.SignalAgentResponseSchema,
    AutonomousRunResponse: AgentRunSchemas.AutonomousRunResponseSchema,
    AgentRun: AgentRunSchemas.AgentRunSchema,
    CreateAgentRunPayload: AgentRunSchemas.CreateAgentRunPayloadSchema,
    CreateProcessRunByIdPayload: AgentRunSchemas.CreateProcessRunByIdPayloadSchema,
    CreateProcessRunWithDefinitionPayload: AgentRunSchemas.CreateProcessRunWithDefinitionPayloadSchema,
    CreateRunPayload: AgentRunSchemas.CreateRunPayloadSchema,
    SearchAgentRunsResponse: AgentRunSchemas.SearchAgentRunsResponseSchema,
    AgentRunUpdatesResponse: AgentRunSchemas.AgentRunUpdatesResponseSchema,
    PostAgentRunUpdatePayload: AgentRunSchemas.PostAgentRunUpdatePayloadSchema,
    AgentRunResponse: AgentRunSchemas.AgentRunResponseSchema,
    ListAgentRunsResponse: AgentRunSchemas.ListAgentRunsResponseSchema,
    ProgrammaticRunResponse: AgentRunSchemas.ProgrammaticRunResponseSchema,
    SupervisedRunResponse: AgentRunSchemas.SupervisedRunResponseSchema,
    AgentRunInternals: AgentRunSchemas.AgentRunInternalsSchema,
    AgentRunDetailsQuery: AgentRunSchemas.AgentRunDetailsQuerySchema,
    ListAgentRunsQuery: AgentRunSchemas.ListAgentRunsQuerySchema,
    RecordAgentRunPayload: AgentRunSchemas.RecordAgentRunPayloadSchema,
    RecordRunPayload: AgentRunSchemas.RecordRunPayloadSchema,
    AgentRunUpdatesQuery: AgentRunSchemas.AgentRunUpdatesQuerySchema,
    SearchAgentRunsQuery: AgentRunSchemas.SearchAgentRunsQuerySchema,
    StreamAgentRunQuery: AgentRunSchemas.StreamAgentRunQuerySchema,
    UpdateAgentRunStatusPayload: AgentRunSchemas.UpdateAgentRunStatusPayloadSchema,
    AgentEvent: AgentRunSchemas.AgentEventSchema,
    IngestAgentEventsPayload: AgentRunSchemas.IngestAgentEventsPayloadSchema,
    IngestAgentEventsResponse: AgentRunSchemas.IngestAgentEventsResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const WORKFLOW_RUN_SCHEMAS = {
    WorkflowQueryResult: WorkflowRunSchemas.WorkflowQueryResultSchema,
    WorkflowUpdatePublishResponse: WorkflowRunSchemas.WorkflowUpdatePublishResponseSchema,
    ListWorkflowRunsPayload: WorkflowRunSchemas.ListWorkflowRunsPayloadSchema,
    WorkflowDefinitionRef: WorkflowRunSchemas.WorkflowDefinitionRefSchema,
    WorkflowRun: WorkflowRunSchemas.WorkflowRunSchema,
    EventError: WorkflowRunSchemas.EventErrorSchema,
    SignalEventProperties: WorkflowRunSchemas.SignalEventPropertiesSchema,
    WorkflowInputFile: WorkflowRunSchemas.WorkflowInputFileSchema,
    WorkflowActionResponse: WorkflowRunSchemas.WorkflowActionResponseSchema,
    WorkflowDefinitionRefArray: WorkflowRunSchemas.WorkflowDefinitionRefArraySchema,
    ListWorkflowRunsResponse: WorkflowRunSchemas.ListWorkflowRunsResponseSchema,
    WorkflowRunEvent: WorkflowRunSchemas.WorkflowRunEventSchema,
    WorkflowInput: WorkflowRunSchemas.WorkflowInputSchema,
    WorkflowRunUpdatesResponse: WorkflowRunSchemas.WorkflowRunUpdatesResponseSchema,
    ExecuteWorkflowPayload: WorkflowRunSchemas.ExecuteWorkflowPayloadSchema,
    WorkflowHistory: WorkflowRunSchemas.WorkflowHistorySchema,
    WorkflowRunWithDetails: WorkflowRunSchemas.WorkflowRunWithDetailsSchema,
    BindRunWorkflowPayload: WorkflowRunSchemas.BindRunWorkflowPayloadSchema,
    WorkflowRunDetailsQuery: WorkflowRunSchemas.WorkflowRunDetailsQuerySchema,
    WorkflowRunUpdatesQuery: WorkflowRunSchemas.WorkflowRunUpdatesQuerySchema,
    WorkflowRunStreamQuery: WorkflowRunSchemas.WorkflowRunStreamQuerySchema,
    ActivityTypeDefinition: WorkflowRunSchemas.ActivityTypeDefinitionSchema,
    ActivityPropertyDefinition: WorkflowRunSchemas.ActivityPropertyDefinitionSchema,
    ActivityDefinition: WorkflowRunSchemas.ActivityDefinitionSchema,
    ActivityCatalog: WorkflowRunSchemas.ActivityCatalogSchema,
    WorkflowInteractionVars: WorkflowRunSchemas.WorkflowInteractionVarsSchema,
    ListWorkflowInteractionsResponse: WorkflowRunSchemas.ListWorkflowInteractionsResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const WORKFLOW_TASK_SCHEMAS = {
    RestartAgentRunPayload: WorkflowRunSchemas.RestartAgentRunPayloadSchema,
    TaskType_TIMER: WorkflowRunSchemas.TaskType_TIMERSchema,
    TaskType_SIGNAL: WorkflowRunSchemas.TaskType_SIGNALSchema,
    TaskType_CHILD_WORKFLOW: WorkflowRunSchemas.TaskType_CHILD_WORKFLOWSchema,
    TaskType_ACTIVITY: WorkflowRunSchemas.TaskType_ACTIVITYSchema,
    PendingActivity: WorkflowRunSchemas.PendingActivitySchema,
    AgentTask: WorkflowRunSchemas.AgentTaskSchema,
    TaskStatus: WorkflowRunSchemas.TaskStatusSchema,
    TimerTask: WorkflowRunSchemas.TimerTaskSchema,
    SignalTask: WorkflowRunSchemas.SignalTaskSchema,
    ChildWorkflowTask: WorkflowRunSchemas.ChildWorkflowTaskSchema,
    ActivityTask: WorkflowRunSchemas.ActivityTaskSchema,
    WorkflowTask: WorkflowRunSchemas.WorkflowTaskSchema,
} as const satisfies Record<string, z.ZodType>;

const VIEW_EXECUTION_SCHEMAS = {
    ViewNavigationNode: ViewExecutionSchemas.ViewNavigationNodeSchema,
    ViewHitAnnotation: ViewExecutionSchemas.ViewHitAnnotationSchema,
    ViewExecutionWarning: ViewExecutionSchemas.ViewExecutionWarningSchema,
    ViewQueryPlanningFailureCode: ViewExecutionSchemas.ViewQueryPlanningFailureCodeSchema,
    ExecuteViewRequest: ViewExecutionSchemas.ExecuteViewRequestSchema,
    ViewNavigationResult: ViewExecutionSchemas.ViewNavigationResultSchema,
    ViewExecutionQueryPlan: ViewExecutionSchemas.ViewExecutionQueryPlanSchema,
    ViewRerankFailureCode: ViewExecutionSchemas.ViewRerankFailureCodeSchema,
    ViewExecutionRerankResult: ViewExecutionSchemas.ViewExecutionRerankResultSchema,
    ViewExecutionSearchConfiguration: ViewExecutionSchemas.ViewExecutionSearchConfigurationSchema,
    ViewNavigationResultMap: ViewExecutionSchemas.ViewNavigationResultMapSchema,
    ViewExecutionSearchResult: ViewExecutionSchemas.ViewExecutionSearchResultSchema,
    ViewHit: ViewExecutionSchemas.ViewHitSchema,
    ViewExecutionDefinition: ViewExecutionSchemas.ViewExecutionDefinitionSchema,
    ViewExperienceConfiguration: ViewExecutionSchemas.ViewExperienceConfigurationSchema,
    ViewExecutionResult: ViewExecutionSchemas.ViewExecutionResultSchema,
    PreviewViewExperienceRequest: ViewExecutionSchemas.PreviewViewExperienceRequestSchema,
} as const satisfies Record<string, z.ZodType>;

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
    RenderPromptPayload: RenderPromptPayloadSchema,
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
    // The static-key alternative to that handshake: the key itself is write-only, so only the
    // setter payload and the configured/hint projection are published.
    SetMcpApiKeyRequest: SetMcpApiKeyRequestSchema,
    McpApiKeyStatus: McpApiKeyStatusSchema,
} as const satisfies Record<string, z.ZodType>;

const AUDIT_TRAIL_SCHEMAS = {
    // The audit trail: the events the endpoint pages through and the aggregation it
    // computes over them.
    AuditMeter: AuditMeterSchema,
    KnownAuditAction: KnownAuditActionSchema,
    EventCategory: EventCategorySchema,
    AuditAggregationDimensionMap: AuditAggregationDimensionMapSchema,
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
    // View experiences: the search, navigation, results and display configuration a curated content
    // view is assembled from.
    ViewExperienceSchemaVersion: ViewExperienceSchemaVersionSchema,
    ViewSortClause: ViewSortClauseSchema,
    ViewResultMedia: ViewResultMediaSchema,
    ViewResultFieldFormat: ViewResultFieldFormatSchema,
    ViewBoardColumn: ViewBoardColumnSchema,
    ViewTableColumn: ViewTableColumnSchema,
    ViewAgenticSearchMode: ViewAgenticSearchModeSchema,
    AgenticViewRerankConfiguration: AgenticViewRerankConfigurationSchema,
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
    ViewSelectionMode: ViewSelectionModeSchema,
    ViewSelectionConfiguration: ViewSelectionConfigurationSchema,
    ViewActionPlacement: ViewActionPlacementSchema,
    ViewActionSelectionRequirement: ViewActionSelectionRequirementSchema,
    ViewActionConfiguration: ViewActionConfigurationSchema,
    ViewActionsConfiguration: ViewActionsConfigurationSchema,
    ViewUploadDropParameters: ViewUploadDropParametersSchema,
    ViewDropConfiguration: ViewDropConfigurationSchema,
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
    // development tasks, installations and inspection.
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
    AppDeleteSummary: AppDeleteSummarySchema,
    AppRepoBranch: AppRepoBranchSchema,
    AppRepoDocumentCommit: AppRepoDocumentCommitSchema,
    AppVersionGitSource: AppVersionGitSourceSchema,
    StartAppScaffoldRequest: StartAppScaffoldRequestSchema,
    StartAppBuildRequest: StartAppBuildRequestSchema,
    AgentToolDefinition: AgentToolDefinitionSchema,
    AppDevelopmentTaskList: AppDevelopmentTaskListSchema,
    OAuthClientCredentialsMap: OAuthClientCredentialsMapSchema,
    AppOAuthCollectionParams: AppOAuthCollectionParamsSchema,
    McpApiKeyCredential: McpApiKeyCredentialSchema,
    AppApiKeyCollectionParams: AppApiKeyCollectionParamsSchema,
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

const SECRET_SCHEMAS = {
    WebsiteCredentialTotpAlgorithm: SecretSchemas.WebsiteCredentialTotpAlgorithmSchema,
    WebsiteCredentialTotpMetadata: SecretSchemas.WebsiteCredentialTotpMetadataSchema,
    WebsiteCredentialSecretInput: SecretSchemas.WebsiteCredentialSecretInputSchema,
    WebsiteCredentialCapability: SecretSchemas.WebsiteCredentialCapabilitySchema,
    WebsiteCredentialWebsite: SecretSchemas.WebsiteCredentialWebsiteSchema,
    SecretKind: SecretSchemas.SecretKindSchema,
    WebsiteCredentialRecord: SecretSchemas.WebsiteCredentialRecordSchema,
    WebsiteCredentialFillResponse: SecretSchemas.WebsiteCredentialFillResponseSchema,
    WebsiteCredentialFillRequest: SecretSchemas.WebsiteCredentialFillRequestSchema,
    DeleteSecretResponse: SecretSchemas.DeleteSecretResponseSchema,
    WebsiteCredentialMetadata: SecretSchemas.WebsiteCredentialMetadataSchema,
    WebsiteCredentialMetadataUpdate: SecretSchemas.WebsiteCredentialMetadataUpdateSchema,
    SecretRecord: SecretSchemas.SecretRecordSchema,
    CreateSecretRequest: SecretSchemas.CreateSecretRequestSchema,
    UpdateSecretRequest: SecretSchemas.UpdateSecretRequestSchema,
    ListSecretsResponse: SecretSchemas.ListSecretsResponseSchema,
    SecretProjectQuery: SecretSchemas.SecretProjectQuerySchema,
    ListSecretsQuery: SecretSchemas.ListSecretsQuerySchema,
    SecretLookupQuery: SecretSchemas.SecretLookupQuerySchema,
    EventWebhookSigningSecretRequest: SecretSchemas.EventWebhookSigningSecretRequestSchema,
    EventWebhookSigningSecretResponse: SecretSchemas.EventWebhookSigningSecretResponseSchema,
    SignEventWebhookRequest: SecretSchemas.SignEventWebhookRequestSchema,
    SignEventWebhookResponse: SecretSchemas.SignEventWebhookResponseSchema,
    EventIngestSigningSecretRequest: SecretSchemas.EventIngestSigningSecretRequestSchema,
    EventIngestSigningSecretResponse: SecretSchemas.EventIngestSigningSecretResponseSchema,
    VerifyEventIngestSignatureRequest: SecretSchemas.VerifyEventIngestSignatureRequestSchema,
    VerifyEventIngestSignatureResponse: SecretSchemas.VerifyEventIngestSignatureResponseSchema,
    GithubInstallationTokenRequest: SecretSchemas.GithubInstallationTokenRequestSchema,
    GithubInstallationTokenResponse: SecretSchemas.GithubInstallationTokenResponseSchema,
    InternalSecretDeleteResponse: SecretSchemas.InternalSecretDeleteResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const INTEGRATION_SCHEMAS = {
    SupportedIntegrations_ask_user_webhook: IntegrationSchemas.SupportedIntegrations_ask_user_webhookSchema,
    SupportedIntegrations_resend: IntegrationSchemas.SupportedIntegrations_resendSchema,
    SupportedIntegrations_linkup: IntegrationSchemas.SupportedIntegrations_linkupSchema,
    SupportedIntegrations_exa: IntegrationSchemas.SupportedIntegrations_exaSchema,
    SupportedIntegrations_serper: IntegrationSchemas.SupportedIntegrations_serperSchema,
    SupportedIntegrations_magic_pdf: IntegrationSchemas.SupportedIntegrations_magic_pdfSchema,
    SupportedIntegrations_aws: IntegrationSchemas.SupportedIntegrations_awsSchema,
    SupportedIntegrations_github: IntegrationSchemas.SupportedIntegrations_githubSchema,
    SupportedIntegrations_gladia: IntegrationSchemas.SupportedIntegrations_gladiaSchema,
    AskUserWebhookConfiguration: IntegrationSchemas.AskUserWebhookConfigurationSchema,
    ResendConfiguration: IntegrationSchemas.ResendConfigurationSchema,
    LinkupConfiguration: IntegrationSchemas.LinkupConfigurationSchema,
    ExaConfiguration: IntegrationSchemas.ExaConfigurationSchema,
    SerperConfiguration: IntegrationSchemas.SerperConfigurationSchema,
    GithubConfiguration: IntegrationSchemas.GithubConfigurationSchema,
    GladiaConfiguration: IntegrationSchemas.GladiaConfigurationSchema,
    RemoteActivityDefinition: IntegrationSchemas.RemoteActivityDefinitionSchema,
    AskUserWebhookConfigurationInput: IntegrationSchemas.AskUserWebhookConfigurationInputSchema,
    ResendConfigurationInput: IntegrationSchemas.ResendConfigurationInputSchema,
    LinkupConfigurationInput: IntegrationSchemas.LinkupConfigurationInputSchema,
    ExaConfigurationInput: IntegrationSchemas.ExaConfigurationInputSchema,
    SerperConfigurationInput: IntegrationSchemas.SerperConfigurationInputSchema,
    MagicPdfConfiguration: IntegrationSchemas.MagicPdfConfigurationSchema,
    AwsConfiguration: IntegrationSchemas.AwsConfigurationSchema,
    GithubConfigurationInput: IntegrationSchemas.GithubConfigurationInputSchema,
    GladiaConfigurationInput: IntegrationSchemas.GladiaConfigurationInputSchema,
    ProjectIntegrationConfigResponse: IntegrationSchemas.ProjectIntegrationConfigResponseSchema,
    ProjectIntegrationConfigRequest: IntegrationSchemas.ProjectIntegrationConfigRequestSchema,
} as const satisfies Record<string, z.ZodType>;

const COMPOSITE_APP_SCHEMAS = {
    CompositeAppNavItemPermissions: AppRuntimeSchemas.CompositeAppNavItemPermissionsSchema,
    CompositeAppEntry: AppRuntimeSchemas.CompositeAppEntrySchema,
    CompositeAppHomePlugin: AppRuntimeSchemas.CompositeAppHomePluginSchema,
    CompositeAppThemeOverrides: AppRuntimeSchemas.CompositeAppThemeOverridesSchema,
    CompositeAppHeaderItemTarget: AppRuntimeSchemas.CompositeAppHeaderItemTargetSchema,
    CompositeAppHeaderItemKind: AppRuntimeSchemas.CompositeAppHeaderItemKindSchema,
    CompositeAppUserMenuOverrides: AppRuntimeSchemas.CompositeAppUserMenuOverridesSchema,
    CompositeAppHeaderOverrides: AppRuntimeSchemas.CompositeAppHeaderOverridesSchema,
    CompositeAppSidebarOverrides: AppRuntimeSchemas.CompositeAppSidebarOverridesSchema,
    CompositeAppSwitchersOverrides: AppRuntimeSchemas.CompositeAppSwitchersOverridesSchema,
    CompositeAppMessageStyle: AppRuntimeSchemas.CompositeAppMessageStyleSchema,
    CompositeAppLogoOverrides: AppRuntimeSchemas.CompositeAppLogoOverridesSchema,
    CompositeAppCardOverrides: AppRuntimeSchemas.CompositeAppCardOverridesSchema,
    CompositeAppMenuNavItem: AppRuntimeSchemas.CompositeAppMenuNavItemSchema,
    CompositeAppHeaderItem: AppRuntimeSchemas.CompositeAppHeaderItemSchema,
    CompositeAppMessageOverrides: AppRuntimeSchemas.CompositeAppMessageOverridesSchema,
    CompositeAppMenuSection: AppRuntimeSchemas.CompositeAppMenuSectionSchema,
    CompositeAppConfig: AppRuntimeSchemas.CompositeAppConfigSchema,
    CompositeAppConfigPayload: AppRuntimeSchemas.CompositeAppConfigPayloadSchema,
} as const satisfies Record<string, z.ZodType>;

const APP_MANIFEST_SCHEMAS = {
    MCPOAuthConfigMap: AppRuntimeSchemas.MCPOAuthConfigMapSchema,
    AppWidgetInfo: AppRuntimeSchemas.AppWidgetInfoSchema,
    AppDashboardDefinition: AppRuntimeSchemas.AppDashboardDefinitionSchema,
    AppManifestData: AppRuntimeSchemas.AppManifestDataSchema,
    AppManifest: AppRuntimeSchemas.AppManifestSchema,
    AppManifestArray: AppRuntimeSchemas.AppManifestArraySchema,
    AppWidgetInfoMap: AppRuntimeSchemas.AppWidgetInfoMapSchema,
    PromoteAppVersionResponse: AppRuntimeSchemas.PromoteAppVersionResponseSchema,
    AppPackage: AppRuntimeSchemas.AppPackageSchema,
    ProjectPluginArray: AppRuntimeSchemas.ProjectPluginArraySchema,
} as const satisfies Record<string, z.ZodType>;

const APP_INSTALLATION_SCHEMAS = {
    InCodeViewDefinition: AppRuntimeSchemas.InCodeViewDefinitionSchema,
    InCodeTypeDefinitionArray: AppRuntimeSchemas.InCodeTypeDefinitionArraySchema,
    RenderingTemplateDefinitionRefArray: AppRuntimeSchemas.RenderingTemplateDefinitionRefArraySchema,
    InCodeProcessDefinition: AppRuntimeSchemas.InCodeProcessDefinitionSchema,
    AppInstallation: AppRuntimeSchemas.AppInstallationSchema,
    InCodeViewDefinitionArray: AppRuntimeSchemas.InCodeViewDefinitionArraySchema,
    InCodeProcessDefinitionArray: AppRuntimeSchemas.InCodeProcessDefinitionArraySchema,
    AppInstallationWithManifest: AppRuntimeSchemas.AppInstallationWithManifestSchema,
    AppInstallationArray: AppRuntimeSchemas.AppInstallationArraySchema,
    AppInstallationListEntry: AppRuntimeSchemas.AppInstallationListEntrySchema,
    AppInstallationWithManifestArray: AppRuntimeSchemas.AppInstallationWithManifestArraySchema,
    AppInstallationListEntryArray: AppRuntimeSchemas.AppInstallationListEntryArraySchema,
    BinaryFileResponse: AppRuntimeSchemas.BinaryFileResponseSchema,
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
    IssueTokenForbiddenResponse: StsSchemas.IssueTokenForbiddenResponseSchema,
    IssueTokenUnavailableResponse: StsSchemas.IssueTokenUnavailableResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const AGENT_COMMUNICATION_SCHEMAS = {
    EmailRouteData: AgentCommunicationSchemas.EmailRouteDataSchema,
    SendEmailRequest: AgentCommunicationSchemas.SendEmailRequestSchema,
    SendEmailResponse: AgentCommunicationSchemas.SendEmailResponseSchema,
    ResolveEmailRouteRequest: AgentCommunicationSchemas.ResolveEmailRouteRequestSchema,
    CreateEmailRouteRequest: AgentCommunicationSchemas.CreateEmailRouteRequestSchema,
    CreateEmailRouteResponse: AgentCommunicationSchemas.CreateEmailRouteResponseSchema,
    EmailRouteResponse: AgentCommunicationSchemas.EmailRouteResponseSchema,
    UpdateEmailRouteRequest: AgentCommunicationSchemas.UpdateEmailRouteRequestSchema,
    UpdateEmailRouteResponse: AgentCommunicationSchemas.UpdateEmailRouteResponseSchema,
    ForwardEmailRequest: AgentCommunicationSchemas.ForwardEmailRequestSchema,
    ForwardEmailResponse: AgentCommunicationSchemas.ForwardEmailResponseSchema,
    PendingAskStatus: AgentCommunicationSchemas.PendingAskStatusSchema,
    PendingAskData: AgentCommunicationSchemas.PendingAskDataSchema,
    RegisterPendingAskRequest: AgentCommunicationSchemas.RegisterPendingAskRequestSchema,
    RegisterPendingAskResponse: AgentCommunicationSchemas.RegisterPendingAskResponseSchema,
    ResolvePendingAskRequest: AgentCommunicationSchemas.ResolvePendingAskRequestSchema,
    ResolvePendingAskResponse: AgentCommunicationSchemas.ResolvePendingAskResponseSchema,
    ListPendingAsksResponse: AgentCommunicationSchemas.ListPendingAsksResponseSchema,
} as const satisfies Record<string, z.ZodType>;

const CONTENT_QUERY_SCHEMAS = {
    ContentQueryPayload: ContentQuerySchemas.ContentQueryPayloadSchema,
    ContentQueryResult: ContentQuerySchemas.ContentQueryResultSchema,
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

    SECRET_SCHEMAS,
    INTEGRATION_SCHEMAS,
    COMPOSITE_APP_SCHEMAS,
    APP_MANIFEST_SCHEMAS,
    APP_INSTALLATION_SCHEMAS,
    STS_SCHEMAS,
    AGENT_COMMUNICATION_SCHEMAS,
    CONTENT_QUERY_SCHEMAS,
    FILE_STORAGE_SCHEMAS,
    DURABLE_TASK_SCHEMAS,
    CONTENT_TYPE_CATALOG_SCHEMAS,
    MIGRATION_COMMAND_SCHEMAS,
    PROCESS_DSL_SCHEMAS,
    AGENT_MESSAGE_SCHEMAS,
    PROCESS_DEFINITION_SCHEMAS,
    PROCESS_SCRIPT_SCHEMAS,
    CONTENT_OBJECT_SCHEMAS,
    CONTENT_EXPORT_SCHEMAS,
    CONTENT_SEARCH_SCHEMAS,
    EVENT_SUBSCRIPTION_SCHEMAS,
    PROCESS_RUNTIME_SCHEMAS,
    EVENT_DELIVERY_SCHEMAS,
    EVENT_INGEST_SCHEMAS,
    COLLECTION_SCHEMAS,
    AGENT_ARTIFACT_SCHEMAS,
    AGENT_RUN_SCHEMAS,
    WORKFLOW_RUN_SCHEMAS,
    WORKFLOW_TASK_SCHEMAS,
    VIEW_EXECUTION_SCHEMAS,

    DASHBOARD_SCHEMAS,
    DATA_STORE_CORE_SCHEMAS,
    DATA_STORE_SCHEMA_SCHEMAS,
    COST_ANALYTICS_SCHEMAS,
    BULK_CONTENT_OPERATION_SCHEMAS,
    DOCUMENT_PROCESSING_SCHEMAS,
    INDEXING_SCHEMAS,
    EMBEDDING_ADMIN_SCHEMAS,
    COMMAND_SCHEMAS,
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
    typeof SECRET_SCHEMAS &
    typeof INTEGRATION_SCHEMAS &
    typeof COMPOSITE_APP_SCHEMAS &
    typeof APP_MANIFEST_SCHEMAS &
    typeof APP_INSTALLATION_SCHEMAS &
    typeof STS_SCHEMAS &
    typeof AGENT_COMMUNICATION_SCHEMAS &
    typeof CONTENT_QUERY_SCHEMAS &
    typeof FILE_STORAGE_SCHEMAS &
    typeof DURABLE_TASK_SCHEMAS &
    typeof CONTENT_TYPE_CATALOG_SCHEMAS &
    typeof MIGRATION_COMMAND_SCHEMAS &
    typeof PROCESS_DSL_SCHEMAS &
    typeof AGENT_MESSAGE_SCHEMAS &
    typeof PROCESS_DEFINITION_SCHEMAS &
    typeof PROCESS_SCRIPT_SCHEMAS &
    typeof CONTENT_OBJECT_SCHEMAS &
    typeof CONTENT_EXPORT_SCHEMAS &
    typeof CONTENT_SEARCH_SCHEMAS &
    typeof EVENT_SUBSCRIPTION_SCHEMAS &
    typeof PROCESS_RUNTIME_SCHEMAS &
    typeof EVENT_DELIVERY_SCHEMAS &
    typeof EVENT_INGEST_SCHEMAS &
    typeof COLLECTION_SCHEMAS &
    typeof AGENT_ARTIFACT_SCHEMAS &
    typeof AGENT_RUN_SCHEMAS &
    typeof WORKFLOW_RUN_SCHEMAS &
    typeof WORKFLOW_TASK_SCHEMAS &
    typeof VIEW_EXECUTION_SCHEMAS &
    typeof DASHBOARD_SCHEMAS &
    typeof DATA_STORE_CORE_SCHEMAS &
    typeof DATA_STORE_SCHEMA_SCHEMAS &
    typeof COST_ANALYTICS_SCHEMAS &
    typeof BULK_CONTENT_OPERATION_SCHEMAS &
    typeof DOCUMENT_PROCESSING_SCHEMAS &
    typeof INDEXING_SCHEMAS &
    typeof EMBEDDING_ADMIN_SCHEMAS &
    typeof COMMAND_SCHEMAS;

export type ApiComponentName = keyof ApiSchemaMap;

const API_SCHEMAS: Readonly<Record<ApiComponentName, z.ZodType>> = mergeComponentGroups(API_SCHEMA_GROUPS) as Record<
    ApiComponentName,
    z.ZodType
>;

/**
 * Components that reject undeclared properties.
 *
 * These components publish `additionalProperties: false`; the same emitted objects are compiled by
 * AJV, so request enforcement and the published contract use one closedness policy.
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
    'IssueTokenForbiddenResponse',
    'IssueTokenUnavailableResponse',
    'ApiKeyListQuery',
    // These payloads previously referenced closed generated utility components. They now own their
    // object shapes directly, so their published closedness belongs to the final component names.
    'PostAgentRunUpdatePayload',
    'CompositeAppConfigPayload',
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
    'ListUserGroupsQuery',
    // Agent communication and content query endpoints.
    'EmailRouteData',
    'SendEmailRequest',
    'SendEmailResponse',
    'ResolveEmailRouteRequest',
    'CreateEmailRouteRequest',
    'CreateEmailRouteResponse',
    'EmailRouteResponse',
    'UpdateEmailRouteRequest',
    'UpdateEmailRouteResponse',
    'ForwardEmailRequest',
    'ForwardEmailResponse',
    'PendingAskData',
    'RegisterPendingAskRequest',
    'RegisterPendingAskResponse',
    'ResolvePendingAskRequest',
    'ResolvePendingAskResponse',
    'ListPendingAsksResponse',
    'ContentQueryPayload',
    'ContentQueryResult',
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
    'EmbeddingTypeEnabledMap',
    // The intake configuration above the policy, and the two anonymous shapes it hoists. All three
    // are published closed today.
    'ProjectIntakeConfiguration',
    'IntakeVisionProfileSettingsUpdate',
    'IntakeVisionProfileSettingsMap',
    // The Project closure roots. Both are published closed today, as is the anonymous `embeddings`
    // object `ProjectConfiguration` publishes inline, and so are the two `Partial<>` update payloads.
    'Project',
    'ProjectConfiguration',
    'UpdateProjectPayload',
    'UpdateProjectConfigurationPayload',
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
    'MCPApiKeyConfig',
    'MCPToolCollectionObject',
    'VertesiaSDKToolCollectionObject',
    // File, task, content-type and command components. Every one is published closed
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
    // Dashboards. StringArrayMap and the two array wrappers are not object schemas, while the
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
    // Data stores. Map, array, enum and discriminated-union components carry no component-level
    // additionalProperties policy; every named object below is already closed in the published spec.
    'QueryValidationError',
    'QueryValidationPayload',
    'ListDataStoreVersionsQuery',
    'GetDataStoreTableQuery',
    'DataIndex',
    'DataForeignKey',
    'DataColumnUpdate',
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
    // Cost analytics. The GET query components are intentionally open because query
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
    // Bulk content operations. The response union carries closedness on each branch rather
    // than on the union component itself.
    'BulkObjectDeleteResult',
    'BulkObjectUpdateResult',
    'BulkObjectCreateResult',
    'BulkOperationResult',
    'BulkOperationPayload',
    // Rendering and document analysis. Request/response objects reproduce the closed
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
    // Indexing, embedding and generic command contracts are all published closed today.
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
    // Remaining content, process, event and workflow contracts were already published closed.
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
    'RestartAgentRunPayload',
    'PublishProcessDefinitionPayload',
    'CollectionPropagationResponse',
    'ViewSortClause',
    'ViewResultMedia',
    'ViewBoardColumn',
    'ViewTableColumn',
    'AgenticViewRerankConfiguration',
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
    'ContentEmbeddingMap',
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
    // `ProcessState` is deliberately absent: the process engine round-trips five `_`-prefixed
    // bookkeeping fields (`_current_node`, `_previous_node`, `_transition_count`, `_node_entries`,
    // `_node_tool_calls`) that are not part of the published contract. They cannot be published
    // either — `_current_node` and `current_node` normalize to the same Java/Go identifier — so the
    // component stays open and lets them pass rather than rejecting every process status update.
    'AutonomousRunResponse',
    'ListWorkflowRunsResponse',
    'EventDeliveryQueueSubscriptionSummary',
    'EventDeliveryQueueSummaryPayload',
    'CancelEventDeliveryIntentsPayload',
    'CancelEventDeliveryIntentsResponse',
    'ContentObjectExportStatusResponse',
    'TimerTask',
    'SignalTask',
    'ChildWorkflowTask',
    'ActivityTask',
    'WorkflowRunEvent',
    'ViewNavigationResult',
    'ViewExecutionQueryPlan',
    'ViewExecutionRerankResult',
    'ViewExecutionSearchConfiguration',
    'DSLRetryPolicy',
    'CreateContentObjectPayload',
    'EventIngestChannelMutationResponse',
    'CreateEventIngestChannelPayload',
    'AgentRun',
    'CreateAgentRunPayload',
    'ComputeCollectionFacetPayload',
    'ProcessScriptResource',
    'UpdateContentObjectPayload',
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
    'ProjectedContentObjectApiResponse',
    'ComputeObjectFacetPayload',
    'EventSubscriptionFilter',
    'EventDeliverySummary',
    'ContentObjectItemApiResponse',
    'ComplexSearchPayload',
    'ViewBoardDisplay',
    'AgentRunUpdatesResponse',
    'ViewHit',
    'ProcessResourcesDefinition',
    'ListEventDeliveriesResponse',
    'ObjectSearchResponse',
    'WorkflowRunWithDetails',
    'ViewSelectionConfiguration',
    'ViewActionConfiguration',
    'ViewActionsConfiguration',
    'ViewUploadDropParameters',
    'ViewDropConfiguration',
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
    'OAuthClientDisplayMetadata',
    'OAuthAuthorizeQuery',
    'CreateOAuthAuthorizationRequestPayload',
    'OAuthAuthorizationRequest',
    'ApproveOAuthAuthorizationRequestPayload',
    'OAuthGrantableScopesResponse',
    'OAuthAuthorizationDecisionResponse',
    'OAuthDeviceAuthorizationRequest',
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
    'UpdateExecutionRunPayload',
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
    'SetMcpApiKeyRequest',
    'McpApiKeyStatus',
    'AuditMeter',
    'AuditAggregationDimensionMap',
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
    'McpApiKeyCredential',
    'AppInspectionCapabilityReport',
    'AppRepoTreeEntry',
    'AppRepoRef',
    'AppRepoCommit',
    'EventRef',
    'InCodeTypeRef',
    'StoredTypeRef',
    'DeleteAppVersionResponse',
    'AppDeleteSummary',
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
    'DeleteSecretResponse',
    'WebsiteCredentialMetadata',
    'AppManifestData',
    'WebsiteCredentialMetadataUpdate',
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
    'BucketReadAccessQuery',
    'BucketReadAccessStatusResponse',
    'EnsureBucketReadAccessPayload',
    'EnsureBucketReadAccessResponse',
    'MigrateInteractionsPayload',
    'MigrateInteractionsResult',
    'PricingSyncPayload',
    'PricingSyncDayResult',
    'PricingSyncResult',
    'ComputeRunFacetPayload',
    'FindRunResult',
    'FindRunResultArray',
    'RunSearchMetaResponse',
    'ComputeRunFacetsResponse',
    'ToolResultsPayload',
    'UserMessagePayload',
    'ExecutionResponse',
    'RunClonePayload',
    'IngestAgentEventsPayload',
    'IngestAgentEventsResponse',
    'ActivityTypeDefinition',
    'ActivityPropertyDefinition',
    'ActivityDefinition',
    'ActivityCatalog',
    'WorkflowInteractionVars',
    'ListWorkflowInteractionsResponse',
    'EventWebhookSigningSecretRequest',
    'EventWebhookSigningSecretResponse',
    'SignEventWebhookRequest',
    'SignEventWebhookResponse',
    'EventIngestSigningSecretRequest',
    'EventIngestSigningSecretResponse',
    'VerifyEventIngestSignatureRequest',
    'VerifyEventIngestSignatureResponse',
    'GithubInstallationTokenRequest',
    'GithubInstallationTokenResponse',
    'InternalSecretDeleteResponse',
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
 * The canonical `components.schemas` for all documented endpoints.
 *
 * This exact object is what the OpenAPI spec publishes AND what AJV compiles, so the published
 * contract and the enforced contract cannot diverge.
 */
export const ApiSchemaComponents: Readonly<Record<string, JsonObject>> = toOpenApiComponents(emitRawSchemas(), {
    strictComponents: STRICT_COMPONENTS,
});

/**
 * A canonical component as a SELF-CONTAINED JSON Schema, for consumers that compile it directly.
 *
 * The published component `$ref`s its neighbours through `#/components/schemas/...`, which resolves
 * only inside the OpenAPI document. AJV and the Monaco editor need a document they can compile on
 * its own, so the transitive closure is inlined under `$defs` and the pointers rewritten. Nothing
 * about the shapes changes — this is a re-rooting of the same objects, plus the removal of the
 * OpenAPI-only discriminator keywords described below, which is what lets a generated artifact be
 * compared with the component it came from.
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
        defs[dependency] = toPlainJsonSchema(ApiSchemaComponents[dependency]) as JsonObject;
    }
    const root = toPlainJsonSchema(ApiSchemaComponents[name]) as JsonObject;
    return seen.size > 0 ? { ...root, $defs: defs } : root;
}

const COMPONENT_REF_PREFIX = '#/components/schemas/';

/**
 * Re-roots the component pointers AND drops the discriminator keywords, which are OpenAPI's, not
 * JSON Schema's.
 *
 * `synthesizeDiscriminator` in the adapter gives a discriminated union a `discriminator` plus a
 * restated `type: 'object'` and `required: [propertyName]` ON THE UNION NODE, so a generated
 * Java/Go client can pick a subtype from the union rather than the branches. That restatement is a
 * codegen hint: the node carries no `properties`, so it says "an object that must have
 * `_option_id`" while declaring nothing that could be one.
 *
 * A JSON Schema validator does not mind — `required` needs no matching `properties`, and each
 * branch requires the same key anyway, so removing all three is validation-neutral. Gemini's
 * function-declaration validator does mind, and rejects the whole tool:
 *
 *     schema at properties.intake.properties.extraction.properties.config.properties.model_options
 *     requires unspecified property '_option_id'
 *
 * That was a 400 on every agent turn offering `create_or_update_type`, because the intake-policy
 * artifact reaches Vertex inside that tool's input schema. Stripping here rather than at the tool
 * keeps the next component someone bundles from reintroducing it. The OpenAPI document is untouched
 * — `ApiSchemaComponents` still carries the hint, and the generated clients still read it.
 */
function toPlainJsonSchema(value: unknown): unknown {
    const rerooted = rerootComponentRefs(value);
    return stripDiscriminators(rerooted);
}

function stripDiscriminators(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripDiscriminators);
    if (!value || typeof value !== 'object') return value;
    const node = value as JsonObject;
    // `properties` present means the node describes an object in its own right, so its `type` and
    // `required` are the schema's own rather than the restatement — only the OpenAPI keyword goes.
    const restated = node.discriminator !== undefined && node.properties === undefined;
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(node)) {
        if (key === 'discriminator') continue;
        if (restated && (key === 'type' || key === 'required')) continue;
        out[key] = stripDiscriminators(item) as never;
    }
    return out;
}

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
    WorkflowDefinitionPayload: DSLWorkflowTypes.WorkflowDefinitionPayload;
    WorkflowDefinitionPayloadWithActivities: DSLWorkflowTypes.WorkflowDefinitionPayloadWithActivities;
    WorkflowDefinitionPayloadWithSteps: DSLWorkflowTypes.WorkflowDefinitionPayloadWithSteps;
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
 * Names a published component from inside a handler signature:
 * `Promise<ApiSchemaOf<'Account'>>`.
 *
 * It is `ApiComponentType` under a different name, and the rename carries the whole point. To
 * TypeScript it is the wire type, so the handler's return type is checked against the same registry
 * component that `apiOkComponent('Account')` publishes and AJV enforces.
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

/**
 * One instance for the process, built on first validation.
 *
 * Per-component instances meant re-registering the whole thousand-component envelope for every
 * component ever validated, and AJV walks a schema when it is added. Sharing one instance also lets
 * it reuse the compiled form of a component that two others reference.
 */
let ajvInstance: Ajv2020 | undefined;

/**
 * The published components as AJV can consume them: the same schemas, with the two adjustments
 * AJV's discriminator support requires and the OpenAPI document must not have.
 *
 * `discriminator: true` below is what makes AJV validate a discriminated union through the branch
 * its tag names, instead of trying every branch and reporting all of their failures at once. The
 * difference is not cosmetic — a legacy MCP tool collection missing `id` used to report the real
 * error alongside two impossible ones from the branch it was never meant to match:
 *
 *     / must have required property 'id'                        <- the real one
 *     / must NOT have additional properties: oauth_app          <- vertesia_sdk branch
 *     /type must be equal to constant                           <- vertesia_sdk branch
 *     / must match exactly one schema in oneOf
 *
 * AJV rejects `mapping` outright ("discriminator: mapping is not supported"), because it derives
 * the tag-to-branch map from each branch's own `const`/`enum` instead. The OpenAPI document still
 * needs the mapping — a generated Java or Go client reads it to pick a concrete subtype — so both
 * fixups here apply to AJV's copy only, and `ApiSchemaComponents` is published exactly as built.
 *
 * AJV's remaining requirements — the tag required in every branch, carrying `const` or a
 * single-valued `enum`, with the union node typed as an object — are what `synthesizeDiscriminator`
 * in the adapter already checks before it emits a discriminator at all, and what the hand-written
 * `.meta({ discriminator })` declarations restate. `api-discriminators.test.ts` compiles every
 * registered component so a union satisfying neither fails the build rather than the request.
 */
function toAjvComponents(): Record<string, JsonObject> {
    const schemas = structuredClone(ApiSchemaComponents) as Record<string, JsonObject>;
    const resolve = (value: unknown): JsonObject | undefined => {
        if (!isPlainObject(value)) return undefined;
        const ref = value.$ref;
        if (typeof ref !== 'string' || !ref.startsWith(COMPONENT_REF_PREFIX)) return value;
        return schemas[ref.slice(COMPONENT_REF_PREFIX.length)];
    };

    visitSchemaNodes(schemas, (node) => {
        const discriminator = node.discriminator;
        if (!isPlainObject(discriminator) || !Array.isArray(node.oneOf)) return;
        // AJV derives the tag-to-branch map from each branch's own literal, so `mapping` is both
        // redundant and rejected.
        delete discriminator.mapping;

        const tag = discriminator.propertyName;
        if (typeof tag !== 'string') return;
        for (const member of node.oneOf) {
            const branch = resolve(member);
            const properties = branch && isPlainObject(branch.properties) ? branch.properties : undefined;
            const tagSchema = properties?.[tag];
            if (!isPlainObject(tagSchema) || tagSchema.const !== undefined || tagSchema.enum !== undefined) continue;
            // The tag is a `$ref` to a named literal component — `TaskType_ACTIVITY`,
            // `SupportedIntegrations_gladia` — because the literal carries its own `.meta({ id })`.
            // AJV reads `properties/<tag>` looking for `const` or `enum` and does not follow a
            // `$ref` to find one, so it refuses to compile the union at all. Restating the resolved
            // literal ALONGSIDE the `$ref` is validation-neutral: `$ref` has no special precedence
            // in 2020-12, both keywords apply, and they carry the same value by construction.
            const target = resolve(tagSchema);
            if (!target) continue;
            if (target.const !== undefined) tagSchema.const = target.const;
            else if (Array.isArray(target.enum)) tagSchema.enum = target.enum;
        }
    });
    return schemas;
}

/** Every object node in the component graph, parents before children. */
function visitSchemaNodes(value: unknown, visit: (node: JsonObject) => void): void {
    if (Array.isArray(value)) {
        for (const item of value) visitSchemaNodes(item, visit);
        return;
    }
    if (!isPlainObject(value)) return;
    visit(value);
    for (const item of Object.values(value)) visitSchemaNodes(item, visit);
}

/** The `$id` the whole component envelope is registered under, and the base of every `$ref` to it. */
const AJV_SCHEMA_ID = 'vertesia://openapi';

function getAjv(): Ajv2020 {
    if (ajvInstance) return ajvInstance;
    // `verbose` carries two things {@link collectIssues} needs and nothing else supplies: the schema
    // object that raised each error, which is the only unambiguous way to tell one union candidate
    // from another, and the value under evaluation, which is what a failed union is re-checked
    // against. Both are populated only when validation fails, and both are references rather than
    // copies.
    const ajv = new Ajv2020({ strictSchema: false, allErrors: true, discriminator: true, verbose: true });
    // Without this, AJV treats `format` as an annotation and ignores it, so a `date-time` property
    // would document a constraint nothing checks — the exact spec/enforcement gap this design is
    // meant to close.
    addFormats(ajv);
    ajv.addSchema({ $id: AJV_SCHEMA_ID, components: { schemas: toAjvComponents() } });
    ajvInstance = ajv;
    return ajv;
}

function getValidator(name: ApiComponentName): ValidateFunction {
    const cached = validators.get(name);
    if (cached) return cached;
    const validate = getAjv().compile({ $ref: `${AJV_SCHEMA_ID}${apiComponentRef(name)}` });
    validators.set(name, validate);
    return validate;
}

function additionalProperty(error: { params?: unknown }): string | undefined {
    // AJV writes "must NOT have additional properties" and puts the offending key in `params`,
    // so the message alone says a body is wrong without saying which property made it wrong.
    // Every other keyword names its subject already — `required` quotes the missing property,
    // `enum` and `type` describe the value in place — and this is the one a caller most often
    // trips, so it is the one worth spelling out rather than reformatting all of them.
    return (error.params as { additionalProperty?: string } | undefined)?.additionalProperty;
}

/**
 * One validation failure, with the undeclared property names kept AS NAMES.
 *
 * The structure exists because the rendered line cannot be taken apart again. Property names are
 * arbitrary JSON strings: `{"customer secret token": 1}` and `{"a, b": 1}` are both valid, so
 * neither a space nor a comma is a reliable separator once the names have been joined. Any consumer
 * that needs to shorten the list — the HTTP boundary does, the log does not — has to do it here,
 * on the array, where a name can be dropped whole.
 */
export interface ApiValidationIssue {
    /**
     * AJV's `instancePath` for the failing value, with `'/'` substituted for the root.
     *
     * Not quite a JSON Pointer: the pointer for a document root is the empty string, which reads as
     * a missing path in a message. `'/'` is a display sentinel, so treat this as human-facing rather
     * than as something to resolve against the payload.
     */
    path: string;
    /** AJV's own message, e.g. `must NOT have additional properties`. */
    message: string;
    /** Undeclared property names at {@link path}, in the order AJV reported them. */
    undeclared?: string[];
    /**
     * The union candidate this issue is a claim ABOUT, when it is not a fact about the value.
     *
     * Set on every issue produced by expanding a failed untagged `oneOf`/`anyOf` — see
     * {@link collectIssues}. Under such a union each candidate rejects the value for its own
     * reasons, most of which are irrelevant to the shape the value actually meant, so an issue
     * carrying a component must be read as "as a `<component>`, this is wrong" and never as
     * "this is wrong".
     *
     * Absent means the opposite and stronger thing: the issue holds against the component the
     * payload is being validated as, whatever candidate it turns out to be.
     */
    component?: string;
}

/**
 * The failures, with the undeclared properties a SINGLE schema reported at a given path gathered
 * into one issue, and each failed untagged union expanded per candidate.
 *
 * AJV reports `additionalProperties` per property, so a value carrying a whole foreign object — a
 * Mongoose document that reached the response mapper unmapped, say — produces one error per own key
 * and buries every other failure in the payload. Gathering is lossless: every name is kept, in the
 * order AJV found it. It is keyed by the schema that raised the error as well as the path, so two
 * candidates complaining at one path never merge into a single line. `schemaPath` will not do: a
 * `$ref`'d candidate resets it to `#/additionalProperties`, identical for every candidate. The
 * schema object itself is unambiguous, and `verbose: true` supplies it.
 *
 * `discriminator: true` narrows a TAGGED union to the one branch its tag names, so nothing below
 * applies to those. What is left is the unions with no tag: AJV runs the value against every
 * candidate and reports all of their failures, flat and unattributed. Read as facts they are
 * nonsense — for a condition branch `{ to, when }` with a malformed `when`, raw AJV says
 *
 *     /nodes/a/branches/0/when must be object                              <- BranchDefinition
 *     /nodes/a/branches/0 must have required property 'id'                 <- BranchNodeBranchDefinition
 *     /nodes/a/branches/0 must NOT have additional properties: to, when    <- BranchNodeBranchDefinition
 *     /nodes/a/branches/0 must match exactly one schema in oneOf
 *
 * where `to` and `when` are declared on `BranchDefinition` and only wrong for a candidate the value
 * never meant. Nothing in the error list says which claim belongs to which candidate, and the
 * candidates fail at DIFFERENT paths, so no rule based on the path can recover it.
 *
 * So the union is re-validated candidate by candidate, and each candidate's own failures are
 * attributed to it by name. That is exact rather than inferred, at the cost of one extra validation
 * per candidate — paid only on a response that is already failing:
 *
 *     /nodes/a/branches/0 must match exactly one schema in oneOf
 *     /nodes/a/branches/0/when as BranchDefinition: must be object
 *     /nodes/a/branches/0 as BranchNodeBranchDefinition: must have required property 'id'
 *     /nodes/a/branches/0 as BranchNodeBranchDefinition: must NOT have additional properties: to, when
 *
 * Expansion goes ONE level deep: a candidate's own errors are collected without expanding any union
 * nested inside it, which bounds the work and keeps the output readable.
 */
function collectIssues(validate: ValidateFunction): ApiValidationIssue[] {
    return toIssues(validate.errors ?? [], true);
}

function toIssues(errors: readonly ErrorObject[], expandUnions: boolean): ApiValidationIssue[] {
    const expansions = new Map<string, ApiValidationIssue[]>();
    if (expandUnions) {
        for (const error of errors) {
            if (error.keyword !== 'oneOf' && error.keyword !== 'anyOf') continue;
            const expanded = expandUnion(error);
            if (expanded) expansions.set(error.instancePath, expanded);
        }
    }
    /** Whether an expanded union already accounts for this error, making the raw form redundant. */
    const superseded = (error: ErrorObject): boolean => {
        for (const base of expansions.keys()) {
            if (error.instancePath === base || error.instancePath.startsWith(`${base}/`)) return true;
        }
        return false;
    };

    const issues: ApiValidationIssue[] = [];
    // Keyed by the raising schema, then by path: two candidates at one path stay separate, and one
    // schema's repeats at one path merge.
    const gathered = new Map<unknown, Map<string, { issue: ApiValidationIssue; names: Set<string> }>>();

    for (const error of errors) {
        const path = error.instancePath || '/';
        const message = error.message ?? 'is invalid';
        const expanded = expansions.get(error.instancePath);
        if (expanded && (error.keyword === 'oneOf' || error.keyword === 'anyOf')) {
            // The union's own line frames the candidates that follow it.
            issues.push({ path, message });
            issues.push(...expanded);
            continue;
        }
        if (superseded(error)) continue;

        const additional = additionalProperty(error);
        if (additional === undefined) {
            issues.push({ path, message });
            continue;
        }

        let byPath = gathered.get(error.parentSchema);
        if (!byPath) {
            byPath = new Map();
            gathered.set(error.parentSchema, byPath);
        }
        const existing = byPath.get(path);
        if (existing) {
            // One schema reporting the same name twice is not a second fact.
            if (!existing.names.has(additional)) {
                existing.names.add(additional);
                existing.issue.undeclared?.push(additional);
            }
            continue;
        }
        const issue: ApiValidationIssue = { path, message, undeclared: [additional] };
        byPath.set(path, { issue, names: new Set([additional]) });
        issues.push(issue);
    }
    return issues;
}

/**
 * One failed union, re-stated as what each candidate objected to.
 *
 * `undefined` when the union cannot be attributed exactly — a candidate that is not a `$ref` to a
 * registered component has no name to report it under, and a partly-named expansion would read as
 * though the unnamed candidate had no objection. The raw errors are kept in that case, which is what
 * AJV would have produced anyway.
 */
function expandUnion(error: ErrorObject): ApiValidationIssue[] | undefined {
    const parent = error.parentSchema;
    if (!isPlainObject(parent)) return undefined;
    const members = Array.isArray(parent.oneOf) ? parent.oneOf : Array.isArray(parent.anyOf) ? parent.anyOf : undefined;
    if (!members?.length) return undefined;

    const issues: ApiValidationIssue[] = [];
    for (const member of members) {
        const ref = isPlainObject(member) && typeof member.$ref === 'string' ? member.$ref : undefined;
        if (!ref?.startsWith(COMPONENT_REF_PREFIX)) return undefined;
        const validateMember = getAjv().getSchema(`${AJV_SCHEMA_ID}${ref}`);
        if (!validateMember) return undefined;
        // `verbose: true` puts the value under evaluation on the error, so the candidates are run
        // against exactly what the union saw.
        if (validateMember(error.data)) continue;
        const component = ref.slice(COMPONENT_REF_PREFIX.length);
        for (const issue of toIssues(validateMember.errors ?? [], false)) {
            issues.push({ ...issue, path: joinInstancePath(error.instancePath, issue.path), component });
        }
    }
    return issues.length > 0 ? issues : undefined;
}

/** Re-roots a candidate-relative path under the union's own path. */
function joinInstancePath(base: string, relative: string): string {
    if (relative === '/') return base || '/';
    return `${base}${relative}`;
}

/**
 * The complete rendering of one issue — every name, no budget.
 *
 * This is what gets logged. A caller-facing message renders from {@link ApiValidationIssue} itself
 * with a length limit rather than shortening this string; see `reportableErrors` in the enforcer.
 */
export function renderApiValidationIssue(issue: ApiValidationIssue): string {
    const head = renderApiValidationIssueHead(issue);
    return issue.undeclared?.length ? `${head}: ${issue.undeclared.join(', ')}` : head;
}

/**
 * Everything in a rendered issue except the property names: `<path> [as <component>]: <message>`.
 *
 * Exported because it is not the only renderer. A caller that has to bound the length of a message
 * cannot use {@link renderApiValidationIssue} — it emits every name — and has to rebuild the line
 * from {@link ApiValidationIssue} with its own budget for the names. Rebuilding the HEAD too is what
 * lets the two drift: when `component` was added, the bounded renderer at the HTTP boundary went on
 * concatenating path and message and silently dropped it, so callers were told
 * `must NOT have additional properties: to, when` with no sign it was one candidate's claim. There is
 * one definition of the head so that cannot happen again.
 */
export function renderApiValidationIssueHead(issue: ApiValidationIssue): string {
    return issue.component ? `${issue.path} as ${issue.component}: ${issue.message}` : `${issue.path} ${issue.message}`;
}

/** The failed branch of every validator here, so the two views cannot be built inconsistently. */
function invalidResult(validate: ValidateFunction): { valid: false; errors: string[]; issues: ApiValidationIssue[] } {
    const issues = collectIssues(validate);
    return { valid: false, errors: issues.map(renderApiValidationIssue), issues };
}

export type ValidateApiPayloadResult<T> =
    | { valid: true; data: T }
    /**
     * `errors` is the rendered form, complete and ready to log; `issues` is the same failures with
     * the property names still separable. Shorten from `issues`, never from `errors`.
     */
    | { valid: false; errors: string[]; issues: ApiValidationIssue[] };

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
    return invalidResult(validate);
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
    return invalidResult(validate);
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

export type PruneAndValidateResult<T> =
    | { valid: true; data: T }
    | { valid: false; data: unknown; errors: string[]; issues: ApiValidationIssue[] };

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
    return { ...invalidResult(validate), data: pruned };
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
