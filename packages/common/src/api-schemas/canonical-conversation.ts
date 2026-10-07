import * as Canonical from '@llumiverse/conversation/schemas';

// The canonical package owns these definitions; identify their names without restating their shapes.
/** Preserve exact named component keys and Zod inference without serializing one giant inferred object. */
interface CanonicalConversationSchemaMap {
    ConversationJsonMinificationTransform: typeof Canonical.JsonMinificationTransformSchema;
    ConversationJsonMinificationMeasuredProjection: typeof Canonical.JsonMinificationMeasuredProjectionSchema;
    ConversationJsonMinificationMeasurement: typeof Canonical.JsonMinificationMeasurementSchema;
    ConversationJsonMinificationProposal: typeof Canonical.JsonMinificationProposalSchema;
    ConversationJsonMinificationNoOpReason: typeof Canonical.JsonMinificationNoOpReasonSchema;
    ConversationJsonMinificationApplication: typeof Canonical.JsonMinificationApplicationSchema;

    ConversationTextCodePointRange: typeof Canonical.TextCodePointRangeSchema;
    ConversationJsonPointer: typeof Canonical.JsonPointerSchema;

    ConversationEditOperationV1: typeof Canonical.ConversationEditOperationV1Schema;
    ConversationSliceEditOperation: typeof Canonical.ConversationSliceEditOperationSchema;
    ConversationSourceBlockSlice: typeof Canonical.SourceBlockSliceSchema;
    ConversationJsonSourceRegion: typeof Canonical.JsonSourceRegionSchema;
    ConversationJsonInverseMapping: typeof Canonical.JsonInverseMappingSchema;
    ConversationDerivedBlockLineageGroup: typeof Canonical.DerivedBlockLineageGroupSchema;
    ConversationDerivedBlockLineage: typeof Canonical.DerivedBlockLineageSchema;

