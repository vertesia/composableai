import type * as Canonical from '@llumiverse/conversation/schemas';
import type { z } from 'zod';

// Public component names are aliases of the canonical schemas, not a second conversation model.
export type ConversationAccountingProvenance = z.infer<typeof Canonical.AccountingProvenanceSchema>;
export type ConversationAcceptedOutputFragment = z.infer<typeof Canonical.ConversationAcceptedOutputFragmentSchema>;
export type ConversationAgentContentBlock = z.infer<typeof Canonical.AgentContentBlockSchema>;
export type ConversationAgentTurn = z.infer<typeof Canonical.AgentTurnSchema>;
export type ConversationAsset = z.infer<typeof Canonical.AssetSchema>;
export type ConversationAssetKind = z.infer<typeof Canonical.AssetKindSchema>;
export type ConversationAssetMediaMetadata = z.infer<typeof Canonical.AssetMediaMetadataSchema>;
export type ConversationAssetProvenance = z.infer<typeof Canonical.AssetProvenanceSchema>;
export type ConversationAssetStorage = z.infer<typeof Canonical.AssetStorageSchema>;
export type ConversationAssetVersionBinding = z.infer<typeof Canonical.AssetVersionBindingSchema>;
export type ConversationAudioBlock = z.infer<typeof Canonical.AudioBlockSchema>;
export type ConversationAuthority = z.infer<typeof Canonical.AuthoritySchema>;
export type ConversationBase64 = z.infer<typeof Canonical.Base64Schema>;
export type ConversationCacheIntent = z.infer<typeof Canonical.CacheIntentSchema>;
export type ConversationCompactionRecord = z.infer<typeof Canonical.CompactionRecordSchema>;
export type ConversationCompactionSource = z.infer<typeof Canonical.CompactionSourceSchema>;
export type ConversationCompactionStrategy = z.infer<typeof Canonical.CompactionStrategySchema>;
export type ConversationCompleteInputPartition = z.infer<typeof Canonical.CompleteInputPartitionSchema>;
export type ConversationContentHash = z.infer<typeof Canonical.ContentHashSchema>;
export type ConversationContext = z.infer<typeof Canonical.ConversationContextSchema>;
export type ConversationAcceptedToolSelection = z.infer<typeof Canonical.AcceptedToolSelectionSchema>;
export type ConversationEditAnchor = z.infer<typeof Canonical.ConversationEditAnchorSchema>;
export type ConversationEditOperation = z.infer<typeof Canonical.ConversationEditOperationSchema>;
export type ConversationEditPlacement = z.infer<typeof Canonical.ConversationEditPlacementSchema>;
export type ConversationEditRecordRef = z.infer<typeof Canonical.ConversationEditRecordRefSchema>;
export type ConversationDeleteOperation = z.infer<typeof Canonical.ConversationDeleteOperationSchema>;
export type ConversationDeletedTurn = z.infer<typeof Canonical.ConversationDeletedTurnSchema>;
export type ConversationDeletedTurnRef = z.infer<typeof Canonical.ConversationDeletedTurnRefSchema>;
export type ConversationContextChangeOperation = z.infer<typeof Canonical.ContextChangeOperationSchema>;
export type ConversationContextChangeProposal = z.infer<typeof Canonical.ContextChangeProposalSchema>;
export type ConversationSelectedContextBlocks = z.infer<typeof Canonical.SelectedContextBlocksSchema>;
export type ConversationContextChangePlacement = z.infer<typeof Canonical.ContextChangePlacementSchema>;
export type ConversationContextEntry = z.infer<typeof Canonical.ContextEntrySchema>;
export type ConversationContextMeasurement = z.infer<typeof Canonical.ContextMeasurementSchema>;
export type ConversationContextRetrievalRequirement = z.infer<typeof Canonical.ContextRetrievalRequirementSchema>;
export type ConversationDerivedAgentTurn = z.infer<typeof Canonical.DerivedAgentTurnSchema>;
export type ConversationDerivedAssetProvenance = z.infer<typeof Canonical.DerivedAssetProvenanceSchema>;
export type ConversationDerivedTurnProvenance = z.infer<typeof Canonical.DerivedTurnProvenanceSchema>;
export type ConversationDocumentBlock = z.infer<typeof Canonical.DocumentBlockSchema>;
export type ConversationDocumentV0 = z.infer<typeof Canonical.ConversationDocumentSchema>;
export type ConversationExecutedGeneration = z.infer<typeof Canonical.ExecutedGenerationSchema>;
export type ConversationExecutionReceipt = z.infer<typeof Canonical.ExecutionReceiptSchema>;
export type ConversationExtensionBlock = z.infer<typeof Canonical.ExtensionBlockSchema>;
export type ConversationExternalAssetStorage = z.infer<typeof Canonical.ExternalAssetStorageSchema>;
export type ConversationExternalizedToolArguments = z.infer<typeof Canonical.ExternalizedToolArgumentsSchema>;
export type ConversationExternalReferenceBlock = z.infer<typeof Canonical.ExternalReferenceBlockSchema>;
export type ConversationGeneratedAgentTurn = z.infer<typeof Canonical.GeneratedAgentTurnSchema>;
export type ConversationGeneratedAssetProvenance = z.infer<typeof Canonical.GeneratedAssetProvenanceSchema>;
export type ConversationGeneratedTurnProvenance = z.infer<typeof Canonical.GeneratedTurnProvenanceSchema>;
export type ConversationGeneration = z.infer<typeof Canonical.GenerationSchema>;
export type ConversationGenerationCost = z.infer<typeof Canonical.GenerationCostSchema>;
export type ConversationGenerationStatus = z.infer<typeof Canonical.GenerationStatusSchema>;
export type ConversationGenerationTimestamps = z.infer<typeof Canonical.GenerationTimestampsSchema>;
export type ConversationGenerationUsage = z.infer<typeof Canonical.GenerationUsageSchema>;
export type ConversationIdentifier = z.infer<typeof Canonical.IdentifierSchema>;
export type ConversationImageBlock = z.infer<typeof Canonical.ImageBlockSchema>;
export type ConversationImageRegion = z.infer<typeof Canonical.ImageRegionSchema>;
export type ConversationImportedAgentTurn = z.infer<typeof Canonical.ImportedAgentTurnSchema>;
export type ConversationImportedAssetProvenance = z.infer<typeof Canonical.ImportedAssetProvenanceSchema>;
export type ConversationInvalidatedReplayArchive = z.infer<typeof Canonical.InvalidatedReplayArchiveSchema>;
export type ConversationImportedGeneration = z.infer<typeof Canonical.ImportedGenerationSchema>;
export type ConversationImportedTurnProvenance = z.infer<typeof Canonical.ImportedTurnProvenanceSchema>;
export type ConversationInlineBase64AssetStorage = z.infer<typeof Canonical.InlineBase64AssetStorageSchema>;
export type ConversationInlineJsonAssetStorage = z.infer<typeof Canonical.InlineJsonAssetStorageSchema>;
export type ConversationInlineTextAssetStorage = z.infer<typeof Canonical.InlineTextAssetStorageSchema>;
export type ConversationInsertedTurnProvenance = z.infer<typeof Canonical.InsertedTurnProvenanceSchema>;
export type ConversationInvalidToolArguments = z.infer<typeof Canonical.InvalidToolArgumentsSchema>;
export type ConversationJsonBlock = z.infer<typeof Canonical.JsonBlockSchema>;
export type ConversationJsonPath = z.infer<typeof Canonical.JsonPathSchema>;
export type ConversationJsonPathSegment = z.infer<typeof Canonical.JsonPathSegmentSchema>;
export type ConversationJsonObject = z.infer<typeof Canonical.JsonObjectSchema>;
export type ConversationJsonValue = z.infer<typeof Canonical.JsonValueSchema>;
export type ConversationLineage = z.infer<typeof Canonical.ConversationLineageSchema>;
export type ConversationLineageParent = z.infer<typeof Canonical.ConversationLineageParentSchema>;
export type ConversationMetadata = z.infer<typeof Canonical.MetadataSchema>;
export type ConversationMaterializedInput = z.infer<typeof Canonical.ConversationMaterializedInputSchema>;
export type ConversationModelSwitchBlocker = z.infer<typeof Canonical.ConversationModelSwitchBlockerSchema>;
export type ConversationModelSwitchBudgetAnalysis = z.infer<
    typeof Canonical.ConversationModelSwitchBudgetAnalysisSchema
