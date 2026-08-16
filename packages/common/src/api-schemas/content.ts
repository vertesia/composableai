// Runtime schemas for the content API domain.

import { JSONObjectSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';
import type { CollectionStatus } from '../store/collections.js';
import { ContentObjectStatus } from '../store/store.js';
import { ContentObjectTypeRefSchema } from './app-lifecycle.js';
import { StringArrayMapSchema } from './dashboard.js';
import { ComputedFacetResponseSchema, FacetSpecSchema, SortOptionSchema } from './interaction.js';
import { nullableStringSchema } from './schema-primitives.js';
import { ColumnLayoutSchema, ContentObjectTypeSchema, EmbeddingTypeEnabledMapSchema } from './store.js';

export const scoreAggregationTypesSchema = z.enum(['rrf', 'rsf', 'smart']).meta({ id: 'scoreAggregationTypes' });

export const dynamicScalingTypesSchema = z.enum(['off', 'on']).meta({ id: 'dynamicScalingTypes' });

export const ContentObjectProcessingPrioritySchema = z
    .enum(['normal', 'low'])
    .meta({ id: 'ContentObjectProcessingPriority' });

export const CostExportCsvResponseSchema = z.string().meta({ id: 'CostExportCsvResponse' });

export const GenerationRunMetadataSchema = z
    .strictObject({
        id: z.string(),
        date: z.string(),
        model: z.string(),
        target: z.string().optional(),
        extraction_fingerprint: z
            .string()
            .meta({
                description:
                    'Fingerprint of the inputs used by property extraction (content etag, type + its object schema, source, instructions, interaction). Lets a later run skip re-extraction when nothing changed.',
            })
            .optional(),
    })
    .meta({ id: 'GenerationRunMetadata' });

export const ContentObjectUserPermissionsSchema = z
    .strictObject({
        can_write: z.boolean(),
        can_delete: z.boolean(),
    })
    .meta({
        id: 'ContentObjectUserPermissions',
        description:
            "Computed per-request permissions for the current user on a content object. Not stored in the database — computed on the fly by the API from the object's security field.",
    });

export const RevisionInfoSchema = z
    .strictObject({
        parent: z.string().meta({ description: 'Direct parent revision id (omit on the first revision)' }).optional(),
        root: z.string().meta({ description: 'The root revision id (omit on the first revision)' }),
        head: z.boolean().meta({ description: 'True if this revision is the head revision' }),
        label: z.string().meta({ description: 'Human‑friendly tag or state ("v1.2", "approved")' }).optional(),
    })
    .meta({ id: 'RevisionInfo' });

export const ContentSourceSchema = z
    .strictObject({
        source: z.string().optional(),
        type: z.string().optional(),
        name: z.string().optional(),
        etag: z.string().optional(),
    })
    .meta({ id: 'ContentSource' });

export const ContentObjectStatusSchema = z.enum(ContentObjectStatus).meta({ id: 'ContentObjectStatus' });

export const InheritedPropertyMetadataSchema = z
    .strictObject({
        name: z.string().meta({ description: 'The property name that was inherited' }),
        collection: z.string().meta({ description: 'The collection ID that provided this property' }),
    })
    .meta({ id: 'InheritedPropertyMetadata', description: 'Metadata about a single inherited property.' });

export const TranscriptSegmentSchema = z
    .strictObject({
        start: z.number(),
        text: z.string(),
        speaker: z.number().optional(),
        end: z.number().optional(),
        confidence: z.number().optional(),
        language: z.string().optional(),
    })
    .meta({ id: 'TranscriptSegment' });

export const EmbeddingSchema = z
    .strictObject({
        model: z.string(),
        values: z.array(z.number()),
        etag: z.string().optional(),
    })
    .meta({ id: 'Embedding' });

export const CollectionSecuritySettingsResponseSchema = z
    .strictObject({
        id: z.string(),
        security: StringArrayMapSchema,
    })
    .meta({ id: 'CollectionSecuritySettingsResponse' });

export const CollectionMembersUpdateResultSchema = z
    .strictObject({
        id: z.string(),
    })
    .meta({ id: 'CollectionMembersUpdateResult' });

export const CollectionMembersUpdatePayloadSchema = z
    .strictObject({
        action: z.enum(['add', 'delete']),
        members: z.array(z.string()),
    })
    .meta({ id: 'CollectionMembersUpdatePayload' });

export const CollectionChildrenUpdateResultSchema = z
    .strictObject({
        count: z.number(),
    })
    .meta({ id: 'CollectionChildrenUpdateResult' });

export const CollectionChildrenUpdatePayloadSchema = z
    .strictObject({
        action: z.enum(['add', 'delete']),
        children: z.array(z.string()),
    })
    .meta({ id: 'CollectionChildrenUpdatePayload' });

export const StartContentObjectExportResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        export_id: z.string(),
    })
    .meta({ id: 'StartContentObjectExportResponse' });

