// Runtime schemas for the view execution API domain.

import { z } from 'zod';
import type { ViewNavigationNode } from '../views.js';
import { ContentObjectItemApiResponseSchema } from './content.js';
import { StringArrayMapSchema } from './dashboard.js';
import { StringValueMapSchema } from './files.js';
import { conditional } from './schema-primitives.js';
import * as ViewSchemas from './views.js';

const ViewSearchFieldDefinitionSchema = ViewSchemas.ViewSearchFieldDefinitionSchema;

const ViewElasticsearchQuerySchema = ViewSchemas.ViewElasticsearchQuerySchema;

const ViewExperienceLayoutSchema = ViewSchemas.ViewExperienceLayoutSchema;

export const ViewNavigationNodeSchema: z.ZodType<ViewNavigationNode> = z
    .strictObject({
        id: z.string(),
        label: z.string(),
        count: z.number(),
        selected: z.boolean().optional(),
        expandable: z.boolean().optional(),
        children: z.array(z.lazy(() => ViewNavigationNodeSchema)).optional(),
        path: z.string().optional(),
    })
    .meta({ id: 'ViewNavigationNode' });

export const ViewHitAnnotationSchema = z
    .strictObject({
        why_match: z.string().optional(),
        answer: z.string().optional(),
        excerpt: z.string().optional(),
    })
    .meta({ id: 'ViewHitAnnotation' });

export const ViewExecutionWarningSchema = z
    .strictObject({
        code: z.string(),
        message: z.string(),
        path: z.string().optional(),
    })
    .meta({ id: 'ViewExecutionWarning' });

export const ViewQueryPlanningFailureCodeSchema = z
    .enum(['interaction_failed', 'invalid_output', 'invalid_query', 'low_confidence', 'timeout', 'unknown'])
    .meta({ id: 'ViewQueryPlanningFailureCode' });

// The page window a View execution accepts: whole numbers, at most 200 rows from an offset of at most 50,000.
const viewPageOffset = z.number().min(0).max(50_000).multipleOf(1);
const viewPageLimit = z.number().min(1).max(200).multipleOf(1);

// The free-text and id inputs of a View execution, bounded as the server bounds them.
const viewQuery = z.string().max(4_000);
const viewElementId = z.string().max(64);

/**
 * The selection maps of a View execution are keyed by the id of a navigation or key-term group, which starts with a
 * lowercase letter followed by lowercase letters, digits, `_` and `-`. The server also bounds how many groups and
 * values a request carries.
 *
 * Stated on the payload rather than on the maps: a `propertyNames` on a free-form map makes the Java and Python
 * generators drop its nullability and give it an empty default. The `if` always holds.
 */
const VIEW_GROUP_ID_PATTERN = '^[a-z][a-z0-9_-]*$';
const viewSelectionMap = (maxGroups: number) => ({
    propertyNames: { pattern: VIEW_GROUP_ID_PATTERN },
    maxProperties: maxGroups,
    additionalProperties: { maxItems: 100, items: { maxLength: 1_000 } },
});
const viewExecutionInputRule = conditional(
    {},
    {
        properties: {
            key_terms: viewSelectionMap(50),
            navigation: viewSelectionMap(20),
            navigation_queries: {
                propertyNames: { pattern: VIEW_GROUP_ID_PATTERN },
                maxProperties: 20,
                additionalProperties: { maxLength: 200 },
            },
        },
    },
);
const VIEW_EXECUTION_INPUT_DESCRIPTION =
    'The keys of `key_terms`, `navigation` and `navigation_queries` are group ids: a lowercase letter, then ' +
    'lowercase letters, digits, `_` or `-`. `key_terms` holds at most 50 groups and `navigation` at most 20, each ' +
    'of at most 100 values of at most 1,000 characters, and the two hold at most 1,000 values in total. ' +
    '`navigation_queries` holds at most 20 queries of at most 200 characters.';