>;
export type ConversationModelSwitchPlan = z.infer<typeof Canonical.ConversationModelSwitchPlanSchema>;
export type ConversationModelTarget = z.infer<typeof Canonical.ModelTargetSchema>;
export type ConversationModelVisibility = z.infer<typeof Canonical.ModelVisibilitySchema>;
export type ConversationNativeIdentity = z.infer<typeof Canonical.NativeIdentitySchema>;
export type ConversationNativeItemMapping = z.infer<typeof Canonical.NativeItemMappingSchema>;
export type ConversationNativeReplayBlock = z.infer<typeof Canonical.NativeReplayBlockSchema>;
export type ConversationNestedToolResultContentBlock = z.infer<typeof Canonical.NestedToolResultContentBlockSchema>;
export type ConversationNongeneratedAgentTurn = z.infer<typeof Canonical.NongeneratedAgentTurnSchema>;
export type ConversationNonGeneratedTurnProvenance = z.infer<typeof Canonical.NonGeneratedTurnProvenanceSchema>;
export type ConversationNonnegativeSafeInteger = z.infer<typeof Canonical.NonnegativeSafeIntegerSchema>;
export type ConversationOperationReceipt = z.infer<typeof Canonical.OperationReceiptSchema>;
export type ConversationOutputAsset = z.infer<typeof Canonical.ConversationOutputAssetSchema>;
export type ConversationOutputBlock = z.infer<typeof Canonical.ConversationOutputBlockSchema>;
export type ConversationOutputCompleteness = z.infer<typeof Canonical.ConversationOutputCompletenessSchema>;
export type ConversationOutputGeneration = z.infer<typeof Canonical.ConversationOutputGenerationSchema>;
export type ConversationOutputGenerationUsage = z.infer<typeof Canonical.ConversationOutputGenerationUsageSchema>;
export type ConversationOutputReceipt = z.infer<typeof Canonical.ConversationOutputReceiptSchema>;
export type ConversationOutputToolCallBlock = z.infer<typeof Canonical.ConversationOutputToolCallBlockSchema>;
export type ConversationOutputTurn = z.infer<typeof Canonical.ConversationOutputTurnSchema>;
export type ConversationPageRange = z.infer<typeof Canonical.PageRangeSchema>;
export type ConversationPositiveSafeInteger = z.infer<typeof Canonical.PositiveSafeIntegerSchema>;
export type ConversationProcessingAttemptReceipt = z.infer<typeof Canonical.ProcessingAttemptReceiptSchema>;
export type ConversationProcessingBudget = z.infer<typeof Canonical.ProcessingBudgetSchema>;
export type ConversationProcessingCompletionReceipt = z.infer<typeof Canonical.ProcessingCompletionReceiptSchema>;
export type ConversationProcessingJob = z.infer<typeof Canonical.ProcessingJobSchema>;
export type ConversationProcessingJobSelection = z.infer<typeof Canonical.ProcessingJobSelectionSchema>;
export type ConversationProcessingOperation = z.infer<typeof Canonical.ProcessingOperationSchema>;
export type ConversationProcessingOutputReceipt = z.infer<typeof Canonical.ProcessingOutputReceiptSchema>;
export type ConversationProcessingReadinessCoverage = z.infer<typeof Canonical.ProcessingReadinessCoverageSchema>;
export type ConversationProcessingResolvedInput = z.infer<typeof Canonical.ProcessingResolvedInputSchema>;
export type ConversationProcessingState = z.infer<typeof Canonical.ProcessingStateSchema>;
export type ConversationProcessingSupersessionReceipt = z.infer<typeof Canonical.ProcessingSupersessionReceiptSchema>;
export type ConversationProcessorConfiguration = z.infer<typeof Canonical.ProcessorConfigurationSchema>;
export type ConversationProgramContentBlock = z.infer<typeof Canonical.ProgramContentBlockSchema>;
export type ConversationProgramTurn = z.infer<typeof Canonical.ProgramTurnSchema>;
export type ConversationProgramTurnPresentation = z.infer<typeof Canonical.ProgramTurnPresentationSchema>;
export type ConversationReasoningBlock = z.infer<typeof Canonical.ReasoningBlockSchema>;
export type ConversationReceivedAssetProvenance = z.infer<typeof Canonical.ReceivedAssetProvenanceSchema>;
export type ConversationReceivedTurnProvenance = z.infer<typeof Canonical.ReceivedTurnProvenanceSchema>;
export type ConversationRef = z.infer<typeof Canonical.ConversationRefSchema>;
export type ConversationReplacementTurnContextEntry = z.infer<typeof Canonical.ReplacementTurnContextEntrySchema>;
export type ConversationReplayCompatibilityScope = z.infer<typeof Canonical.ReplayCompatibilityScopeSchema>;
export type ConversationReplayDependencies = z.infer<typeof Canonical.ReplayDependenciesSchema>;
export type ConversationReportedUsage = z.infer<typeof Canonical.ReportedUsageSchema>;
export type ConversationRequestReceipt = z.infer<typeof Canonical.RequestReceiptSchema>;
export type ConversationRequestSourceViewReference = z.infer<typeof Canonical.RequestSourceViewReferenceSchema>;
export type ConversationRetrievalCapability = z.infer<typeof Canonical.RetrievalCapabilitySchema>;
export type ConversationSourceTurnContextEntry = z.infer<typeof Canonical.SourceTurnContextEntrySchema>;
export type ConversationStructuredToolArguments = z.infer<typeof Canonical.StructuredToolArgumentsSchema>;
export type ConversationTextBlock = z.infer<typeof Canonical.TextBlockSchema>;
export type ConversationTextAssetToolArgumentHydration = z.infer<typeof Canonical.TextAssetToolArgumentHydrationSchema>;
export type ConversationTimeRange = z.infer<typeof Canonical.TimeRangeSchema>;
export type ConversationTimestamp = z.infer<typeof Canonical.TimestampSchema>;
export type ConversationToolArguments = z.infer<typeof Canonical.ToolArgumentsSchema>;
export type ConversationToolArgumentHydration = z.infer<typeof Canonical.ToolArgumentHydrationSchema>;
export type ConversationToolCallBlock = z.infer<typeof Canonical.ToolCallBlockSchema>;
export type ConversationToolDefinition = z.infer<typeof Canonical.ToolDefinitionSchema>;
export type ConversationToolInputSchema = z.infer<typeof Canonical.ToolInputSchemaSchema>;
export type ConversationToolResultBlock = z.infer<typeof Canonical.ToolResultBlockSchema>;
export type ConversationToolResultCapability = z.infer<typeof Canonical.ToolResultCapabilitySchema>;
export type ConversationToolTurn = z.infer<typeof Canonical.ToolTurnSchema>;
export type ConversationTurn = z.infer<typeof Canonical.ConversationTurnSchema>;
export type ConversationTurnStatus = z.infer<typeof Canonical.TurnStatusSchema>;
export type ConversationTurnTimestamps = z.infer<typeof Canonical.TurnTimestampsSchema>;
export type ConversationUsageAccountingProvenance = z.infer<typeof Canonical.UsageAccountingProvenanceSchema>;
export type ConversationUserContentBlock = z.infer<typeof Canonical.UserContentBlockSchema>;
export type ConversationUserTurn = z.infer<typeof Canonical.UserTurnSchema>;
export type ConversationVideoBlock = z.infer<typeof Canonical.VideoBlockSchema>;