export const ExportContentObjectsIncludeOptionsSchema = z
    .strictObject({
        embeddings: z
            .boolean()
            .meta({ description: 'Include stored embeddings. Disabled by default for generic object exports.' })
            .optional(),
        content: z.boolean().meta({ description: 'Include content source metadata. Enabled by default.' }).optional(),
        status: z.boolean().meta({ description: 'Include object lifecycle status. Enabled by default.' }).optional(),
        properties: z.boolean().meta({ description: 'Include object properties. Enabled by default.' }).optional(),
        metadata: z
            .boolean()
            .meta({
                description: 'Include technical object metadata. Disabled by default because metadata may be large.',
            })
            .optional(),
        revision: z.boolean().meta({ description: 'Include object revision details. Enabled by default.' }).optional(),
    })
    .meta({
        id: 'ExportContentObjectsIncludeOptions',
        description: 'Optional object context to include in content object export rows.',
    });

export const ExportContentObjectsFilterSchema = z
    .strictObject({
        types: z.array(z.string()).optional(),
        created_from: z.string().optional(),
        created_to: z.string().optional(),
        updated_from: z.string().optional(),
        updated_to: z.string().optional(),
    })
    .meta({
        id: 'ExportContentObjectsFilter',
        description: 'Bounded filters supported by the bulk content object export API.',
    });

export const SupportedEmbeddingTypesSchema = z
    .enum(['text', 'image', 'properties'])
    .meta({ id: 'SupportedEmbeddingTypes' });

export const SetObjectEmbeddingsResponseSchema = z
    .strictObject({
        type: EmbeddingSchema.optional(),
    })
    .meta({ id: 'SetObjectEmbeddingsResponse' });

export const ContentObjectApiRevisionSchema = z
    .strictObject({
        parent: z.string().optional(),
        root: z.string(),
        head: z.boolean(),
        label: z.string().optional(),
    })
    .meta({ id: 'ContentObjectApiRevision' });

export const Record_SearchTypes_numberSchema = z
    .object({})
    .catchall(z.number())
    .meta({ id: 'Record_SearchTypes_number' });

export const EmbeddingSearchConfigSchema = EmbeddingTypeEnabledMapSchema.meta({ id: 'EmbeddingSearchConfig' });

export const CollectionStatusSchema = z
    .enum(['active', 'archived'])
    .meta({ id: 'CollectionStatus' }) as z.ZodType<CollectionStatus>;

export const CollectionPropagationResponseSchema = z
    .strictObject({
        id: z.string(),
        message: z.string(),
        security: StringArrayMapSchema.optional(),
        shared_properties: z.array(z.string()).optional(),
    })
    .meta({ id: 'CollectionPropagationResponse' });

export const ContentObjectTypeArraySchema = z.array(ContentObjectTypeSchema).meta({ id: 'ContentObjectTypeArray' });

export const ContentObjectExportArtifactFileSchema = z
    .strictObject({
        role: z.enum(['data', 'manifest']),
        path: z.string(),
        filename: z.string(),
        content_type: z.string(),
        bytes: z.number(),
    })
    .meta({ id: 'ContentObjectExportArtifactFile' });

export const ContentObjectTextResponseSchema = z
    .strictObject({
        text: z.string().optional(),
    })
    .meta({ id: 'ContentObjectTextResponse' });

export const GetRenditionResponseSchema = z
    .strictObject({
        status: z.enum(['found', 'generating', 'failed']),
        renditions: z.array(z.string()).optional(),
        workflow_run_id: z.string().optional(),
    })
    .meta({ id: 'GetRenditionResponse' });

