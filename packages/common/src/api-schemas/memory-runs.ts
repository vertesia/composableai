import { z } from 'zod';
import {
    MemoryEvidenceLocatorSchema,
    MemoryGraphQuerySchema,
    MemoryNodeKindSchema,
    MemoryNodeSchema,
    MemoryRunCountsSchema,
    MemoryRunStatusSchema,
    MemorySupportBasisSchema,
} from './memory.js';

/**
 * The build side of Memory: the vocabulary a run authors against, the run it claims, the operations
 * it stages, and the ticket that proves it committed.
 *
 * The endpoints carrying most of this are internal and hidden, but every payload is a registered
 * component all the same. A body the server enforces with AJV has to be described somewhere, and a
 * hand-rolled server-side validator would be a second contract that nothing keeps in step with the
 * first. What stays out of `@vertesia/common` entirely is the machinery underneath: security
 * snapshots, the manifest's frozen ACL state, and stored support groups, none of which any API
 * client can act on and one of which would leak whom a source is readable by.
 *
 * Nothing here names an account, a project, a Brain, a Generation or a run. Those come from the run
 * record the endpoint path binds to, so a model cannot widen its own scope by writing an id
 * (specification.md §13.3).
 */

/* -------------------------------------------------------------------------------------------------
 * Ontology (specification.md §5.3)
 *
 * The vocabulary is public because agents author queries against it: an unknown predicate fails with
 * the valid list attached, which only helps if the list is readable.
 * ---------------------------------------------------------------------------------------------- */

/**
 * `absence` is not a scalar like the others. It is the type a predicate takes when the fact is that
 * a source declines to name the party — "supplies an unnamed US hyperscaler". Without it, a run has
 * nowhere to put that except a placeholder Node, which is how `unnamed_us_hyperscaler` became a Node
 * an agent later answered a question with.
 */
const MemoryOntologyLiteralTypeSchema = z.enum(['string', 'number', 'boolean', 'date', 'datetime', 'money', 'absence']);

export const MemoryOntologyNodeTypeSchema = z
    .strictObject({
        slug: z.string().meta({ description: 'Stable identifier a Node names in its `type` field.' }),
        title: z.string(),
        kind: MemoryNodeKindSchema,
        identity_fields: z
            .array(z.string())
            .optional()
            .meta({
                description:
                    'Attributes that, together with the label, decide identity. Two Nodes agreeing on all of them ' +
                    'are the same entity — the mechanism that stops one organisation becoming three Nodes.',
            }),
        attribute_schema: z
            .record(z.string(), z.unknown())
            .optional()
            .meta({ description: 'JSON Schema the Node attributes are validated against.' }),
    })
    .meta({ id: 'MemoryOntologyNodeType', description: 'One Node type of an ontology.' });

export const MemoryPredicateNodeObjectSchema = z
    .strictObject({
        kind: z.literal('node'),
        types: z.array(z.string()).meta({ description: 'Node type slugs accepted as the object.' }),
    })
    .meta({ id: 'MemoryPredicateNodeObject' });

export const MemoryPredicateLiteralObjectSchema = z
    .strictObject({
        kind: z.literal('literal'),
        type: MemoryOntologyLiteralTypeSchema,
    })
    .meta({ id: 'MemoryPredicateLiteralObject' });

export const MemoryPredicateObjectSignatureSchema = z
    .discriminatedUnion('kind', [MemoryPredicateNodeObjectSchema, MemoryPredicateLiteralObjectSchema])
    .meta({ id: 'MemoryPredicateObjectSignature', description: 'What a predicate may take as its object.' });

export const MemoryOntologyPredicateSchema = z
    .strictObject({
        slug: z.string(),
        title: z.string(),
        subject_types: z.array(z.string()),
        object: MemoryPredicateObjectSignatureSchema,
        context: z.enum(['forbidden', 'optional', 'required']),
        cardinality: z.enum(['one', 'many']).optional(),
        inverse: z.string().optional(),
        transitive: z.boolean().optional(),
        symmetric: z
            .boolean()
            .optional()
            .meta({
                description:
                    'A symmetric predicate canonicalizes subject and object order in the fact key, so `a partner b` ' +
                    'and `b partner a` are one fact rather than two. Both ends must accept the same types.',
            }),
    })
    .meta({ id: 'MemoryOntologyPredicate', description: 'One predicate signature of an ontology.' });