import type * as Wire from './wire-types.generated.js';
export type InitialAuthoringMedia = Wire.InitialAuthoringMedia;
export type InitialAuthoringSegment = Wire.InitialAuthoringSegment;
export type InitialAuthoringInputRecord = Wire.InitialAuthoringInputRecord;
export type ExperimentalInitialAuthoringViewQuery = Wire.ExperimentalInitialAuthoringViewQuery;
export type AvailableInitialAuthoringView = Wire.AvailableInitialAuthoringView;
export type UnavailableInitialAuthoringView = Wire.UnavailableInitialAuthoringView;
export type ExperimentalInitialAuthoringViewResponse = Wire.ExperimentalInitialAuthoringViewResponse;
export type AvailableRunConversation = Wire.AvailableRunConversation;
export type UnavailableRunConversation = Wire.UnavailableRunConversation;
export type RunConversationResponse = Wire.RunConversationResponse;
export type ConversationToolCallSourceRef = z.infer<typeof Canonical.ToolCallSourceRefSchema>;
export type ConversationPendingApplicationToolCall = z.infer<typeof Canonical.PendingApplicationToolCallSchema>;
export type ConversationApplicationToolCallBlock = z.infer<typeof Canonical.ApplicationToolCallBlockSchema>;
export type ConversationApplicationToolExecutionReceipt = z.infer<
    typeof Canonical.ApplicationToolExecutionReceiptSchema