export const ContentObjectExportResultSchema = z
    .strictObject({
        status: z.literal('completed'),
        path: z.string(),
        filename: z.string(),
        content_type: z.string(),
        manifest_path: z.string().optional(),
        manifest_filename: z.string().optional(),
        manifest_content_type: z.string().optional(),
        manifest_bytes: z.number().optional(),
        records: z.number(),
        bytes: z.number(),
        started_at: z.string(),
        completed_at: z.string(),
        duration_ms: z.number(),
    })
    .meta({ id: 'ContentObjectExportResult' });

export const ContentObjectExportProgressSchema = z
    .strictObject({
        status: z.enum(['queued', 'planning', 'exporting', 'composing', 'completed', 'failed']),
        records: z.number(),
        bytes: z.number(),
        path: z.string().optional(),
        filename: z.string().optional(),
        completed_shards: z.number().optional(),
        total_shards: z.number().optional(),
        started_at: z.string().optional(),
        completed_at: z.string().optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'ContentObjectExportProgress' });

export const ExportPropertiesResponseSchema = z
    .strictObject({
        type: z.string(),
        name: z.string(),
        data: z.string(),
    })
    .meta({ id: 'ExportPropertiesResponse' });

export const DeleteContentObjectResultSchema = z
    .strictObject({
        id: z.string(),
        count: z.number(),
    })
    .meta({ id: 'DeleteContentObjectResult' });

export const DeleteContentObjectExportResponseSchema = z
    .strictObject({
        success: z.boolean(),
        export_id: z.string(),
        path: z.string(),
    })
    .meta({ id: 'DeleteContentObjectExportResponse' });

export const EmbeddingMapSchema = z.object({}).catchall(EmbeddingSchema).meta({ id: 'EmbeddingMap' });

/**
 * Everything a collection write accepts beyond its identity. Shared so the update payload below is
 * the create payload with `name` and `dynamic` relaxed, and cannot drift from it.
 *
 * Spread rather than `.partial()`: Zod clones a schema's registry metadata, so a derived component
 * keeps emitting under the base's `id` and collides with it in the published document.
 */
const collectionPayloadFields = {
    description: z.string().meta({ description: 'Description of the collection and its purpose' }).optional(),
    skip_head_sync: z
        .boolean()
        .meta({
            description: 'When true the collection does not track and sync member HEAD revisions. Defaults to false.',
        })
        .optional(),
    tags: z.array(z.string()).meta({ description: 'Categorization tags for the collection' }).optional(),
    type: nullableStringSchema
        .meta({ description: 'Default content type ID for documents in the collection' })
        .optional(),
    query: z
        .looseObject({})
        .meta({ description: 'MongoDB query that determines membership of a dynamic collection' })
        .optional(),
    properties: z.looseObject({}).meta({ description: 'Metadata properties attached to the collection' }).optional(),
    parent: nullableStringSchema.meta({ description: 'Parent collection ID when the collection is nested' }).optional(),
    table_layout: z
        .array(ColumnLayoutSchema)
        .nullable()
        .meta({
            anyOf: undefined,
            type: ['array', 'null'],
            items: { $ref: 'ColumnLayout' },
            description: 'Column layout used when listing collection members',
        })
        .optional(),
    allowed_types: z
        .array(z.string())
        .meta({ description: 'Content type IDs allowed to be added to the collection' })
        .optional(),
    updated_by: z.string().meta({ description: 'Identity recorded as the updater of the collection' }).optional(),
    shared_properties: z
        .array(z.string())
        .meta({ description: 'Names of collection properties whose values are propagated to member documents' })
        .optional(),
    sensitivity: z.number().meta({ description: 'BLP sensitivity level for member documents' }).optional(),
    compartments: z.array(z.string()).meta({ description: 'Compartments for member documents' }).optional(),
};

export const CreateCollectionPayloadSchema = z
    .strictObject({
        ...collectionPayloadFields,
        name: z.string().meta({ description: 'Name of the collection' }),
        dynamic: z.boolean().meta({
            description: 'When true, membership is determined by `query`; when false, members are added explicitly',
        }),
    })
    .meta({ id: 'CreateCollectionPayload' });

