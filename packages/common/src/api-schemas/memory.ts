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

/* -------------------------------------------------------------------------------------------------
 * Canonical Memory store (specification.md §5, §7, §11.1, §14).
 *
 * Everything below describes the Mongo-backed Memory graph, not the provisional Phase-0 content
 * objects the deletion contract above administers. Node, Statement and Evidence identifiers are
 * opaque: they encode Brain and Generation context so a single-resource route resolves without a
 * second lookup, and they are never Mongo ids on the wire.
 * ---------------------------------------------------------------------------------------------- */

const MemoryBrainStatusSchema = z.enum(['draft', 'building', 'active', 'paused', 'degraded', 'archived']);

const MemoryGenerationStatusSchema = z.enum(['building', 'ready', 'active', 'superseded', 'abandoned', 'failed']);

const MemoryRunModeSchema = z.enum(['discover', 'maintain', 'rebuild']);

const MemoryRunStatusSchema = z.enum(['pending', 'running', 'committed', 'refused', 'failed', 'cancelled']);

const MemoryNodeKindSchema = z.enum(['entity', 'event', 'concept', 'procedure']);

const MemoryNodeStatusSchema = z.enum(['active', 'redirected', 'retracted']);

const MemorySupportBasisSchema = z.enum(['explicit', 'strong_inference', 'tentative']);

export const MemoryContentSourceSelectorSchema = z
    .strictObject({
        kind: z.literal('content'),
        id: z.string().meta({ description: 'Selector id, unique within the Brain. Names the source lane.' }),
        collection_ids: z.array(z.string()).optional(),
        include_collection_descendants: z.boolean().optional(),
        type_ids: z.array(z.string()).optional(),
        locations: z.array(z.string()).optional(),
        head_only: z.literal(true).meta({
            description: 'V1 content lanes read the head revision only. Earlier revisions stay reachable as Evidence.',
        }),
    })
    .meta({ id: 'MemoryContentSourceSelector', description: 'A content lane of a Brain source scope.' });