>;
export type ConversationExecutedToolTurn = z.infer<typeof Canonical.ExecutedToolTurnSchema>;
export type ConversationToolExecutionRequest = z.infer<typeof Canonical.ConversationToolExecutionRequestSchema>;
export type ConversationToolExecutionResult = z.infer<typeof Canonical.ConversationToolExecutionResultSchema>;
export type ConversationTranscriptJsonToolArguments = z.infer<
    typeof Canonical.ConversationTranscriptJsonToolArgumentsSchema
>;
export type ConversationTranscriptInvalidToolArguments = z.infer<
    typeof Canonical.ConversationTranscriptInvalidToolArgumentsSchema
>;
export type ConversationTranscriptToolArguments = z.infer<typeof Canonical.ConversationTranscriptToolArgumentsSchema>;
export type ConversationTranscriptToolCallBlock = z.infer<typeof Canonical.ConversationTranscriptToolCallBlockSchema>;
export type ConversationTranscriptRenderableBlock = z.infer<
    typeof Canonical.ConversationTranscriptRenderableBlockSchema
>;
export type ConversationTranscriptToolResultBlock = z.infer<
    typeof Canonical.ConversationTranscriptToolResultBlockSchema
>;
export type ConversationTranscriptUserBlock = z.infer<typeof Canonical.ConversationTranscriptUserBlockSchema>;
export type ConversationTranscriptAgentBlock = z.infer<typeof Canonical.ConversationTranscriptAgentBlockSchema>;
export type ConversationTranscriptProgramBlock = z.infer<typeof Canonical.ConversationTranscriptProgramBlockSchema>;
export type ConversationTranscriptUserTurn = z.infer<typeof Canonical.ConversationTranscriptUserTurnSchema>;
export type ConversationTranscriptAgentTurn = z.infer<typeof Canonical.ConversationTranscriptAgentTurnSchema>;
export type ConversationTranscriptToolTurn = z.infer<typeof Canonical.ConversationTranscriptToolTurnSchema>;
export type ConversationTranscriptProgramTurn = z.infer<typeof Canonical.ConversationTranscriptProgramTurnSchema>;
export type ConversationTranscriptTurn = z.infer<typeof Canonical.ConversationTranscriptTurnSchema>;
export type ConversationTranscriptAsset = z.infer<typeof Canonical.ConversationTranscriptAssetSchema>;
export type ConversationTranscriptExecutedGeneration = z.infer<
    typeof Canonical.ConversationTranscriptExecutedGenerationSchema