export const MemoryOntologySchema = z
    .strictObject({
        id: z.string().meta({ description: 'Project-unique ontology id, such as `ai_market_network`.' }),
        version: z.string().meta({ description: 'Immutable while a Generation is built against it.' }),
        title: z.string(),
        description: z.string().optional(),
        status: z.enum(['draft', 'active', 'deprecated']).optional(),
        node_types: z.array(MemoryOntologyNodeTypeSchema),
        predicates: z.array(MemoryOntologyPredicateSchema),
        literal_types: z
            .array(z.string())
            .optional()
            .meta({ description: 'Literal type names beyond the built-in scalars, such as `absence`.' }),
        created_at: z.string().meta({ format: 'date-time' }).optional(),
        updated_at: z.string().meta({ format: 'date-time' }).optional(),
    })
    .meta({
        id: 'MemoryOntology',
        description:
            'The vocabulary a Brain validates against. Every Node type and predicate an operation may name is here; ' +
            'anything else is refused with this list attached, so a caller can correct itself.',
    });

export const MemoryOntologyArraySchema = z.array(MemoryOntologySchema).meta({ id: 'MemoryOntologyArray' });

export const CreateMemoryOntologyPayloadSchema = MemoryOntologySchema.omit({
    status: true,
    created_at: true,
    updated_at: true,
}).meta({
    id: 'CreateMemoryOntologyPayload',
    description:
        'Create one version of an ontology. A version is immutable once a Generation has been built against it, so ' +
        'a change is a new version rather than an edit.',
});

/* -------------------------------------------------------------------------------------------------
 * Run lifecycle (specification.md §8, §10)
 * ---------------------------------------------------------------------------------------------- */

export const MemoryRunSourceRefSchema = z
    .strictObject({
        witness_id: z.string().meta({
            description:
                'Run-local witness id. This, never a raw source id, is what an operation cites; the server resolves ' +
                'it against the frozen manifest.',
        }),
        source_kind: z.enum(['content', 'agent_run']),
        source_id: z.string(),
        source_revision_id: z.string().optional(),
    })
    .meta({
        id: 'MemoryRunSourceRef',
        description:
            'One source a run may cite. The caller names the source; the server reads its digest and current ' +
            'security state itself, so no ACL detail crosses the wire in either direction.',
    });

export const CreateMemoryRunPayloadSchema = z
    .strictObject({
        mode: z
            .enum(['maintain', 'rebuild'])
            .meta({ description: '`rebuild` writes into a shadow Generation; `maintain` extends the active one.' }),
        generation_id: z.string().meta({ description: 'Generation this run writes into.' }),
        partition_id: z.string().optional().meta({ description: 'Bounded slice of the corpus this run covers.' }),
        manifest_digest: z
            .string()
            .optional()
            .meta({ description: 'Digest of the frozen manifest the caller believes it is running.' }),
        workflow_id: z.string().optional(),
        agent_run_id: z.string().optional(),
        sources: z.array(MemoryRunSourceRefSchema).meta({
            description: 'The frozen source manifest. An operation citing anything outside it is refused at commit.',
        }),
    })
    .meta({
        id: 'CreateMemoryRunPayload',
        description: 'Claim a run against a Generation and freeze the sources it is allowed to cite.',
    });

/* -------------------------------------------------------------------------------------------------
 * Staged operations (specification.md §8.1 steps 3-4, §10)
 * ---------------------------------------------------------------------------------------------- */

export const MemoryNodeHandleSchema = z
    .strictObject({
        ref: z.string().optional().meta({ description: 'Run-local handle an earlier operation in this run created.' }),
        node_id: z.string().optional().meta({ description: 'Opaque id of an already-committed Node.' }),
    })
    .meta({
        id: 'MemoryNodeHandle',
        description: 'A Node, named either by a run-local handle or by the opaque id of a committed one.',
    });

export const MemoryStatementHandleSchema = z
    .strictObject({
        ref: z.string().optional(),
        statement_id: z.string().optional(),
    })
    .meta({ id: 'MemoryStatementHandle', description: 'A Statement, by run-local handle or by committed id.' });

export const MemoryWitnessRefSchema = z
    .strictObject({
        witness_id: z.string().meta({ description: 'Witness id from the run manifest.' }),
        locator: MemoryEvidenceLocatorSchema,
        excerpt_digest: z
            .string()
            .optional()
            .meta({ description: 'Digest of the quoted span. Evidence stores digests, never copies of source text.' }),
    })
    .meta({ id: 'MemoryWitnessRef', description: 'One citation: which witness, and where inside it.' });

export const MemoryStatementObjectRefNodeSchema = z
    .strictObject({
        kind: z.literal('node'),
        node: MemoryNodeHandleSchema,
    })
    .meta({ id: 'MemoryStatementObjectRefNode' });

export const MemoryStatementObjectRefLiteralSchema = z
    .strictObject({
        kind: z.literal('literal'),
        type: z.string().meta({ description: 'Literal type from the ontology, such as `money` or `absence`.' }),
        value: z.unknown().optional(),
    })
    .meta({ id: 'MemoryStatementObjectRefLiteral' });