export const ExecuteViewRequestSchema = z
    .strictObject({
        query: viewQuery.optional(),
        key_terms: StringArrayMapSchema.optional(),
        navigation: StringArrayMapSchema.optional(),
        navigation_queries: StringValueMapSchema.meta({
            description: 'Server-side text filters for large navigation sources, keyed by navigation id.',
        }).optional(),
        display: viewElementId.optional(),
        sort: viewElementId.optional(),
        offset: viewPageOffset.optional(),
        limit: viewPageLimit.optional(),
    })
    .meta({ id: 'ExecuteViewRequest', description: VIEW_EXECUTION_INPUT_DESCRIPTION, ...viewExecutionInputRule });

const ViewKeyTermDefinitionSchema = ViewSchemas.ViewKeyTermDefinitionSchema;

const ViewExperienceScopeSchema = ViewSchemas.ViewExperienceScopeSchema;

export const ViewNavigationResultSchema = z
    .strictObject({
        id: z.string(),
        selected: z.array(z.string()),
        nodes: z.array(ViewNavigationNodeSchema),
        query: z
            .string()
            .meta({ description: 'Applied server-side node filter, when the navigation source supports it.' })
            .optional(),
        breadcrumbs: z
            .array(ViewNavigationNodeSchema)
            .meta({ description: 'Selected drill-down path from its root through the current value.' })
            .optional(),
        truncated: z.boolean().optional(),
    })
    .meta({ id: 'ViewNavigationResult' });

export const ViewExecutionQueryPlanSchema = z
    .strictObject({
        status: z.enum(['applied', 'fallback']),
        query: ViewElasticsearchQuerySchema.optional(),
        confidence: z.number().optional(),
        error_code: ViewQueryPlanningFailureCodeSchema.optional(),
        error_message: z.string().optional(),
    })
    .meta({
        id: 'ViewExecutionQueryPlan',
        description:
            'Safe query-planning diagnostics. The query contains only the model-authored subtree; server-owned scope and content-security filters are never exposed.',
    });

export const ViewRerankFailureCodeSchema = z
    .enum(['interaction_failed', 'invalid_output', 'timeout', 'unknown'])
    .meta({ id: 'ViewRerankFailureCode' });

export const ViewExecutionRerankResultSchema = z
    .strictObject({
        status: z.enum(['applied', 'fallback', 'skipped']),
        candidate_count: z.number(),
        skip_reason: z.enum(['not_enough_candidates', 'query_fallback', 'explicit_sort', 'configured_sort']).optional(),
        error_code: ViewRerankFailureCodeSchema.optional(),
        error_message: z.string().optional(),
    })
    .meta({ id: 'ViewExecutionRerankResult' });

export const ViewExecutionSearchConfigurationSchema = z
    .strictObject({
        renderer: z.string().optional(),
        mode: z.enum(['deterministic', 'agentic']).optional(),
        placeholder: z.string().optional(),
        fields: z.array(ViewSearchFieldDefinitionSchema).optional(),
        key_terms: z.array(ViewKeyTermDefinitionSchema).optional(),
    })
    .meta({
        id: 'ViewExecutionSearchConfiguration',
        description:
            'Client-visible search controls. Agentic planner instructions, interaction, and model configuration are intentionally omitted.',
    });

const ViewSearchConfigurationSchema = ViewSchemas.ViewSearchConfigurationSchema;

const ViewNavigationItemSchema = ViewSchemas.ViewNavigationItemSchema;

export const ViewNavigationResultMapSchema = z
    .object({})
    .catchall(ViewNavigationResultSchema)
    .meta({ id: 'ViewNavigationResultMap' });

export const ViewExecutionSearchResultSchema = z
    .strictObject({
        input: z.string().optional(),
        interpretation: z.string().optional(),
        key_terms: StringArrayMapSchema.optional(),
        plan: ViewExecutionQueryPlanSchema.optional(),
        rerank: ViewExecutionRerankResultSchema.optional(),
        requested_mode: z.enum(['browse', 'deterministic', 'agentic']),
        applied_mode: z.enum(['browse', 'deterministic', 'query', 'query_and_view']),
        fallback_reason: z.string().optional(),
        warnings: z.array(ViewExecutionWarningSchema),
    })
    .meta({ id: 'ViewExecutionSearchResult' });