    ConversationAccountingProvenance: typeof Canonical.AccountingProvenanceSchema;
    ConversationAcceptedOutputFragment: typeof Canonical.ConversationAcceptedOutputFragmentSchema;
    ConversationAgentContentBlock: typeof Canonical.AgentContentBlockSchema;
    ConversationAgentTurn: typeof Canonical.AgentTurnSchema;
    ConversationAsset: typeof Canonical.AssetSchema;
    ConversationAssetKind: typeof Canonical.AssetKindSchema;
    ConversationAssetMediaMetadata: typeof Canonical.AssetMediaMetadataSchema;
    ConversationAssetProvenance: typeof Canonical.AssetProvenanceSchema;
    ConversationAssetStorage: typeof Canonical.AssetStorageSchema;
    ConversationAssetVersionBinding: typeof Canonical.AssetVersionBindingSchema;
    ConversationAudioBlock: typeof Canonical.AudioBlockSchema;
    ConversationAuthority: typeof Canonical.AuthoritySchema;
    ConversationBase64: typeof Canonical.Base64Schema;
    ConversationCacheIntent: typeof Canonical.CacheIntentSchema;
    ConversationCompactionRecord: typeof Canonical.CompactionRecordSchema;
    ConversationCompactionSource: typeof Canonical.CompactionSourceSchema;
    ConversationCompactionStrategy: typeof Canonical.CompactionStrategySchema;
    ConversationCompleteInputPartition: typeof Canonical.CompleteInputPartitionSchema;
    ConversationContentHash: typeof Canonical.ContentHashSchema;
    ConversationContext: typeof Canonical.ConversationContextSchema;
    ConversationAcceptedToolSelection: typeof Canonical.AcceptedToolSelectionSchema;
    ConversationEditAnchor: typeof Canonical.ConversationEditAnchorSchema;
    ConversationEditOperation: typeof Canonical.ConversationEditOperationSchema;
    ConversationEditPlacement: typeof Canonical.ConversationEditPlacementSchema;
    ConversationEditRecordRef: typeof Canonical.ConversationEditRecordRefSchema;
    ConversationDeleteOperation: typeof Canonical.ConversationDeleteOperationSchema;
    ConversationIndexedUpgradeOperation: typeof Canonical.IndexedConversationUpgradeOperationSchema;
    ConversationDeletedTurn: typeof Canonical.ConversationDeletedTurnSchema;
    ConversationDeletedTurnRef: typeof Canonical.ConversationDeletedTurnRefSchema;
    ConversationContextChangeOperation: typeof Canonical.ContextChangeOperationSchema;
    ConversationContextChangeProposal: typeof Canonical.ContextChangeProposalSchema;
    ConversationSelectedContextBlocks: typeof Canonical.SelectedContextBlocksSchema;
    ConversationContextChangePlacement: typeof Canonical.ContextChangePlacementSchema;
    ConversationContextEntry: typeof Canonical.ContextEntrySchema;
    ConversationContextMeasurement: typeof Canonical.ContextMeasurementSchema;
    ConversationContextMetadataPredicate: typeof Canonical.ContextMetadataPredicateSchema;
    ConversationContextSelectionActorKind: typeof Canonical.ContextSelectionActorKindSchema;
    ConversationContextSelectionAnchor: typeof Canonical.ContextSelectionAnchorSchema;
    ConversationContextSelectionBlockType: typeof Canonical.ContextSelectionBlockTypeSchema;
    ConversationContextSelectionRange: typeof Canonical.ContextSelectionRangeSchema;
    ConversationContextSelectionRequest: typeof Canonical.ContextSelectionRequestSchema;
    ConversationContextSelector: typeof Canonical.ContextSelectorSchema;
    ConversationContextRetrievalRequirement: typeof Canonical.ContextRetrievalRequirementSchema;
    ConversationDerivedAgentTurn: typeof Canonical.DerivedAgentTurnSchema;
    ConversationDerivedAssetProvenance: typeof Canonical.DerivedAssetProvenanceSchema;
    ConversationDerivedTurnProvenance: typeof Canonical.DerivedTurnProvenanceSchema;
    ConversationDocumentBlock: typeof Canonical.DocumentBlockSchema;
    ConversationDocumentV0: typeof Canonical.ConversationDocumentSchema;
    ConversationExecutedGeneration: typeof Canonical.ExecutedGenerationSchema;
    ConversationToolRetrievalByteProjection: typeof Canonical.ToolRetrievalByteProjectionSchema;
    ConversationToolRetrievalLineProjection: typeof Canonical.ToolRetrievalLineProjectionSchema;
    ConversationToolRetrievalProjection: typeof Canonical.ToolRetrievalProjectionSchema;
    ConversationToolRetrievalExcerpt: typeof Canonical.ToolRetrievalExcerptSchema;
    ConversationToolExecutionMetadata: typeof Canonical.ToolExecutionMetadataSchema;
    ConversationExecutionReceipt: typeof Canonical.ExecutionReceiptSchema;
    ConversationExtensionBlock: typeof Canonical.ExtensionBlockSchema;
    ConversationExternalAssetStorage: typeof Canonical.ExternalAssetStorageSchema;
    ConversationExternalizedToolArguments: typeof Canonical.ExternalizedToolArgumentsSchema;
    ConversationExternalReferenceBlock: typeof Canonical.ExternalReferenceBlockSchema;
    ConversationGeneratedAgentTurn: typeof Canonical.GeneratedAgentTurnSchema;
    ConversationGeneratedAssetProvenance: typeof Canonical.GeneratedAssetProvenanceSchema;
    ConversationGeneratedTurnProvenance: typeof Canonical.GeneratedTurnProvenanceSchema;
    ConversationGeneration: typeof Canonical.GenerationSchema;
    ConversationGenerationCost: typeof Canonical.GenerationCostSchema;
    ConversationGenerationStatus: typeof Canonical.GenerationStatusSchema;
    ConversationGenerationTimestamps: typeof Canonical.GenerationTimestampsSchema;
    ConversationGenerationUsage: typeof Canonical.GenerationUsageSchema;
    ConversationIdentifier: typeof Canonical.IdentifierSchema;
    ConversationImageBlock: typeof Canonical.ImageBlockSchema;
    ConversationImageRegion: typeof Canonical.ImageRegionSchema;
    ConversationImportedAgentTurn: typeof Canonical.ImportedAgentTurnSchema;
    ConversationImportedAssetProvenance: typeof Canonical.ImportedAssetProvenanceSchema;
    ConversationInvalidatedReplayArchive: typeof Canonical.InvalidatedReplayArchiveSchema;
    ConversationImportedGeneration: typeof Canonical.ImportedGenerationSchema;
    ConversationImportedTurnProvenance: typeof Canonical.ImportedTurnProvenanceSchema;
    ConversationInlineBase64AssetStorage: typeof Canonical.InlineBase64AssetStorageSchema;
    ConversationInlineJsonAssetStorage: typeof Canonical.InlineJsonAssetStorageSchema;
    ConversationInlineTextAssetStorage: typeof Canonical.InlineTextAssetStorageSchema;
    ConversationInsertedTurnProvenance: typeof Canonical.InsertedTurnProvenanceSchema;
    ConversationInvalidToolArguments: typeof Canonical.InvalidToolArgumentsSchema;
    ConversationJsonBlock: typeof Canonical.JsonBlockSchema;
    ConversationJsonPath: typeof Canonical.JsonPathSchema;
    ConversationJsonPathSegment: typeof Canonical.JsonPathSegmentSchema;
    ConversationJsonObject: typeof Canonical.JsonObjectSchema;
    ConversationJsonValue: typeof Canonical.JsonValueSchema;
    ConversationLineage: typeof Canonical.ConversationLineageSchema;
    ConversationLineageParent: typeof Canonical.ConversationLineageParentSchema;
    ConversationMetadata: typeof Canonical.MetadataSchema;
    ConversationMaterializedInput: typeof Canonical.ConversationMaterializedInputSchema;
    ConversationModelSwitchBlocker: typeof Canonical.ConversationModelSwitchBlockerSchema;
    ConversationModelSwitchBudgetAnalysis: typeof Canonical.ConversationModelSwitchBudgetAnalysisSchema;
    ConversationModelSwitchPlan: typeof Canonical.ConversationModelSwitchPlanSchema;
    ConversationModelTarget: typeof Canonical.ModelTargetSchema;
    ConversationModelVisibility: typeof Canonical.ModelVisibilitySchema;
    ConversationNativeIdentity: typeof Canonical.NativeIdentitySchema;
    ConversationNativeItemMapping: typeof Canonical.NativeItemMappingSchema;
    ConversationNativeReplayBlock: typeof Canonical.NativeReplayBlockSchema;
    ConversationNestedToolResultContentBlock: typeof Canonical.NestedToolResultContentBlockSchema;
    ConversationNongeneratedAgentTurn: typeof Canonical.NongeneratedAgentTurnSchema;
    ConversationNonGeneratedTurnProvenance: typeof Canonical.NonGeneratedTurnProvenanceSchema;
    ConversationNonnegativeSafeInteger: typeof Canonical.NonnegativeSafeIntegerSchema;
    ConversationOperationReceipt: typeof Canonical.OperationReceiptSchema;
    ConversationOutputAsset: typeof Canonical.ConversationOutputAssetSchema;
    ConversationOutputBlock: typeof Canonical.ConversationOutputBlockSchema;
    ConversationOutputCompleteness: typeof Canonical.ConversationOutputCompletenessSchema;
    ConversationOutputGeneration: typeof Canonical.ConversationOutputGenerationSchema;
    ConversationOutputGenerationUsage: typeof Canonical.ConversationOutputGenerationUsageSchema;
    ConversationOutputReceipt: typeof Canonical.ConversationOutputReceiptSchema;
    ConversationOutputToolCallBlock: typeof Canonical.ConversationOutputToolCallBlockSchema;
    ConversationOutputTurn: typeof Canonical.ConversationOutputTurnSchema;
    ConversationPageRange: typeof Canonical.PageRangeSchema;
    ConversationPositiveSafeInteger: typeof Canonical.PositiveSafeIntegerSchema;
    ConversationProcessingAttemptReceipt: typeof Canonical.ProcessingAttemptReceiptSchema;
    ConversationProcessingBudget: typeof Canonical.ProcessingBudgetSchema;
    ConversationProcessingCompletionReceipt: typeof Canonical.ProcessingCompletionReceiptSchema;
    ConversationProcessingJob: typeof Canonical.ProcessingJobSchema;
    ConversationProcessingJobSelection: typeof Canonical.ProcessingJobSelectionSchema;
    ConversationProcessingOperation: typeof Canonical.ProcessingOperationSchema;
    ConversationProcessingQueueCommand: typeof Canonical.ProcessingQueueCommandSchema;
    ConversationProcessingPolicyCommand: typeof Canonical.ProcessingPolicyCommandSchema;
    ConversationInitialProcessingPolicy: typeof Canonical.InitialProcessingPolicySchema;
    ConversationProcessingPolicyGenesis: typeof Canonical.ProcessingPolicyGenesisSchema;
    ConversationProcessingQueueAcceptanceInput: typeof Canonical.ProcessingQueueAcceptanceInputSchema;
    ConversationProcessingOutputReceipt: typeof Canonical.ProcessingOutputReceiptSchema;
    ConversationProcessingReadinessCoverage: typeof Canonical.ProcessingReadinessCoverageSchema;
    ConversationProcessingResolvedInput: typeof Canonical.ProcessingResolvedInputSchema;
    ConversationProcessingState: typeof Canonical.ProcessingStateSchema;
    ConversationProcessingSupersessionReceipt: typeof Canonical.ProcessingSupersessionReceiptSchema;
    ConversationProcessorConfiguration: typeof Canonical.ProcessorConfigurationSchema;
    ConversationProgramContentBlock: typeof Canonical.ProgramContentBlockSchema;
    ConversationProgramTurn: typeof Canonical.ProgramTurnSchema;
    ConversationProgramTurnPresentation: typeof Canonical.ProgramTurnPresentationSchema;
    ConversationReasoningBlock: typeof Canonical.ReasoningBlockSchema;
    ConversationReceivedAssetProvenance: typeof Canonical.ReceivedAssetProvenanceSchema;
    ConversationReceivedTurnProvenance: typeof Canonical.ReceivedTurnProvenanceSchema;
    ConversationRef: typeof Canonical.ConversationRefSchema;
    ConversationReplacementTurnContextEntry: typeof Canonical.ReplacementTurnContextEntrySchema;
    ConversationReplayCompatibilityScope: typeof Canonical.ReplayCompatibilityScopeSchema;
    ConversationReplayDependencies: typeof Canonical.ReplayDependenciesSchema;
    ConversationReportedUsage: typeof Canonical.ReportedUsageSchema;
    ConversationRequestReceipt: typeof Canonical.RequestReceiptSchema;
    ConversationRequestSourceViewReference: typeof Canonical.RequestSourceViewReferenceSchema;
    ConversationRetrievalCapability: typeof Canonical.RetrievalCapabilitySchema;
    ConversationSourceTurnContextEntry: typeof Canonical.SourceTurnContextEntrySchema;
    ConversationStructuredToolArguments: typeof Canonical.StructuredToolArgumentsSchema;
    ConversationTextBlock: typeof Canonical.TextBlockSchema;
    ConversationTextAssetToolArgumentHydration: typeof Canonical.TextAssetToolArgumentHydrationSchema;
    ConversationTimeRange: typeof Canonical.TimeRangeSchema;
    ConversationTimestamp: typeof Canonical.TimestampSchema;
    ConversationToolArguments: typeof Canonical.ToolArgumentsSchema;
    ConversationToolArgumentHydration: typeof Canonical.ToolArgumentHydrationSchema;
    ConversationToolCallBlock: typeof Canonical.ToolCallBlockSchema;
    ConversationToolDefinition: typeof Canonical.ToolDefinitionSchema;
    ConversationToolInputSchema: typeof Canonical.ToolInputSchemaSchema;
    ConversationToolResultBlock: typeof Canonical.ToolResultBlockSchema;
    ConversationToolResultCapability: typeof Canonical.ToolResultCapabilitySchema;
    ConversationToolTurn: typeof Canonical.ToolTurnSchema;
    ConversationTurn: typeof Canonical.ConversationTurnSchema;
    ConversationTurnStatus: typeof Canonical.TurnStatusSchema;
    ConversationTurnTimestamps: typeof Canonical.TurnTimestampsSchema;
    ConversationUsageAccountingProvenance: typeof Canonical.UsageAccountingProvenanceSchema;
    ConversationUserContentBlock: typeof Canonical.UserContentBlockSchema;
    ConversationUserTurn: typeof Canonical.UserTurnSchema;
    ConversationVideoBlock: typeof Canonical.VideoBlockSchema;
    ConversationToolCallSourceRef: typeof Canonical.ToolCallSourceRefSchema;
    ConversationApplicationToolCallBlock: typeof Canonical.ApplicationToolCallBlockSchema;
    ConversationApplicationToolExecutionReceipt: typeof Canonical.ApplicationToolExecutionReceiptSchema;
    ConversationExecutedToolTurn: typeof Canonical.ExecutedToolTurnSchema;
    ConversationToolExecutionRequest: typeof Canonical.ConversationToolExecutionRequestSchema;
    ConversationToolExecutionResult: typeof Canonical.ConversationToolExecutionResultSchema;
    ConversationTranscriptJsonToolArguments: typeof Canonical.ConversationTranscriptJsonToolArgumentsSchema;
    ConversationTranscriptInvalidToolArguments: typeof Canonical.ConversationTranscriptInvalidToolArgumentsSchema;
    ConversationTranscriptToolArguments: typeof Canonical.ConversationTranscriptToolArgumentsSchema;
    ConversationTranscriptToolCallBlock: typeof Canonical.ConversationTranscriptToolCallBlockSchema;
    ConversationTranscriptExternalReferenceBlock: typeof Canonical.ConversationTranscriptExternalReferenceBlockSchema;
    ConversationTranscriptRenderableBlock: typeof Canonical.ConversationTranscriptRenderableBlockSchema;
    ConversationTranscriptToolResultBlock: typeof Canonical.ConversationTranscriptToolResultBlockSchema;
    ConversationTranscriptUserBlock: typeof Canonical.ConversationTranscriptUserBlockSchema;
    ConversationTranscriptAgentBlock: typeof Canonical.ConversationTranscriptAgentBlockSchema;
    ConversationTranscriptProgramBlock: typeof Canonical.ConversationTranscriptProgramBlockSchema;
    ConversationTranscriptUserTurn: typeof Canonical.ConversationTranscriptUserTurnSchema;
    ConversationTranscriptAgentTurn: typeof Canonical.ConversationTranscriptAgentTurnSchema;
    ConversationTranscriptToolTurn: typeof Canonical.ConversationTranscriptToolTurnSchema;
    ConversationTranscriptProgramTurn: typeof Canonical.ConversationTranscriptProgramTurnSchema;
    ConversationTranscriptTurn: typeof Canonical.ConversationTranscriptTurnSchema;
    ConversationTranscriptAsset: typeof Canonical.ConversationTranscriptAssetSchema;
    ConversationTranscriptExecutedGeneration: typeof Canonical.ConversationTranscriptExecutedGenerationSchema;
    ConversationTranscriptImportedGeneration: typeof Canonical.ConversationTranscriptImportedGenerationSchema;
    ConversationTranscriptGeneration: typeof Canonical.ConversationTranscriptGenerationSchema;
    ConversationTranscriptGenerationMap: typeof Canonical.ConversationTranscriptGenerationMapSchema;
    ConversationTranscriptTurnOmissionReason: typeof Canonical.ConversationTranscriptTurnOmissionReasonSchema;
    ConversationTranscriptTurnOmission: typeof Canonical.ConversationTranscriptTurnOmissionSchema;
    ConversationTranscriptBlockOmissionReason: typeof Canonical.ConversationTranscriptBlockOmissionReasonSchema;
    ConversationTranscriptBlockOmission: typeof Canonical.ConversationTranscriptBlockOmissionSchema;
    ConversationTranscriptAssetOmissionReason: typeof Canonical.ConversationTranscriptAssetOmissionReasonSchema;
    ConversationTranscriptAssetOmission: typeof Canonical.ConversationTranscriptAssetOmissionSchema;
    ConversationTranscriptGenerationOmissionReason: typeof Canonical.ConversationTranscriptGenerationOmissionReasonSchema;
    ConversationTranscriptGenerationOmission: typeof Canonical.ConversationTranscriptGenerationOmissionSchema;
    ConversationTranscriptCompleteness: typeof Canonical.ConversationTranscriptCompletenessSchema;
    ConversationTranscriptFragment: typeof Canonical.ConversationTranscriptFragmentSchema;
    ConversationStreamIdentity: typeof Canonical.ConversationStreamIdentitySchema;
    ConversationStreamCursor: typeof Canonical.ConversationStreamCursorSchema;
    ConversationNativeStreamPathSegment: typeof Canonical.NativeStreamPathSegmentSchema;
    ConversationNativeStreamPosition: typeof Canonical.NativeStreamPositionSchema;
    ConversationStreamDraftBlock: typeof Canonical.ConversationStreamDraftBlockSchema;
    ConversationStreamFailureDiagnostic: typeof Canonical.ConversationStreamFailureDiagnosticSchema;
    ConversationStreamReconciliation: typeof Canonical.ConversationStreamReconciliationSchema;
    ConversationStreamTransformationProof: typeof Canonical.ConversationStreamTransformationProofSchema;
    ConversationStreamResponseMapping: typeof Canonical.ConversationStreamResponseMappingSchema;
    ConversationStreamDecodeEvidence: typeof Canonical.ConversationStreamDecodeEvidenceSchema;
    ConversationStreamEvent: typeof Canonical.ConversationStreamEventSchema;
}