export const MemoryStatementObjectRefSchema = z
    .discriminatedUnion('kind', [MemoryStatementObjectRefNodeSchema, MemoryStatementObjectRefLiteralSchema])
    .meta({
        id: 'MemoryStatementObjectRef',
        description:
            'Object of a proposed Statement. An unnamed party is a literal of type `absence`, never a Node: a run ' +
            'that invents `unnamed_us_hyperscaler` has created something an agent will later answer a question with.',
    });

export const MemoryPutNodeOpSchema = z
    .strictObject({
        op: z.literal('put_node'),
        ref: z.string().meta({ description: 'Run-local handle later operations use to name this Node.' }),
        kind: MemoryNodeKindSchema,
        type: z.string().meta({ description: 'Node type slug from the ontology.' }),
        label: z.string(),
        aliases: z.array(z.string()).optional(),
        attributes: z.record(z.string(), z.unknown()).optional(),
        identity_key: z.string().optional().meta({
            description: 'Explicit identity key. Normally omitted: the server derives it from type and label.',
        }),
        found_candidates: z
            .array(z.string())
            .optional()
            .meta({
                description:
                    'Node ids an entity search returned for this label, including an empty array when it returned ' +
                    'nothing. A put with no prior search for the label is refused.',
            }),
        rationale: z.string().optional(),
    })
    .meta({ id: 'MemoryPutNodeOp', description: 'Create or update a Node. Identity is resolved server-side.' });

export const MemoryAddStatementOpSchema = z
    .strictObject({
        op: z.literal('add_statement'),
        ref: z.string(),
        subject: MemoryNodeHandleSchema,
        predicate: z.string(),
        object: MemoryStatementObjectRefSchema,
        context_event: MemoryNodeHandleSchema.optional(),
        valid_from: z.string().meta({ format: 'date-time' }).optional(),
        valid_to: z.string().meta({ format: 'date-time' }).optional(),
        undated: z.boolean().optional().meta({
            description: 'Set only when the source does not date the fact. Required when `valid_from` is absent.',
        }),
        confidence: z.number().min(0).max(1).optional(),
        salience: z.number().optional(),
        basis: MemorySupportBasisSchema,
        witnesses: z.array(MemoryWitnessRefSchema).meta({
            description: 'At least one citation with a section-level locator. A bare document reference is refused.',
        }),
        rationale: z.string().optional(),
        supersedes: MemoryStatementHandleSchema.optional().meta({
            description: 'Statement this one replaces. The predecessor is closed with a pointer to this one.',
        }),
    })
    .meta({ id: 'MemoryAddStatementOp', description: 'Assert one evidenced, dated fact.' });

export const MemoryLinkEvidenceOpSchema = z
    .strictObject({
        op: z.literal('link_evidence'),
        statement: MemoryStatementHandleSchema,
        basis: MemorySupportBasisSchema,
        witnesses: z.array(MemoryWitnessRefSchema),
        rationale: z.string().optional(),
    })
    .meta({
        id: 'MemoryLinkEvidenceOp',
        description: 'Attach another derivation to an existing Statement rather than restating the fact beside it.',
    });

export const MemoryRetractNodeOpSchema = z
    .strictObject({
        op: z.literal('retract_node'),
        node_id: z.string(),
        reason: z.string(),
    })
    .meta({ id: 'MemoryRetractNodeOp', description: 'Retract a Node. Its provenance is kept.' });

export const MemoryRetractStatementOpSchema = z
    .strictObject({
        op: z.literal('retract_statement'),
        statement_id: z.string(),
        reason: z.string(),
    })
    .meta({ id: 'MemoryRetractStatementOp', description: 'Retract a Statement. Its provenance is kept.' });

export const MemoryRunOperationSchema = z
    .discriminatedUnion('op', [
        MemoryPutNodeOpSchema,
        MemoryAddStatementOpSchema,
        MemoryLinkEvidenceOpSchema,
        MemoryRetractNodeOpSchema,
        MemoryRetractStatementOpSchema,
    ])
    .meta({
        id: 'MemoryRunOperation',
        description: 'One proposed mutation. Nothing is applied until the run commits, and then all of it or none.',
    });

export const MemoryStageOpsPayloadSchema = z
    .strictObject({
        operations: z.array(MemoryRunOperationSchema).min(1),
    })
    .meta({ id: 'MemoryStageOpsPayload', description: 'A batch of operations to stage on a run ledger.' });

export const MemoryRefusalSchema = z
    .strictObject({
        code: z.enum([
            'unknown_predicate',
            'unknown_node_type',
            'signature_mismatch',
            'placeholder_node',
            'undated_statement',
            'invalid_interval',
            'missing_locator',
            'unknown_witness',
            'unresolved_reference',
            'cross_generation_reference',
            'find_before_put',
            'cap_exceeded',
            'stale_source',
            'invalid_ontology',
        ]),
        message: z.string(),
        vocabulary: z
            .array(z.string())
            .optional()
            .meta({ description: 'The valid words, when the refusal is about an unknown type or predicate.' }),
        field: z.string().optional(),
    })
    .meta({
        id: 'MemoryRefusal',
        description:
            'Why an operation was refused, as a correctable message. Refusals stay in the ledger: a predicate a run ' +
            'keeps reaching for and never getting is how we learn the ontology is missing a word.',
    });