/**
 * `PUT /collections/:id` applies whatever fields the body carries. It is not the create payload:
 * naming that one demanded `name` and `dynamic` on every edit, so changing a single property — which
 * is what the UI and the ABAC tests do — was rejected.
 */
export const UpdateCollectionPayloadSchema = z
    .strictObject({
        ...collectionPayloadFields,
        name: z.string().meta({ description: 'Name of the collection' }).optional(),
        dynamic: z
            .boolean()
            .meta({
                description: 'When true, membership is determined by `query`; when false, members are added explicitly',
            })
            .optional(),
    })
    .meta({ id: 'UpdateCollectionPayload', description: 'Fields to change on a collection. All optional.' });

export const FindPayloadSchema = z
    .strictObject({
        query: z.looseObject({}),
        offset: z.number().optional(),
        limit: z.number().optional(),
        select: z.string().optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
    })
    .meta({ id: 'FindPayload' });

export const TranscriptSchema = z
    .strictObject({
        text: z.string().optional(),
        segments: z.array(TranscriptSegmentSchema).optional(),
        etag: z.string().optional(),
    })
    .meta({ id: 'Transcript' });

export const ContentEmbeddingMapSchema = z
    .strictObject({
        text: EmbeddingSchema.optional(),
        image: EmbeddingSchema.optional(),
        properties: EmbeddingSchema.optional(),
    })
    .meta({ id: 'ContentEmbeddingMap' });

export const StartContentObjectExportRequestSchema = z
    .strictObject({
        embedding_types: z
            .array(SupportedEmbeddingTypesSchema)
            .meta({
                description:
                    'Embedding types to export when include.embeddings is true. Defaults to all supported embedding types.',
            })
            .optional(),
        filter: ExportContentObjectsFilterSchema.meta({
            description:
                "Explicit export filters. This intentionally does not accept the search API's full Mongo/search DSL.",
        }).optional(),
        all_revisions: z
            .boolean()
            .meta({ description: 'Include all revisions. Defaults to false, exporting only head revisions.' })
            .optional(),
        include: ExportContentObjectsIncludeOptionsSchema.meta({
            description: 'Optional object context selectors.',
        }).optional(),
        compression: z.boolean().meta({ description: 'Compress the export with gzip. Defaults to true.' }).optional(),
    })
    .meta({ id: 'StartContentObjectExportRequest' });

export const VectorSearchQuerySchema = z
    .strictObject({
        objectId: z.string().optional(),
        values: z.array(z.number()).optional(),
        text: z.string().optional(),
        image: z.string().optional(),
        config: EmbeddingSearchConfigSchema.optional(),
    })
    .meta({ id: 'VectorSearchQuery' });

export const ComplexCollectionSearchQuerySchema = z
    .strictObject({
        parent: nullableStringSchema.optional(),
        dynamic: z.boolean().optional(),
        status: CollectionStatusSchema.optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
        types: z.array(z.string()).optional(),
        match: z.looseObject({}).optional(),
    })
    .meta({ id: 'ComplexCollectionSearchQuery' });

export const CollectionSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        dynamic: z.boolean().meta({
            description:
                'A flag to indicate if the collection is dynamic or static. If the collection is dynamic, the members are determined by a query using the query field. If the collection is static, the members are explicitly defined using the members array.',
        }),
        status: CollectionStatusSchema,
        type: ContentObjectTypeRefSchema.optional(),
        skip_head_sync: z.boolean().meta({
            description:
                'A flag to indicate whether to track and sync member HEAD revisions. The default is to sync HEAD revisions for collection members (skip_head_sync: false)',
        }),
        parents: z
            .array(z.string())
            .nullable()
            .meta({
                anyOf: undefined,
                type: ['array', 'null'],
                items: { type: 'string' },
                description: 'The parent collections if any. A collection can have multiple parents.',
            })
            .optional(),
        table_layout: z
            .array(ColumnLayoutSchema)
            .meta({
                description:
                    'The table layout to use for the collection. The layout defined in the type could serve as a fallback if not defined here.',
            })
            .optional(),
        allowed_types: z.array(z.string()).meta({ description: 'The allowed types for the collection.' }).optional(),
        properties: z.looseObject({}).optional(),
        query: z.looseObject({}).optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({ description: 'BLP sensitivity level — propagated to member documents (max across collections)' })
            .optional(),
        compartments: z
            .array(z.string())
            .meta({ description: 'Compartments — propagated to member documents (union across collections)' })
            .optional(),
        shared_properties: z
            .array(z.string())
            .meta({
                description:
                    "List of property names from the collection's properties that should be shared with (injected into) member objects. These properties will be propagated to all members of this collection and merged as arrays.",
            })
            .optional(),
    })
    .meta({ id: 'Collection' });