export const CANONICAL_CONVERSATION_SCHEMAS: CanonicalConversationSchemaMap = {
    ConversationJsonMinificationTransform: Canonical.JsonMinificationTransformSchema,
    ConversationJsonMinificationMeasuredProjection: Canonical.JsonMinificationMeasuredProjectionSchema,
    ConversationJsonMinificationMeasurement: Canonical.JsonMinificationMeasurementSchema,
    ConversationJsonMinificationProposal: Canonical.JsonMinificationProposalSchema,
    ConversationJsonMinificationNoOpReason: Canonical.JsonMinificationNoOpReasonSchema,
    ConversationJsonMinificationApplication: Canonical.JsonMinificationApplicationSchema,

    ConversationTextCodePointRange: Canonical.TextCodePointRangeSchema,
    ConversationJsonPointer: Canonical.JsonPointerSchema,

    ConversationEditOperationV1: Canonical.ConversationEditOperationV1Schema,
    ConversationSliceEditOperation: Canonical.ConversationSliceEditOperationSchema,
    ConversationSourceBlockSlice: Canonical.SourceBlockSliceSchema,
    ConversationJsonSourceRegion: Canonical.JsonSourceRegionSchema,
    ConversationJsonInverseMapping: Canonical.JsonInverseMappingSchema,
    ConversationDerivedBlockLineageGroup: Canonical.DerivedBlockLineageGroupSchema,
    ConversationDerivedBlockLineage: Canonical.DerivedBlockLineageSchema,

    ConversationAccountingProvenance: Canonical.AccountingProvenanceSchema,
    ConversationAcceptedOutputFragment: Canonical.ConversationAcceptedOutputFragmentSchema,
    ConversationAgentContentBlock: Canonical.AgentContentBlockSchema,
    ConversationAgentTurn: Canonical.AgentTurnSchema,
    ConversationAsset: Canonical.AssetSchema,
    ConversationAssetKind: Canonical.AssetKindSchema,
    ConversationAssetMediaMetadata: Canonical.AssetMediaMetadataSchema,
    ConversationAssetProvenance: Canonical.AssetProvenanceSchema,
    ConversationAssetStorage: Canonical.AssetStorageSchema,
    ConversationAssetVersionBinding: Canonical.AssetVersionBindingSchema,
    ConversationAudioBlock: Canonical.AudioBlockSchema,
    ConversationAuthority: Canonical.AuthoritySchema,
    ConversationBase64: Canonical.Base64Schema,
    ConversationCacheIntent: Canonical.CacheIntentSchema,
    ConversationCompactionRecord: Canonical.CompactionRecordSchema,
    ConversationCompactionSource: Canonical.CompactionSourceSchema,
    ConversationCompactionStrategy: Canonical.CompactionStrategySchema,
    ConversationCompleteInputPartition: Canonical.CompleteInputPartitionSchema,
    ConversationContentHash: Canonical.ContentHashSchema,
    ConversationContext: Canonical.ConversationContextSchema,
    ConversationAcceptedToolSelection: Canonical.AcceptedToolSelectionSchema,
    ConversationEditAnchor: Canonical.ConversationEditAnchorSchema,
    ConversationEditOperation: Canonical.ConversationEditOperationSchema,
    ConversationEditPlacement: Canonical.ConversationEditPlacementSchema,
    ConversationEditRecordRef: Canonical.ConversationEditRecordRefSchema,
    ConversationDeleteOperation: Canonical.ConversationDeleteOperationSchema,
    ConversationIndexedUpgradeOperation: Canonical.IndexedConversationUpgradeOperationSchema,
    ConversationDeletedTurn: Canonical.ConversationDeletedTurnSchema,
    ConversationDeletedTurnRef: Canonical.ConversationDeletedTurnRefSchema,
    ConversationContextChangeOperation: Canonical.ContextChangeOperationSchema,
    ConversationContextChangeProposal: Canonical.ContextChangeProposalSchema,
    ConversationSelectedContextBlocks: Canonical.SelectedContextBlocksSchema,
    ConversationContextChangePlacement: Canonical.ContextChangePlacementSchema,
    ConversationContextEntry: Canonical.ContextEntrySchema,
    ConversationContextMeasurement: Canonical.ContextMeasurementSchema,
    ConversationContextMetadataPredicate: Canonical.ContextMetadataPredicateSchema,
    ConversationContextSelectionActorKind: Canonical.ContextSelectionActorKindSchema,
    ConversationContextSelectionAnchor: Canonical.ContextSelectionAnchorSchema,
    ConversationContextSelectionBlockType: Canonical.ContextSelectionBlockTypeSchema,
    ConversationContextSelectionRange: Canonical.ContextSelectionRangeSchema,
    ConversationContextSelectionRequest: Canonical.ContextSelectionRequestSchema,
    ConversationContextSelector: Canonical.ContextSelectorSchema,
    ConversationContextRetrievalRequirement: Canonical.ContextRetrievalRequirementSchema,
    ConversationDerivedAgentTurn: Canonical.DerivedAgentTurnSchema,
    ConversationDerivedAssetProvenance: Canonical.DerivedAssetProvenanceSchema,
    ConversationDerivedTurnProvenance: Canonical.DerivedTurnProvenanceSchema,
    ConversationDocumentBlock: Canonical.DocumentBlockSchema,
    ConversationDocumentV0: Canonical.ConversationDocumentSchema,
    ConversationExecutedGeneration: Canonical.ExecutedGenerationSchema,
    ConversationToolRetrievalByteProjection: Canonical.ToolRetrievalByteProjectionSchema,
    ConversationToolRetrievalLineProjection: Canonical.ToolRetrievalLineProjectionSchema,
    ConversationToolRetrievalProjection: Canonical.ToolRetrievalProjectionSchema,
    ConversationToolRetrievalExcerpt: Canonical.ToolRetrievalExcerptSchema,
    ConversationToolExecutionMetadata: Canonical.ToolExecutionMetadataSchema,
    ConversationExecutionReceipt: Canonical.ExecutionReceiptSchema,
    ConversationExtensionBlock: Canonical.ExtensionBlockSchema,
    ConversationExternalAssetStorage: Canonical.ExternalAssetStorageSchema,
    ConversationExternalizedToolArguments: Canonical.ExternalizedToolArgumentsSchema,
    ConversationExternalReferenceBlock: Canonical.ExternalReferenceBlockSchema,
    ConversationGeneratedAgentTurn: Canonical.GeneratedAgentTurnSchema,
    ConversationGeneratedAssetProvenance: Canonical.GeneratedAssetProvenanceSchema,
    ConversationGeneratedTurnProvenance: Canonical.GeneratedTurnProvenanceSchema,
    ConversationGeneration: Canonical.GenerationSchema,
    ConversationGenerationCost: Canonical.GenerationCostSchema,
    ConversationGenerationStatus: Canonical.GenerationStatusSchema,
    ConversationGenerationTimestamps: Canonical.GenerationTimestampsSchema,
    ConversationGenerationUsage: Canonical.GenerationUsageSchema,
    ConversationIdentifier: Canonical.IdentifierSchema,
    ConversationImageBlock: Canonical.ImageBlockSchema,
    ConversationImageRegion: Canonical.ImageRegionSchema,
    ConversationImportedAgentTurn: Canonical.ImportedAgentTurnSchema,
    ConversationImportedAssetProvenance: Canonical.ImportedAssetProvenanceSchema,
    ConversationInvalidatedReplayArchive: Canonical.InvalidatedReplayArchiveSchema,
    ConversationImportedGeneration: Canonical.ImportedGenerationSchema,
    ConversationImportedTurnProvenance: Canonical.ImportedTurnProvenanceSchema,
    ConversationInlineBase64AssetStorage: Canonical.InlineBase64AssetStorageSchema,
    ConversationInlineJsonAssetStorage: Canonical.InlineJsonAssetStorageSchema,
    ConversationInlineTextAssetStorage: Canonical.InlineTextAssetStorageSchema,
    ConversationInsertedTurnProvenance: Canonical.InsertedTurnProvenanceSchema,
    ConversationInvalidToolArguments: Canonical.InvalidToolArgumentsSchema,
    ConversationJsonBlock: Canonical.JsonBlockSchema,
    ConversationJsonPath: Canonical.JsonPathSchema,
    ConversationJsonPathSegment: Canonical.JsonPathSegmentSchema,
    ConversationJsonObject: Canonical.JsonObjectSchema,
    ConversationJsonValue: Canonical.JsonValueSchema,
    ConversationLineage: Canonical.ConversationLineageSchema,
    ConversationLineageParent: Canonical.ConversationLineageParentSchema,
    ConversationMetadata: Canonical.MetadataSchema,
    ConversationMaterializedInput: Canonical.ConversationMaterializedInputSchema,
    ConversationModelSwitchBlocker: Canonical.ConversationModelSwitchBlockerSchema,
    ConversationModelSwitchBudgetAnalysis: Canonical.ConversationModelSwitchBudgetAnalysisSchema,
    ConversationModelSwitchPlan: Canonical.ConversationModelSwitchPlanSchema,
    ConversationModelTarget: Canonical.ModelTargetSchema,
    ConversationModelVisibility: Canonical.ModelVisibilitySchema,
    ConversationNativeIdentity: Canonical.NativeIdentitySchema,
    ConversationNativeItemMapping: Canonical.NativeItemMappingSchema,
    ConversationNativeReplayBlock: Canonical.NativeReplayBlockSchema,
    ConversationNestedToolResultContentBlock: Canonical.NestedToolResultContentBlockSchema,
    ConversationNongeneratedAgentTurn: Canonical.NongeneratedAgentTurnSchema,
    ConversationNonGeneratedTurnProvenance: Canonical.NonGeneratedTurnProvenanceSchema,
    ConversationNonnegativeSafeInteger: Canonical.NonnegativeSafeIntegerSchema,
    ConversationOperationReceipt: Canonical.OperationReceiptSchema,
    ConversationOutputAsset: Canonical.ConversationOutputAssetSchema,
    ConversationOutputBlock: Canonical.ConversationOutputBlockSchema,
    ConversationOutputCompleteness: Canonical.ConversationOutputCompletenessSchema,
    ConversationOutputGeneration: Canonical.ConversationOutputGenerationSchema,
    ConversationOutputGenerationUsage: Canonical.ConversationOutputGenerationUsageSchema,
    ConversationOutputReceipt: Canonical.ConversationOutputReceiptSchema,
    ConversationOutputToolCallBlock: Canonical.ConversationOutputToolCallBlockSchema,
    ConversationOutputTurn: Canonical.ConversationOutputTurnSchema,
    ConversationPageRange: Canonical.PageRangeSchema,
    ConversationPositiveSafeInteger: Canonical.PositiveSafeIntegerSchema,
    ConversationProcessingAttemptReceipt: Canonical.ProcessingAttemptReceiptSchema,
    ConversationProcessingBudget: Canonical.ProcessingBudgetSchema,
    ConversationProcessingCompletionReceipt: Canonical.ProcessingCompletionReceiptSchema,
    ConversationProcessingJob: Canonical.ProcessingJobSchema,
    ConversationProcessingJobSelection: Canonical.ProcessingJobSelectionSchema,
    ConversationProcessingOperation: Canonical.ProcessingOperationSchema,
    ConversationProcessingQueueCommand: Canonical.ProcessingQueueCommandSchema,
    ConversationProcessingPolicyCommand: Canonical.ProcessingPolicyCommandSchema,
    ConversationInitialProcessingPolicy: Canonical.InitialProcessingPolicySchema,
    ConversationProcessingPolicyGenesis: Canonical.ProcessingPolicyGenesisSchema,
    ConversationProcessingQueueAcceptanceInput: Canonical.ProcessingQueueAcceptanceInputSchema,
    ConversationProcessingOutputReceipt: Canonical.ProcessingOutputReceiptSchema,
    ConversationProcessingReadinessCoverage: Canonical.ProcessingReadinessCoverageSchema,
    ConversationProcessingResolvedInput: Canonical.ProcessingResolvedInputSchema,
    ConversationProcessingState: Canonical.ProcessingStateSchema,
    ConversationProcessingSupersessionReceipt: Canonical.ProcessingSupersessionReceiptSchema,
    ConversationProcessorConfiguration: Canonical.ProcessorConfigurationSchema,
    ConversationProgramContentBlock: Canonical.ProgramContentBlockSchema,
    ConversationProgramTurn: Canonical.ProgramTurnSchema,
    ConversationProgramTurnPresentation: Canonical.ProgramTurnPresentationSchema,
    ConversationReasoningBlock: Canonical.ReasoningBlockSchema,
    ConversationReceivedAssetProvenance: Canonical.ReceivedAssetProvenanceSchema,
    ConversationReceivedTurnProvenance: Canonical.ReceivedTurnProvenanceSchema,
    ConversationRef: Canonical.ConversationRefSchema,
    ConversationReplacementTurnContextEntry: Canonical.ReplacementTurnContextEntrySchema,
    ConversationReplayCompatibilityScope: Canonical.ReplayCompatibilityScopeSchema,
    ConversationReplayDependencies: Canonical.ReplayDependenciesSchema,
    ConversationReportedUsage: Canonical.ReportedUsageSchema,
    ConversationRequestReceipt: Canonical.RequestReceiptSchema,
    ConversationRequestSourceViewReference: Canonical.RequestSourceViewReferenceSchema,
    ConversationRetrievalCapability: Canonical.RetrievalCapabilitySchema,
    ConversationSourceTurnContextEntry: Canonical.SourceTurnContextEntrySchema,
    ConversationStructuredToolArguments: Canonical.StructuredToolArgumentsSchema,
    ConversationTextBlock: Canonical.TextBlockSchema,
    ConversationTextAssetToolArgumentHydration: Canonical.TextAssetToolArgumentHydrationSchema,
    ConversationTimeRange: Canonical.TimeRangeSchema,
    ConversationTimestamp: Canonical.TimestampSchema,
    ConversationToolArguments: Canonical.ToolArgumentsSchema,
    ConversationToolArgumentHydration: Canonical.ToolArgumentHydrationSchema,
    ConversationToolCallBlock: Canonical.ToolCallBlockSchema,
    ConversationToolDefinition: Canonical.ToolDefinitionSchema,
    ConversationToolInputSchema: Canonical.ToolInputSchemaSchema,
    ConversationToolResultBlock: Canonical.ToolResultBlockSchema,
    ConversationToolResultCapability: Canonical.ToolResultCapabilitySchema,
    ConversationToolTurn: Canonical.ToolTurnSchema,
    ConversationTurn: Canonical.ConversationTurnSchema,
    ConversationTurnStatus: Canonical.TurnStatusSchema,
    ConversationTurnTimestamps: Canonical.TurnTimestampsSchema,
    ConversationUsageAccountingProvenance: Canonical.UsageAccountingProvenanceSchema,
    ConversationUserContentBlock: Canonical.UserContentBlockSchema,
    ConversationUserTurn: Canonical.UserTurnSchema,
    ConversationVideoBlock: Canonical.VideoBlockSchema,
    ConversationToolCallSourceRef: Canonical.ToolCallSourceRefSchema,
    ConversationApplicationToolCallBlock: Canonical.ApplicationToolCallBlockSchema,
    ConversationApplicationToolExecutionReceipt: Canonical.ApplicationToolExecutionReceiptSchema,
    ConversationExecutedToolTurn: Canonical.ExecutedToolTurnSchema,
    ConversationToolExecutionRequest: Canonical.ConversationToolExecutionRequestSchema,
    ConversationToolExecutionResult: Canonical.ConversationToolExecutionResultSchema,
    ConversationTranscriptJsonToolArguments: Canonical.ConversationTranscriptJsonToolArgumentsSchema,
    ConversationTranscriptInvalidToolArguments: Canonical.ConversationTranscriptInvalidToolArgumentsSchema,
    ConversationTranscriptToolArguments: Canonical.ConversationTranscriptToolArgumentsSchema,
    ConversationTranscriptToolCallBlock: Canonical.ConversationTranscriptToolCallBlockSchema,
    ConversationTranscriptExternalReferenceBlock: Canonical.ConversationTranscriptExternalReferenceBlockSchema,
    ConversationTranscriptRenderableBlock: Canonical.ConversationTranscriptRenderableBlockSchema,
    ConversationTranscriptToolResultBlock: Canonical.ConversationTranscriptToolResultBlockSchema,
    ConversationTranscriptUserBlock: Canonical.ConversationTranscriptUserBlockSchema,
    ConversationTranscriptAgentBlock: Canonical.ConversationTranscriptAgentBlockSchema,
    ConversationTranscriptProgramBlock: Canonical.ConversationTranscriptProgramBlockSchema,
    ConversationTranscriptUserTurn: Canonical.ConversationTranscriptUserTurnSchema,
    ConversationTranscriptAgentTurn: Canonical.ConversationTranscriptAgentTurnSchema,
    ConversationTranscriptToolTurn: Canonical.ConversationTranscriptToolTurnSchema,
    ConversationTranscriptProgramTurn: Canonical.ConversationTranscriptProgramTurnSchema,
    ConversationTranscriptTurn: Canonical.ConversationTranscriptTurnSchema,
    ConversationTranscriptAsset: Canonical.ConversationTranscriptAssetSchema,
    ConversationTranscriptExecutedGeneration: Canonical.ConversationTranscriptExecutedGenerationSchema,
    ConversationTranscriptImportedGeneration: Canonical.ConversationTranscriptImportedGenerationSchema,
    ConversationTranscriptGeneration: Canonical.ConversationTranscriptGenerationSchema,
    ConversationTranscriptGenerationMap: Canonical.ConversationTranscriptGenerationMapSchema,
    ConversationTranscriptTurnOmissionReason: Canonical.ConversationTranscriptTurnOmissionReasonSchema,
    ConversationTranscriptTurnOmission: Canonical.ConversationTranscriptTurnOmissionSchema,
    ConversationTranscriptBlockOmissionReason: Canonical.ConversationTranscriptBlockOmissionReasonSchema,
    ConversationTranscriptBlockOmission: Canonical.ConversationTranscriptBlockOmissionSchema,
    ConversationTranscriptAssetOmissionReason: Canonical.ConversationTranscriptAssetOmissionReasonSchema,
    ConversationTranscriptAssetOmission: Canonical.ConversationTranscriptAssetOmissionSchema,
    ConversationTranscriptGenerationOmissionReason: Canonical.ConversationTranscriptGenerationOmissionReasonSchema,
    ConversationTranscriptGenerationOmission: Canonical.ConversationTranscriptGenerationOmissionSchema,
    ConversationTranscriptCompleteness: Canonical.ConversationTranscriptCompletenessSchema,
    ConversationTranscriptFragment: Canonical.ConversationTranscriptFragmentSchema,
    ConversationStreamIdentity: Canonical.ConversationStreamIdentitySchema,
    ConversationStreamCursor: Canonical.ConversationStreamCursorSchema,
    ConversationNativeStreamPathSegment: Canonical.NativeStreamPathSegmentSchema,
    ConversationNativeStreamPosition: Canonical.NativeStreamPositionSchema,
    ConversationStreamDraftBlock: Canonical.ConversationStreamDraftBlockSchema,
    ConversationStreamFailureDiagnostic: Canonical.ConversationStreamFailureDiagnosticSchema,
    ConversationStreamReconciliation: Canonical.ConversationStreamReconciliationSchema,
    ConversationStreamTransformationProof: Canonical.ConversationStreamTransformationProofSchema,
    ConversationStreamResponseMapping: Canonical.ConversationStreamResponseMappingSchema,
    ConversationStreamDecodeEvidence: Canonical.ConversationStreamDecodeEvidenceSchema,
    ConversationStreamEvent: Canonical.ConversationStreamEventSchema,
} as const;