export const MemoryStagedOpSchema = z
    .strictObject({
        sequence: z.number().int().meta({ description: 'Monotonic within the run, so replay order is exact.' }),
        ref: z.string().optional(),
        status: z.enum(['staged', 'applied', 'refused']),
        operation: MemoryRunOperationSchema.meta({
            description: 'The operation as persisted, so a caller can compare it against what it submitted.',
        }),
        refusals: z.array(MemoryRefusalSchema).optional(),
    })
    .meta({ id: 'MemoryStagedOp', description: 'One entry of the run ledger, as it was written down.' });

export const MemoryStageOpsResultSchema = z
    .strictObject({
        run_id: z.string(),
        accepted: z.number().int().nonnegative(),
        refused: z.number().int().nonnegative(),
        results: z.array(MemoryStagedOpSchema),
    })
    .meta({
        id: 'MemoryStageOpsResult',
        description:
            'What the ledger now holds for this batch. A refused operation is returned rather than thrown away, so ' +
            'the caller can correct it and stage it again.',
    });

export const MemoryCommitTicketSchema = z
    .strictObject({
        run_id: z.string(),
        brain_id: z.string(),
        generation_id: z.string(),
        status: MemoryRunStatusSchema,
        counts: MemoryRunCountsSchema,
        operation_count: z.number().int().nonnegative().meta({
            description: 'Applied operations. Refused ones stay in the ledger and are not counted here.',
        }),
        applied_sequence_digest: z.string().meta({
            description:
                'Digest of the applied operation sequence numbers, in order. It is recomputed from the ledger when ' +
                'the ticket is verified, so a reported commit that did not happen cannot pass.',
        }),
        committed_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({
        id: 'MemoryCommitTicket',
        description:
            'Proof that a run committed. A normal completion without one changes nothing: the parent treats a ' +
            'missing or unverifiable ticket as a failed attempt and retries the partition.',
    });

/* -------------------------------------------------------------------------------------------------
 * Run-scoped reads (specification.md §8.1 step 4, §11.1)
 * ---------------------------------------------------------------------------------------------- */

export const MemoryFindEntitiesPayloadSchema = z
    .strictObject({
        query: z.string().optional().meta({ description: 'Name or description to resolve, matched by alias prefix.' }),
        type: z.string().optional().meta({ description: 'Node type slug from the ontology.' }),
        kind: MemoryNodeKindSchema.optional(),
        identity_key: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
    })
    .meta({ id: 'MemoryFindEntitiesPayload', description: 'Resolve a name to typed Nodes.' });

export const MemoryStagedNodeSchema = z
    .strictObject({
        ref: z.string().meta({ description: 'Run-local handle to cite this Node with until the run commits.' }),
        type: z.string(),
        label: z.string(),
        aliases: z.array(z.string()).optional(),
    })
    .meta({ id: 'MemoryStagedNode', description: 'A Node this run proposed but has not committed yet.' });

export const MemoryFindEntitiesResultSchema = z
    .strictObject({
        brain_id: z.string(),
        generation_id: z.string(),
        nodes: z.array(MemoryNodeSchema),
        staged: z.array(MemoryStagedNodeSchema).meta({
            description:
                'Matching Nodes this run has staged but not committed. Without them a run cannot see its own ' +
                'writes across stateless tool calls, and would propose the same organisation twice in one partition.',
        }),
        truncated: z.boolean(),
    })
    .meta({
        id: 'MemoryFindEntitiesResult',
        description: 'Candidate Nodes for a name: what is committed, and what this run has already proposed.',
    });

export const MemoryReadGraphPayloadSchema = z
    .strictObject({
        node_ids: z.array(z.string()).optional().meta({ description: 'Seed Nodes to expand from.' }),
        query: MemoryGraphQuerySchema.optional().meta({
            description: 'Structured pattern query. Supplying it selects pattern matching over seed expansion.',
        }),
        predicates: z.array(z.string()).optional(),
        direction: z.enum(['out', 'in', 'both']).optional(),
        as_of: z.string().meta({ format: 'date-time' }).optional(),
        max_hops: z.number().int().min(1).max(3).optional(),
        limit: z.number().int().min(1).max(200).optional(),
    })
    .meta({
        id: 'MemoryReadGraphPayload',
        description:
            'Read the graph, either by expanding seed Nodes or by matching a structured pattern. Both go through ' +
            'the same ontology validation and the same authorization.',
    });