export const ContentObjectExportArtifactSchema = z
    .strictObject({
        export_id: z.string(),
        path: z.string(),
        filename: z.string(),
        content_type: z.string(),
        bytes: z.number(),
        created_at: z.string().optional(),
        files: z.array(ContentObjectExportArtifactFileSchema).optional(),
    })
    .meta({ id: 'ContentObjectExportArtifact' });

export const ContentObjectExportStatusResponseSchema = z
    .strictObject({
        workflow_id: z.string(),
        run_id: z.string(),
        status: z.enum(['queued', 'running', 'completed', 'failed', 'canceled', 'terminated', 'timed_out', 'unknown']),
        done: z.boolean(),
        progress: ContentObjectExportProgressSchema.optional(),
        result: ContentObjectExportResultSchema.optional(),
        error: z.string().optional(),
    })
    .meta({ id: 'ContentObjectExportStatusResponse' });

export const CreateContentObjectPayloadSchema = z
    .strictObject({
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: ContentEmbeddingMapSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: TranscriptSchema.optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({
                description:
                    'BLP sensitivity level — set directly or inherited from collections (max across collections).',
            })
            .optional(),
        compartments: z
            .array(z.string())
            .meta({
                description: 'Compartments — set directly or inherited from collections (union across collections).',
            })
            .optional(),
        inherited_properties: z
            .array(InheritedPropertyMetadataSchema)
            .meta({
                description:
                    'Inherited properties metadata - tracks which properties were inherited from parent collections. Used to display readonly inherited properties in the UI and enable incremental sync optimization.',
            })
            .optional(),
        parent: z.string().optional(),
        location: z.string().meta({ description: 'An optional path based location for the object' }).optional(),
        status: ContentObjectStatusSchema.meta({
            description:
                'Object status.\n- created: the object was created and is being processed\n- processing: the object is being processed\n- completed: the object was processed and is ready to use\n- failed: the object processing failed\n- archived: the object was archived and is no longer available',
        }).optional(),
        content: ContentSourceSchema.meta({
            description: 'Content source information, typically a link to an object store',
        }).optional(),
        external_id: z
            .string()
            .meta({ description: 'External identifier for integration with other systems' })
            .optional(),
        properties: z
            .looseObject({})
            .meta({
                description:
                    'The object properties. This is a JSON object that describes the object, matching the object type schema',
            })
            .optional(),
        metadata: z.looseObject({}).meta({ description: 'Technical metadata of the object' }).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .meta({ description: 'Token information' })
            .optional(),
        revision: RevisionInfoSchema.meta({
            description: 'Revision information. This is used to track the history of the object.',
        }).optional(),
        is_deleted: z
            .boolean()
            .meta({
                description:
                    'Soft delete flag. When true, the object should be considered deleted but is still retained in the database for historical purposes.',
            })
            .optional(),
        is_locked: z
            .boolean()
            .meta({
                description:
                    'Soft lock flag. When true, the object should be considered read-only and modification attempts should be rejected.',
            })
            .optional(),
        score: z.number().meta({ description: 'The document score, used for ranking and sorting.' }).optional(),
        user_permissions: ContentObjectUserPermissionsSchema.meta({
            description: "Computed per-request: the current user's effective permissions on this object.",
        }).optional(),
        name: z.string().meta({ description: 'Human-readable name or title' }).optional(),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }).optional(),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }).optional(),
        id: z.string().optional(),
        type: z.string().optional(),
        generation_run_info: GenerationRunMetadataSchema.optional(),
    })
    .meta({
        id: 'CreateContentObjectPayload',
        description: 'When creating from an uploaded file the content should be an URL to the uploaded file',
    });