export const MemoryAgentRunSourceSelectorSchema = z
    .strictObject({
        kind: z.literal('agent_run'),
        id: z.string().meta({ description: 'Selector id, unique within the Brain. Names the source lane.' }),
        interaction_refs: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        statuses: z.array(z.enum(['completed', 'failed', 'cancelled'])).optional(),
        completed_after: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({ id: 'MemoryAgentRunSourceSelector', description: 'An AgentRun lane of a Brain source scope.' });

export const MemorySourceSelectorSchema = z
    .discriminatedUnion('kind', [MemoryContentSourceSelectorSchema, MemoryAgentRunSourceSelectorSchema])
    .meta({
        id: 'MemorySourceSelector',
        description:
            'One source lane of a Brain. Each selector carries an independent watermark and backlog; a model ' +
            'never supplies or widens one.',
    });

export const MemoryBrainRecipeSchema = z
    .strictObject({
        interaction: z.string().meta({ description: 'Stable ref of the Dreamer interaction.' }),
        environment: z.string().optional().meta({ description: 'Stable ref of the execution environment.' }),
        model: z.string().optional(),
        prompt_version: z.string().meta({ description: 'Prompt version folded into the configuration fingerprint.' }),
        max_run_duration_hours: z.number().int().positive().optional(),
    })
    .meta({ id: 'MemoryBrainRecipe', description: 'How a Brain builds itself: interaction, environment and budgets.' });

export const MemoryBrainUpdatePolicySchema = z
    .strictObject({
        mode: z.enum(['manual', 'scheduled', 'continuous']),
        cron: z.string().optional().meta({ description: 'Schedule expression, for `scheduled` mode.' }),
        debounce_seconds: z.number().int().nonnegative().optional(),
        max_sources_per_run: z.number().int().positive().optional(),
    })
    .meta({ id: 'MemoryBrainUpdatePolicy', description: 'When a Brain reprocesses its sources.' });

export const MemoryBrainLaneStateSchema = z
    .strictObject({
        selector_id: z.string(),
        watermark: z.string().meta({ format: 'date-time' }).optional(),
        sweep_cursor: z.string().optional(),
        lag_seconds: z.number().optional(),
        last_run_id: z.string().optional(),
        backlog: z.number().int().nonnegative().optional(),
    })
    .meta({ id: 'MemoryBrainLaneState', description: 'Freshness of one source lane. Server-managed.' });

export const MemoryBrainSchema = z
    .strictObject({
        id: z.string().meta({ description: 'Immutable project-unique slug. Not the Mongo id.' }),
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: MemoryBrainStatusSchema,
        revision: z.number().int().meta({ description: 'Optimistic-concurrency revision of the configuration.' }),
        source_selectors: z.array(MemorySourceSelectorSchema),
        ontology_ref: z.string().optional(),
        ontology_version: z.string().optional(),
        recipe: MemoryBrainRecipeSchema.optional(),
        update_policy: MemoryBrainUpdatePolicySchema.optional(),
        lane_state: z.array(MemoryBrainLaneStateSchema).optional(),
        active_generation_id: z.string().optional(),
        configuration_fingerprint: z.string().optional(),
        created_by: z.string(),
        updated_by: z.string(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'MemoryBrain', description: 'A Memory Brain: source scope, ontology, recipe and derived state.' });

export const MemoryBrainArraySchema = z.array(MemoryBrainSchema).meta({ id: 'MemoryBrainArray' });

export const CreateMemoryBrainPayloadSchema = z
    .strictObject({
        id: z
            .string()
            .meta({ description: 'Project-unique slug. Immutable once created; derived from the name if omitted.' })
            .optional(),
        name: z.string(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source_selectors: z.array(MemorySourceSelectorSchema).optional(),
        ontology_ref: z.string().optional(),
        ontology_version: z.string().optional(),
        recipe: MemoryBrainRecipeSchema.optional(),
        update_policy: MemoryBrainUpdatePolicySchema.optional(),
    })
    .meta({ id: 'CreateMemoryBrainPayload', description: 'Create a draft Brain. It builds nothing until it is run.' });

export const UpdateMemoryBrainPayloadSchema = z
    .strictObject({
        name: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source_selectors: z.array(MemorySourceSelectorSchema).optional(),
        ontology_ref: z.string().optional(),
        ontology_version: z.string().optional(),
        recipe: MemoryBrainRecipeSchema.optional(),
        update_policy: MemoryBrainUpdatePolicySchema.optional(),
        expected_revision: z
            .number()
            .int()
            .meta({
                description:
                    'Revision the caller read. The update is refused with 409 when the stored revision moved on, so ' +
                    'two administrators cannot silently overwrite each other.',
            }),
    })
    .meta({ id: 'UpdateMemoryBrainPayload', description: 'Update a Brain under optimistic concurrency.' });

export const PromoteMemoryGenerationPayloadSchema = z
    .strictObject({
        generation_id: z.string(),
        expected_revision: z
            .number()
            .int()
            .meta({
                description:
                    'Brain revision the caller read. Promotion is one conditional pointer update, so a Brain that ' +
                    'moved on fails the check instead of switching.',
            }),
    })
    .meta({ id: 'PromoteMemoryGenerationPayload', description: 'Make a built Generation the active one.' });

export const MemoryBrainActionResponseSchema = z
    .strictObject({
        brain: MemoryBrainSchema,
        applied: z.boolean().meta({ description: 'False when the action was a no-op for the current state.' }),
        message: z.string().optional(),
    })
    .meta({ id: 'MemoryBrainActionResponse', description: 'Result of a Brain lifecycle action.' });

export const MemoryGenerationCountsSchema = z
    .strictObject({
        nodes: z.number().int().nonnegative(),
        statements: z.number().int().nonnegative(),
        evidence: z.number().int().nonnegative(),
    })
    .meta({ id: 'MemoryGenerationCounts', description: 'Committed record counts of a Generation.' });

export const MemoryGenerationSchema = z
    .strictObject({
        id: z.string(),
        brain_id: z.string().meta({ description: 'Public slug of the owning Brain.' }),
        ordinal: z.number().int().meta({ description: 'Monotonic per Brain. Generation 1 is the first build.' }),
        status: MemoryGenerationStatusSchema,
        is_active: z.boolean().meta({
            description: "Derived from the Brain's pointer, which is the only authority on which Generation is live.",
        }),
        configuration_fingerprint: z.string().optional(),
        counts: MemoryGenerationCountsSchema.optional(),
        build_started_at: z.string().meta({ format: 'date-time' }).optional(),
        build_ended_at: z.string().meta({ format: 'date-time' }).optional(),
        promoted_at: z.string().meta({ format: 'date-time' }).optional(),
        promoted_by: z.string().optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({
        id: 'MemoryGeneration',
        description: 'One build of a Brain graph. Only a promoted Generation answers public queries.',
    });

export const MemoryGenerationArraySchema = z.array(MemoryGenerationSchema).meta({ id: 'MemoryGenerationArray' });

export const MemoryRunCountsSchema = z
    .strictObject({
        nodes_upserted: z.number().int().nonnegative(),
        statements_upserted: z.number().int().nonnegative(),
        statements_superseded: z.number().int().nonnegative(),
        evidence_linked: z.number().int().nonnegative(),
        refused: z.number().int().nonnegative(),
    })
    .meta({ id: 'MemoryRunCounts', description: 'What one run wrote, and how much of it was refused.' });

export const MemoryRunSummarySchema = z
    .strictObject({
        id: z.string(),
        brain_id: z.string(),
        generation_id: z.string(),
        mode: MemoryRunModeSchema,
        status: MemoryRunStatusSchema,
        counts: MemoryRunCountsSchema.optional(),
        manifest_size: z.number().int().nonnegative().optional(),
        started_at: z.string().meta({ format: 'date-time' }).optional(),
        committed_at: z.string().meta({ format: 'date-time' }).optional(),
        error: z.string().optional(),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({
        id: 'MemoryRunSummary',
        description:
            'Receipt of one Memory run. Execution mechanics live in Temporal and the transcript in the AgentRun; ' +
            'this is the permanent audit anchor for what the run changed.',
    });

export const MemoryRunSummaryArraySchema = z.array(MemoryRunSummarySchema).meta({ id: 'MemoryRunSummaryArray' });

export const MemoryEvidenceLocatorSchema = z
    .strictObject({
        page: z.number().int().optional(),
        heading: z.string().optional(),
        line_start: z.number().int().optional(),
        line_end: z.number().int().optional(),
        message_id: z.string().optional(),
        workstream_id: z.string().optional(),
        tool_call_id: z.string().optional(),
        json_pointer: z.string().optional(),
    })
    .meta({
        id: 'MemoryEvidenceLocator',
        description:
            'Where inside a source the claim was extracted. At least one of `heading`, `page`, `line_start`, ' +
            '`json_pointer` or `message_id` is required — a bare document reference is not a locator. The rule is ' +
            'enforced server-side because JSON Schema cannot express it.',
    });

export const MemoryEvidenceRefSchema = z
    .strictObject({
        id: z.string(),
        source_kind: z.enum(['content', 'agent_run']),
        source_id: z.string(),
        source_revision_id: z.string().optional(),
        source_root_id: z.string().optional(),
        locator: MemoryEvidenceLocatorSchema.optional(),
        extracted_by_run_id: z.string().optional(),
        prompt_version: z.string().optional(),
        ontology_version: z.string().optional(),
    })
    .meta({
        id: 'MemoryEvidenceRef',
        description:
            'A citation: one immutable source and the location inside it. Source text is re-fetched and verified ' +
            'rather than served from this record.',
    });

export const MemoryEvidenceRefArraySchema = z.array(MemoryEvidenceRefSchema).meta({ id: 'MemoryEvidenceRefArray' });

export const MemorySupportSchema = z
    .strictObject({
        basis: MemorySupportBasisSchema.meta({
            description:
                'How the derivation reached the fact, not how certain the fact is. A quantified contract clause is ' +
                '`explicit`; a conclusion drawn across two sources is `strong_inference`.',
        }),
        evidence_ids: z.array(z.string()),
        derived_at: z.string().meta({ format: 'date-time' }).optional(),
        derived_by_run_id: z.string().optional(),
        rationale: z.string().optional(),
    })
    .meta({
        id: 'MemorySupport',
        description:
            'One independent derivation of a Statement. The security snapshots that authorize it are server-side ' +
            'only and are never projected here.',
    });

export const MemoryNodeSchema = z
    .strictObject({
        id: z.string(),
        brain_id: z.string(),
        generation_id: z.string(),
        kind: MemoryNodeKindSchema,
        type: z.string(),
        label: z.string(),
        aliases: z.array(z.string()).optional(),
        attributes: z.record(z.string(), z.unknown()).optional(),
        identity_key: z.string().optional(),
        status: MemoryNodeStatusSchema,
        redirect_to: z.string().optional().meta({ description: 'Surviving Node when this one was merged away.' }),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'MemoryNode', description: 'An entity, event, concept or procedure in a Brain Generation.' });

export const MemoryNodeArraySchema = z.array(MemoryNodeSchema).meta({ id: 'MemoryNodeArray' });

export const MemoryStatementNodeObjectSchema = z
    .strictObject({
        kind: z.literal('node'),
        node_id: z.string(),
    })
    .meta({ id: 'MemoryStatementNodeObject' });

export const MemoryStatementLiteralObjectSchema = z
    .strictObject({
        kind: z.literal('literal'),
        type: z.string().meta({ description: 'Literal type from the ontology, such as `money` or `absence`.' }),
        value: z.unknown().optional(),
    })
    .meta({ id: 'MemoryStatementLiteralObject' });

export const MemoryStatementObjectSchema = z
    .discriminatedUnion('kind', [MemoryStatementNodeObjectSchema, MemoryStatementLiteralObjectSchema])
    .meta({
        id: 'MemoryStatementObject',
        description:
            'Object of a Statement. An unnamed or placeholder party is a literal of type `absence`, never a Node.',
    });

export const MemoryStatementSchema = z
    .strictObject({
        id: z.string(),
        brain_id: z.string(),
        generation_id: z.string(),
        subject_node_id: z.string(),
        predicate: z.string(),
        object: MemoryStatementObjectSchema,
        context_event_id: z.string().optional(),
        valid_from: z.string().meta({ format: 'date-time' }).optional(),
        valid_to: z.string().meta({ format: 'date-time' }).optional(),
        undated: z
            .boolean()
            .optional()
            .meta({
                description:
                    'Set when the source genuinely does not place the fact in time. A Statement with neither ' +
                    '`valid_from` nor `undated` is refused: a fact nobody bothered to date is not the same as one the ' +
                    'source leaves undated.',
            }),
        asserted_at: z.string().meta({ format: 'date-time' }),
        superseded_at: z.string().meta({ format: 'date-time' }).optional(),
        superseded_by: z.string().optional(),
        retracted_at: z.string().meta({ format: 'date-time' }).optional(),
        confidence: z.number().optional(),
        salience: z.number().optional(),
        support: z.array(MemorySupportSchema).meta({
            description: 'Readable derivations only. A Statement is returned when at least one of them authorizes.',
        }),
        created_at: z.string().meta({ format: 'date-time' }),
        updated_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({ id: 'MemoryStatement', description: 'One temporal fact, with the derivations that support it.' });

export const MemoryStatementArraySchema = z.array(MemoryStatementSchema).meta({ id: 'MemoryStatementArray' });

export const MemoryNodePatternSchema = z
    .strictObject({
        node: z.string().meta({ description: 'Variable this pattern binds.' }),
        type: z.string().optional(),
        kind: MemoryNodeKindSchema.optional(),
        alias: z.string().optional().meta({ description: 'Match by label or normalized alias.' }),
        identity_key: z.string().optional(),
    })
    .meta({ id: 'MemoryNodePattern', description: 'Binds a variable to Nodes matching a type and a name.' });

export const MemoryStatementPatternObjectSchema = z
    .strictObject({
        variable: z.string().optional().meta({ description: 'Bind the object Node to this variable.' }),
        literal: z.unknown().optional().meta({ description: 'Match a literal object value exactly.' }),
    })
    .meta({ id: 'MemoryStatementPatternObject' });

export const MemoryStatementPatternBodySchema = z
    .strictObject({
        subject: z.string().meta({ description: 'Variable bound to the subject Node.' }),
        predicate: z.string().optional(),
        object: MemoryStatementPatternObjectSchema.optional(),
        bind: z.string().optional().meta({ description: 'Variable bound to the Statement itself.' }),
    })
    .meta({ id: 'MemoryStatementPatternBody' });

export const MemoryStatementPatternSchema = z
    .strictObject({
        statement: MemoryStatementPatternBodySchema,
    })
    .meta({ id: 'MemoryStatementPattern', description: 'Binds variables through one predicate edge.' });

export const MemoryGraphPatternSchema = z.union([MemoryNodePatternSchema, MemoryStatementPatternSchema]).meta({
    id: 'MemoryGraphPattern',
    description: 'One clause of a graph query. Node patterns bind entities; statement patterns bind edges.',
});

export const MemoryValueFilterSchema = z
    .strictObject({
        variable: z.string(),
        field: z.string().meta({
            description:
                'Attribute path on the bound Node or Statement — `attributes.jurisdiction`, `confidence`, ' +
                '`valid_from`, `valid_to`.',
        }),
        operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'exists']),
        value: z.unknown().optional(),
    })
    .meta({ id: 'MemoryValueFilter', description: 'An attribute, confidence or valid-time constraint.' });

export const MemoryPathQuerySchema = z
    .strictObject({
        from: z.string(),
        to: z.string(),
        predicates: z.array(z.string()).optional(),
        max_hops: z.number().int().min(1).max(3).optional().meta({ description: 'Server-clamped to 3; default 2.' }),
    })
    .meta({ id: 'MemoryPathQuery', description: 'Bounded path search between two bound variables.' });

export const MemoryGraphQuerySchema = z
    .strictObject({
        generation_id: z.string().optional().meta({
            description:
                "Defaults to the Brain's active Generation. Naming a shadow Generation requires content_admin.",
        }),
        match: z.array(MemoryGraphPatternSchema).meta({ description: 'Up to 8 patterns.' }),
        where: z.array(MemoryValueFilterSchema).optional(),
        path: MemoryPathQuerySchema.optional(),
        return: z.array(z.string()).meta({ description: 'Bound variables to project.' }),
        as_of: z
            .string()
            .meta({
                format: 'date-time',
                description: 'Valid-time point. Statements whose interval does not contain it are excluded.',
            })
            .optional(),
        limit: z.number().int().min(1).max(200).optional(),
    })
    .meta({
        id: 'MemoryGraphQuery',
        description:
            'A closed, server-validated graph query. Not a Cypher passthrough: patterns are checked against the ' +
            "Brain's ontology and an unknown type or predicate fails with the valid vocabulary listed. V1 ships " +
            'match, where, bounded path, as-of and limit; aggregation is not in v1.',
    });

export const MemoryPathSchema = z
    .strictObject({
        node_ids: z.array(z.string()).meta({ description: 'Nodes in order, from the `from` binding to the `to` one.' }),
        statement_ids: z.array(z.string()).meta({ description: 'Edges traversed, one fewer than the Nodes.' }),
    })
    .meta({ id: 'MemoryPath', description: 'One authorized path through the graph.' });

export const MemoryGraphQueryResultSchema = z
    .strictObject({
        brain_id: z.string(),
        generation_id: z.string(),
        nodes: z.array(MemoryNodeSchema),
        statements: z.array(MemoryStatementSchema),
        paths: z.array(MemoryPathSchema).optional(),
        bindings: z
            .array(z.record(z.string(), z.string()))
            .optional()
            .meta({ description: 'One row per match, mapping each returned variable to a Node or Statement id.' }),
        truncated: z.boolean().meta({ description: 'True when the limit or a hop cap cut the result short.' }),
    })
    .meta({
        id: 'MemoryGraphQueryResult',
        description:
            'Authorized results only. The engine never reports pre-authorization totals, so a count here is a ' +
            'count of what this principal may read.',
    });