export const ViewHitSchema = z
    .strictObject({
        id: z.string(),
        score: z.number().optional(),
        document: ContentObjectItemApiResponseSchema,
        annotation: ViewHitAnnotationSchema.optional(),
    })
    .meta({ id: 'ViewHit' });

const ViewResultsConfigurationSchema = ViewSchemas.ViewResultsConfigurationSchema;

export const ViewExecutionDefinitionSchema = z
    .strictObject({
        name: z.string(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).optional(),
        search: ViewExecutionSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
    })
    .meta({
        id: 'ViewExecutionDefinition',
        description:
            'The reusable, client-visible part of the View definition used for an execution. Server-owned scope is intentionally omitted.',
    });

// Its top-level bounds restate the server's View configuration JSON Schema, as the nested schemas in `./views.js` do.
export const ViewExperienceConfigurationSchema = z
    .strictObject({
        name: z.string().min(1).max(120),
        description: z.string().max(4_000).optional(),
        enabled: z.boolean().optional(),
        layout: ViewExperienceLayoutSchema.optional(),
        scope: ViewExperienceScopeSchema.optional(),
        navigation: z.array(ViewNavigationItemSchema).max(20).optional(),
        search: ViewSearchConfigurationSchema.optional(),
        results: ViewResultsConfigurationSchema.optional(),
    })
    .meta({ id: 'ViewExperienceConfiguration' });

export const ViewExecutionResultSchema = z
    .strictObject({
        view: z.string(),
        revision: z.number(),
        definition: ViewExecutionDefinitionSchema.meta({
            description: 'The runtime-safe rendering definition resolved by the platform for this execution.',
        }),
        display: z.string().optional(),
        sort: z.string().optional(),
        search: ViewExecutionSearchResultSchema,
        hits: z.array(ViewHitSchema),
        total: z.number(),
        navigation: ViewNavigationResultMapSchema,
        took: z.number(),
    })
    .meta({ id: 'ViewExecutionResult' });

/**
 * A configuration without `search` takes no search input: a query that is not blank, or a key term with a non-empty
 * value, is refused. The configuration is inline here, so the rule is stated; an execution of a stored View reads
 * the stored one.
 */
const previewSearchInputRule = conditional(
    { required: ['configuration'], properties: { configuration: { not: { required: ['search'] } } } },
    {
        properties: {
            query: { pattern: '^\\s*$' },
            key_terms: { additionalProperties: { items: { maxLength: 0 } } },
        },
    },
);

export const PreviewViewExperienceRequestSchema = z
    .strictObject({
        query: viewQuery.optional(),
        key_terms: StringArrayMapSchema.optional(),
        navigation: StringArrayMapSchema.optional(),
        navigation_queries: StringValueMapSchema.meta({
            description: 'Server-side text filters for large navigation sources, keyed by navigation id.',
        }).optional(),
        display: viewElementId.optional(),
        sort: viewElementId.optional(),
        offset: viewPageOffset.optional(),
        limit: viewPageLimit.optional(),
        configuration: ViewExperienceConfigurationSchema.meta({
            description: 'The unsaved View configuration to validate and execute.',
        }),
    })
    .meta({
        id: 'PreviewViewExperienceRequest',
        description:
            'Execute an unsaved (draft) View configuration without persisting it. Combines the inline configuration with the same execution inputs as  {@link  ExecuteViewRequest }  so authors can validate and preview results before calling create/update. ' +
            VIEW_EXECUTION_INPUT_DESCRIPTION +
            ' Without `configuration.search`, `query` must be blank and every `key_terms` value empty.',
        ...viewExecutionInputRule,
        allOf: [previewSearchInputRule],
    });