>;
export type ConversationTranscriptImportedGeneration = z.infer<
    typeof Canonical.ConversationTranscriptImportedGenerationSchema
>;
export type ConversationTranscriptGeneration = z.infer<typeof Canonical.ConversationTranscriptGenerationSchema>;
export type ConversationTranscriptGenerationMap = z.infer<typeof Canonical.ConversationTranscriptGenerationMapSchema>;
export type ConversationTranscriptTurnOmissionReason = z.infer<
    typeof Canonical.ConversationTranscriptTurnOmissionReasonSchema
>;
export type ConversationTranscriptTurnOmission = z.infer<typeof Canonical.ConversationTranscriptTurnOmissionSchema>;
export type ConversationTranscriptBlockOmissionReason = z.infer<
    typeof Canonical.ConversationTranscriptBlockOmissionReasonSchema
>;
export type ConversationTranscriptBlockOmission = z.infer<typeof Canonical.ConversationTranscriptBlockOmissionSchema>;
export type ConversationTranscriptAssetOmissionReason = z.infer<
    typeof Canonical.ConversationTranscriptAssetOmissionReasonSchema
>;
export type ConversationTranscriptAssetOmission = z.infer<typeof Canonical.ConversationTranscriptAssetOmissionSchema>;
export type ConversationTranscriptGenerationOmissionReason = z.infer<
    typeof Canonical.ConversationTranscriptGenerationOmissionReasonSchema
