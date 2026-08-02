import { z } from 'zod';
import { FacetSpecSchema, PromptTemplateRefSchema } from './interaction.js';

// The prompt-authoring contracts: what a fork, a render and a prompt search publish, and how a
// prompt's interaction usages are reported. `PromptTemplate` itself and its two write payloads live
// in `./interaction.js`, which is where the prompt tree the interactions reference is defined.
//
// `//` rather than `/** */` throughout: a JSDoc block immediately preceding an exported declaration
// is picked up by the OpenAPI scanner and published as that component's `description`, which would
// double up with the `description` stated in `.meta()`.

export const RenderPromptResponseSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        content_type: z.string(),
        rendered: z.string(),
    })
    .meta({ id: 'RenderPromptResponse' });

export const PromptTemplateInteractionVersionSchema = z
    .strictObject({
        version: z.number(),
    })
    .meta({ id: 'PromptTemplateInteractionVersion' });

export const PromptTemplateForkPayloadSchema = z
    .strictObject({
        keepTags: z.boolean().optional(),
        targetProject: z.string().optional(),
    })
    .meta({ id: 'PromptTemplateForkPayload' });

export const PromptSearchQuerySchema = z
    .strictObject({
        name: z.string().meta({ description: 'Case-insensitive substring match on the prompt name.' }).optional(),
        status: z
            .array(z.string())
            .meta({
                description:
                    'Accepted and ignored. `GET /prompts` and `POST /prompts/facets` list drafts only, and always have.',
            })
            .optional(),
        limit: z.number().meta({ description: 'Maximum number of prompts to return. Defaults to 100.' }).optional(),
        offset: z.number().meta({ description: 'Number of prompts to skip.' }).optional(),
        role: z.string().meta({ description: 'Exact match on the prompt role.' }).optional(),
        tags: z.array(z.string()).meta({ description: 'Match prompts carrying any of these tags.' }).optional(),
        matchInteractions: z
            .boolean()
            .meta({
                description:
                    'Accepted and ignored. It used to attach the interactions referencing each prompt, in a shape no response component ever declared; nothing consumed it.',
            })
            .optional(),
    })
    .meta({ id: 'PromptSearchQuery' });

export const PromptTemplateInteractionUsageSchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        versions: z.array(PromptTemplateInteractionVersionSchema),
    })
    .meta({ id: 'PromptTemplateInteractionUsage' });

export const ComputePromptFacetPayloadSchema = z
    .strictObject({
        facets: z.array(FacetSpecSchema),
        query: PromptSearchQuerySchema.optional(),
    })
    .meta({ id: 'ComputePromptFacetPayload' });

export const PromptTemplateInteractionsResponseSchema = z
    .strictObject({
        prompt: z.string(),
        interactions: z.array(PromptTemplateInteractionUsageSchema),
    })
    .meta({ id: 'PromptTemplateInteractionsResponse' });

export const PromptTemplateRefArraySchema = z.array(PromptTemplateRefSchema).meta({ id: 'PromptTemplateRefArray' });