export const ComputeCollectionFacetPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema),
        query: ComplexCollectionSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComputeCollectionFacetPayload' });

export const UpdateContentObjectPayloadSchema = z
    .strictObject({
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: ContentEmbeddingMapSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: TranscriptSchema.optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({
                description:
                    'BLP sensitivity level — set directly or inherited from collections (max across collections).',
            })
            .optional(),
        compartments: z
            .array(z.string())
            .meta({
                description: 'Compartments — set directly or inherited from collections (union across collections).',
            })
            .optional(),
        inherited_properties: z
            .array(InheritedPropertyMetadataSchema)
            .meta({
                description:
                    'Inherited properties metadata - tracks which properties were inherited from parent collections. Used to display readonly inherited properties in the UI and enable incremental sync optimization.',
            })
            .optional(),
        parent: z.string().optional(),
        location: z.string().meta({ description: 'An optional path based location for the object' }).optional(),
        status: ContentObjectStatusSchema.meta({
            description:
                'Object status.\n- created: the object was created and is being processed\n- processing: the object is being processed\n- completed: the object was processed and is ready to use\n- failed: the object processing failed\n- archived: the object was archived and is no longer available',
        }).optional(),
        content: ContentSourceSchema.meta({
            description: 'Content source information, typically a link to an object store',
        }).optional(),
        external_id: z
            .string()
            .meta({ description: 'External identifier for integration with other systems' })
            .optional(),
        properties: z
            .looseObject({})
            .meta({
                description:
                    'The object properties. This is a JSON object that describes the object, matching the object type schema',
            })
            .optional(),
        metadata: z.looseObject({}).meta({ description: 'Technical metadata of the object' }).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .meta({ description: 'Token information' })
            .optional(),
        revision: RevisionInfoSchema.meta({
            description: 'Revision information. This is used to track the history of the object.',
        }).optional(),
        is_deleted: z
            .boolean()
            .meta({
                description:
                    'Soft delete flag. When true, the object should be considered deleted but is still retained in the database for historical purposes.',
            })
            .optional(),
        is_locked: z
            .boolean()
            .meta({
                description:
                    'Soft lock flag. When true, the object should be considered read-only and modification attempts should be rejected.',
            })
            .optional(),
        score: z.number().meta({ description: 'The document score, used for ranking and sorting.' }).optional(),
        user_permissions: ContentObjectUserPermissionsSchema.meta({
            description: "Computed per-request: the current user's effective permissions on this object.",
        }).optional(),
        name: z.string().meta({ description: 'Human-readable name or title' }).optional(),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }).optional(),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }).optional(),
        id: z.string().optional(),
        type: z.string().optional(),
        generation_run_info: GenerationRunMetadataSchema.optional(),
    })
    .meta({
        id: 'UpdateContentObjectPayload',
        description: 'When creating from an uploaded file the content should be an URL to the uploaded file',
    });

export const ContentObjectApiTypeRefSchema = ContentObjectTypeRefSchema.meta({ id: 'ContentObjectApiTypeRef' });

export const ComplexSearchQuerySchema = z
    .strictObject({
        name: z.string().optional(),
        status: z.array(z.string()).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        id: z.string().optional(),
        ids: z.array(z.string()).optional(),
        createdFrom: z.string().optional(),
        createdTo: z.string().optional(),
        updatedFrom: z.string().optional(),
        updatedTo: z.string().optional(),
        location: z.string().optional(),
        parent: z.string().optional(),
        type: z.string().optional(),
        types: z.array(z.string()).optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
        vector: VectorSearchQuerySchema.optional(),
        full_text: z
            .string()
            .meta({ description: 'If present, do a full text search (snake_case version).' })
            .optional(),
        weights: Record_SearchTypes_numberSchema.optional(),
        dynamic_scaling: dynamicScalingTypesSchema
            .meta({
                description:
                    "dynamicScaling rescales the weights when a particular search type is not present in the results, per object. e.g. Weights of 5,3,2 will be treated as 0,3,2 if the first search type is not present in the results. Ignored when scoreAggregation is 'smart' Default is 'on'",
            })
            .optional(),
        score_aggregation: scoreAggregationTypesSchema
            .meta({
                description:
                    'rrf: Reciprocal Rank Fusion rsf: Reciprocal Score Fusion smart: Our own algorithm (default and recommended)',
            })
            .optional(),
        match: z.looseObject({}).optional(),
    })
    .meta({
        id: 'ComplexSearchQuery',
        description: 'ComplexSearchQuery is used for full-text search and vector embedding search.',
    });