>;
export type ConversationTranscriptGenerationOmission = z.infer<
    typeof Canonical.ConversationTranscriptGenerationOmissionSchema
>;
export type ConversationTranscriptCompleteness = z.infer<typeof Canonical.ConversationTranscriptCompletenessSchema>;
export type ConversationTranscriptFragment = z.infer<typeof Canonical.ConversationTranscriptFragmentSchema>;
export type ConversationStreamIdentity = z.infer<typeof Canonical.ConversationStreamIdentitySchema>;
export type ConversationStreamCursor = z.infer<typeof Canonical.ConversationStreamCursorSchema>;
export type ConversationNativeStreamPathSegment = z.infer<typeof Canonical.NativeStreamPathSegmentSchema>;
export type ConversationNativeStreamPosition = z.infer<typeof Canonical.NativeStreamPositionSchema>;
export type ConversationStreamDraftBlock = z.infer<typeof Canonical.ConversationStreamDraftBlockSchema>;
export type ConversationStreamFailureDiagnostic = z.infer<typeof Canonical.ConversationStreamFailureDiagnosticSchema>;
export type ConversationStreamReconciliation = z.infer<typeof Canonical.ConversationStreamReconciliationSchema>;
export type ConversationStreamTransformationProof = z.infer<
    typeof Canonical.ConversationStreamTransformationProofSchema
>;
export type ConversationStreamResponseMapping = z.infer<typeof Canonical.ConversationStreamResponseMappingSchema>;
export type ConversationStreamDecodeEvidence = z.infer<typeof Canonical.ConversationStreamDecodeEvidenceSchema>;
export type ConversationStreamEvent = z.infer<typeof Canonical.ConversationStreamEventSchema>;

export type ConversationEditOperationV1 = z.infer<typeof Canonical.ConversationEditOperationV1Schema>;
export type ConversationSliceEditOperation = z.infer<typeof Canonical.ConversationSliceEditOperationSchema>;
export type ConversationSourceBlockSlice = z.infer<typeof Canonical.SourceBlockSliceSchema>;
export type ConversationJsonSourceRegion = z.infer<typeof Canonical.JsonSourceRegionSchema>;
export type ConversationJsonInverseMapping = z.infer<typeof Canonical.JsonInverseMappingSchema>;
export type ConversationDerivedBlockLineageGroup = z.infer<typeof Canonical.DerivedBlockLineageGroupSchema>;
export type ConversationDerivedBlockLineage = z.infer<typeof Canonical.DerivedBlockLineageSchema>;
export type ConversationTextCodePointRange = z.infer<typeof Canonical.TextCodePointRangeSchema>;
export type ConversationJsonPointer = z.infer<typeof Canonical.JsonPointerSchema>;

export type ConversationJsonMinificationTransform = z.infer<typeof Canonical.JsonMinificationTransformSchema>;
export type ConversationJsonMinificationMeasuredProjection = z.infer<
    typeof Canonical.JsonMinificationMeasuredProjectionSchema
>;
export type ConversationJsonMinificationMeasurement = z.infer<typeof Canonical.JsonMinificationMeasurementSchema>;
export type ConversationJsonMinificationProposal = z.infer<typeof Canonical.JsonMinificationProposalSchema>;
export type ConversationJsonMinificationNoOpReason = z.infer<typeof Canonical.JsonMinificationNoOpReasonSchema>;
export type ConversationJsonMinificationApplication = z.infer<typeof Canonical.JsonMinificationApplicationSchema>;
