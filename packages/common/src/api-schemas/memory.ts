import { z } from 'zod';

/**
 * Memory Brain administration contracts.
 *
 * A Brain namespace is identified by the `properties.brain_id` field carried by every record a
 * Brain produces, not by a content-type name. Type names appear here only as optional overrides so
 * a project whose memory ontology is named differently can still be administered, and so the
 * deletion summary can bucket the purged records.
 */

export const DeleteMemoryBrainQuerySchema = z
    .strictObject({
        purge_records: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Also delete every record in the Brain namespace, that is every content object in the ' +
                    'project whose `properties.brain_id` equals the Brain id. Defaults to false, which ' +
                    'deletes only the Brain definition and leaves its records in place.',
            }),
        brain_type: z
            .string()
            .optional()
            .meta({
                description:
                    'Content type name or id of the Brain definition, used to tell the Brain object apart ' +
                    'from the records that carry the same `brain_id`. Defaults to the platform Brain type name.',
            }),
        relationship_type: z
            .string()
            .optional()
            .meta({
                description:
                    'Content type name or id counted as `relationships` in the deletion summary. Purely a ' +
                    'reporting hint: records of an unresolved type are still purged and counted as `other`.',
            }),
        memory_entry_type: z
            .string()
            .optional()
            .meta({
                description:
                    'Content type name or id counted as `memory_entries` in the deletion summary. Purely a ' +
                    'reporting hint: records of an unresolved type are still purged and counted as `other`.',
            }),
    })
    .meta({
        id: 'DeleteMemoryBrainQuery',
        description: 'Options controlling how far a Memory Brain deletion cascades.',
    });

export const MemoryBrainRecordDeletionCountsSchema = z
    .strictObject({
        relationships: z.number().int().meta({ description: 'Deleted records of the relationship type.' }),
        memory_entries: z.number().int().meta({ description: 'Deleted records of the memory entry type.' }),
        other: z
            .number()
            .int()
            .meta({
                description:
                    'Deleted records that carried the Brain id but matched neither reporting type. Purging is ' +
                    'driven by `properties.brain_id`, so records of any other type in the namespace land here.',
            }),
    })
    .meta({
        id: 'MemoryBrainRecordDeletionCounts',
        description: 'Per-bucket counts of the logical records deleted from a Brain namespace.',
    });

export const MemoryBrainDeletionErrorSchema = z
    .strictObject({
        object_id: z.string().optional().meta({ description: 'Content object that could not be deleted.' }),
        message: z.string().meta({ description: 'Why the deletion did not happen.' }),
    })
    .meta({
        id: 'MemoryBrainDeletionError',
        description: 'One partial failure encountered while deleting a Memory Brain namespace.',
    });

export const DeleteMemoryBrainResponseSchema = z
    .strictObject({
        brain_id: z.string().meta({ description: 'The Brain namespace that was targeted.' }),
        brain_object_id: z.string().meta({ description: 'Content object id of the Brain definition.' }),
        brain_deleted: z.boolean().meta({ description: 'Whether the Brain definition itself was deleted.' }),
        records_deleted: MemoryBrainRecordDeletionCountsSchema,
        errors: z.array(MemoryBrainDeletionErrorSchema).meta({
            description: 'Partial failures. An empty array means the whole namespace was removed as requested.',
        }),
    })
    .meta({
        id: 'DeleteMemoryBrainResponse',
        description: 'Summary of a Memory Brain deletion, including any partially failed cascade.',
    });