export const CollectionArraySchema = z.array(CollectionSchema).meta({ id: 'CollectionArray' });

export const ListContentObjectExportsResponseSchema = z
    .strictObject({
        items: z.array(ContentObjectExportArtifactSchema),
        limit: z.number(),
    })
    .meta({ id: 'ListContentObjectExportsResponse' });

export const ExportPropertiesPayloadSchema = z
    .strictObject({
        objectIds: z.array(z.string()),
        type: z.string(),
        query: ComplexSearchQuerySchema.optional(),
        table_layout: z.array(ColumnLayoutSchema).optional(),
    })
    .meta({ id: 'ExportPropertiesPayload' });

export const ContentObjectApiResponseSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        parent: z.string().optional(),
        location: z.string(),
        status: ContentObjectStatusSchema,
        type: ContentObjectApiTypeRefSchema.optional(),
        content: ContentSourceSchema.optional(),
        external_id: z.string().optional(),
        properties: JSONObjectSchema,
        metadata: z.looseObject({}).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .optional(),
        revision: ContentObjectApiRevisionSchema,
        is_deleted: z.boolean().optional(),
        is_locked: z.boolean().optional(),
        score: z.number().optional(),
        user_permissions: ContentObjectUserPermissionsSchema.optional(),
        searchTypeResult: z
            .array(
                z.strictObject({
                    type: z.string(),
                    score: z.number(),
                    rank: z.number(),
                }),
            )
            .optional(),
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: EmbeddingMapSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: z.looseObject({}).optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z
            .number()
            .meta({
                description:
                    'BLP sensitivity level — set directly or inherited from collections (max across collections).',
            })
            .nullable()
            .optional(),
        compartments: z
            .array(z.string())
            .meta({
                description: 'Compartments — set directly or inherited from collections (union across collections).',
            })
            .optional(),
        inherited_properties: z.array(InheritedPropertyMetadataSchema).optional(),
    })
    .meta({ id: 'ContentObjectApiResponse' });

/**
 * Read shape for field-projected objects. Projection intentionally changes requiredness without
 * weakening the full object or any create/update payload.
 */
export const ProjectedContentObjectApiResponseSchema = ContentObjectApiResponseSchema.partial().meta({
    id: 'ProjectedContentObjectApiResponse',
});

export const ProjectedContentObjectApiResponseArraySchema = z
    .array(ProjectedContentObjectApiResponseSchema)
    .meta({ id: 'ProjectedContentObjectApiResponseArray' });

export const ComputeObjectFacetPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema),
        query: ComplexSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComputeObjectFacetPayload' });

export const ContentObjectItemApiResponseSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Unique identifier for the object' }),
        name: z.string().meta({ description: 'Human-readable name or title' }),
        description: z.string().meta({ description: 'Optional detailed description of the object' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Optional array of categorization tags' }).optional(),
        updated_by: z.string().meta({ description: 'Identifier of the user who last modified the object' }),
        created_by: z.string().meta({ description: 'Identifier of the user who created the object' }),
        created_at: z.string().meta({ description: 'ISO timestamp of when the object was created' }),
        updated_at: z.string().meta({ description: 'ISO timestamp of when the object was last updated' }),
        parent: z.string().optional(),
        location: z.string(),
        status: ContentObjectStatusSchema,
        type: ContentObjectApiTypeRefSchema.optional(),
        content: ContentSourceSchema.optional(),
        external_id: z.string().optional(),
        properties: JSONObjectSchema,
        metadata: z.looseObject({}).optional(),
        tokens: z
            .strictObject({
                count: z.number().optional(),
                encoding: z.string().optional(),
                etag: z.string().optional(),
            })
            .optional(),
        revision: ContentObjectApiRevisionSchema,
        is_deleted: z.boolean().optional(),
        is_locked: z.boolean().optional(),
        score: z.number().optional(),
        user_permissions: ContentObjectUserPermissionsSchema.optional(),
        searchTypeResult: z
            .array(
                z.strictObject({
                    type: z.string(),
                    score: z.number(),
                    rank: z.number(),
                }),
            )
            .optional(),
        text: z.string().optional(),
        text_etag: z.string().optional(),
        embeddings: EmbeddingMapSchema.optional(),
        parts: z.array(z.string()).optional(),
        parts_etag: z.string().optional(),
        transcript: z.looseObject({}).optional(),
        security: StringArrayMapSchema.optional(),
        sensitivity: z.number().nullable().optional(),
        compartments: z.array(z.string()).optional(),
        inherited_properties: z.array(InheritedPropertyMetadataSchema).optional(),
    })
    .meta({ id: 'ContentObjectItemApiResponse' });

export const ComplexSearchPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema).optional(),
        limit_facets: z
            .boolean()
            .meta({
                description:
                    'If the facets should be limited to the current page of results. Defaults to false. When false, the facets are independent of the search results page.',
            })
            .optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        select: z.string().optional(),
        all_revisions: z.boolean().optional(),
        from_root: z.string().optional(),
        sort: z
            .array(SortOptionSchema)
            .meta({
                description: 'Sort criteria. Multiple entries enable multi-field sorting (first entry is primary).',
            })
            .optional(),
        aggs: z
            .looseObject({})
            .meta({
                description:
                    'Arbitrary Elasticsearch aggregation definitions. Ignored when search falls back to MongoDB.',
            })
            .optional(),
        query: ComplexSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComplexSearchPayload' });

export const ContentObjectItemApiResponseArraySchema = z
    .array(ContentObjectItemApiResponseSchema)
    .meta({ id: 'ContentObjectItemApiResponseArray' });

export const ObjectSearchResponseSchema = z
    .strictObject({
        results: z.array(ProjectedContentObjectApiResponseSchema),
        facets: ComputedFacetResponseSchema,
        aggregations: z.looseObject({}).optional(),
    })
    .meta({ id: 'ObjectSearchResponse' });

export const CreateContentObjectHeadersSchema = z
    .object({
        'x-collection-id': z.string().optional(),
        'x-processing-priority': ContentObjectProcessingPrioritySchema.optional(),
    })
    .meta({ id: 'CreateContentObjectHeaders' });

export const CreateContentObjectQuerySchema = z
    .object({
        collection_id: z.string().optional(),
        processing_priority: ContentObjectProcessingPrioritySchema.optional(),
    })
    .meta({ id: 'CreateContentObjectQuery' });

export const GetObjectRenditionQuerySchema = z
    .object({
        block_on_generation: z.boolean().optional(),
        generate_if_missing: z.boolean().optional(),
        max_hw: z.number().optional(),
        sign_url: z.boolean().optional(),
    })
    .meta({ id: 'GetObjectRenditionQuery' });

export const CollectionMembersQuerySchema = z
    .object({
        status: z.string().optional(),
        type: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
    })
    .meta({ id: 'CollectionMembersQuery' });

export const UpdateContentObjectHeadersSchema = z
    .object({
        'if-match': z.string().optional(),
        'x-create-revision': z.boolean().optional(),
        'x-revision-label': z.string().optional(),
        'x-processing-priority': ContentObjectProcessingPrioritySchema.optional(),
        'x-suppress-workflows': z
            .boolean()
            .meta({
                description:
                    'Deprecated: Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire.',
                deprecated: true,
                'x-deprecated-message':
                    'Events are now always emitted. This suppresses the Temporal-backed delivery targets (workflow, agent, and process) — webhook deliveries still fire.',
            })
            .optional(),
    })
    .meta({ id: 'UpdateContentObjectHeaders' });

export const UpdateContentObjectQuerySchema = z
    .object({
        create_revision: z.boolean().optional(),
        revision_label: z.string().optional(),
        processing_priority: ContentObjectProcessingPrioritySchema.optional(),
    })
    .meta({ id: 'UpdateContentObjectQuery' });

export const ContentObjectApiResponseArraySchema = z
    .array(ContentObjectApiResponseSchema)
    .meta({ id: 'ContentObjectApiResponseArray' });
