import { ModelOptionsSchema } from '@llumiverse/common/schemas';
import { z } from 'zod';

export const InferenceProfileIdSchema = z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/)
    .meta({
        id: 'InferenceProfileId',
        description: 'MongoDB ObjectId of the inference profile.',
    });

export const InferenceProfileNameSchema = z
    .string()
    .min(1)
    .max(80)
    .regex(/\S/)
    .meta({ id: 'InferenceProfileName', description: 'Editable display name, independent of the stable profile ID.' });

export const InferenceProfileSchema = z
    .strictObject({
        name: InferenceProfileNameSchema.optional().meta({
            description: 'Editable display name.',
        }),
        description: z.string().max(1000).optional(),
        environment: z.string().regex(/^[a-fA-F0-9]{24}$/),
        model: z.string().min(1).optional(),
        model_options: ModelOptionsSchema.optional(),
    })
    .meta({
        id: 'InferenceProfile',
        description:
            'A reusable environment, model and inference parameter preset. Credentials remain in the environment.',
    });

export const ProjectInferenceProfilesSchema = z
    .strictObject({
        default_profile: InferenceProfileIdSchema.optional(),
        modality: z
            .strictObject({
                image: InferenceProfileIdSchema.optional(),
                video: InferenceProfileIdSchema.optional(),
            })
            .optional(),
        system: z
            .strictObject({
                content_type: InferenceProfileIdSchema.optional(),
                intake: InferenceProfileIdSchema.optional(),
                analysis: InferenceProfileIdSchema.optional(),
                agent: InferenceProfileIdSchema.optional(),
                non_applicable: InferenceProfileIdSchema.optional(),
            })
            .optional(),
    })
    .meta({
        id: 'ProjectInferenceProfiles',
        description:
            'Project defaults reference profile MongoDB IDs. Profile definitions are managed through the inference profiles API.',
    });

export const InferenceProfileSnapshotSchema = z
    .strictObject({
        id: InferenceProfileIdSchema.optional(),
        name: InferenceProfileNameSchema,
        revision: z.string(),
        source: z.enum(['request', 'binding', 'interaction', 'project']),
        profile: InferenceProfileSchema,
    })
    .meta({
        id: 'InferenceProfileSnapshot',
        description:
            'The selected profile and content revision at execution creation. Effective overrides are recorded in the execution config.',
    });

export const CreateInferenceProfilePayloadSchema = InferenceProfileSchema.extend({
    name: InferenceProfileNameSchema,
}).meta({
    id: 'CreateInferenceProfilePayload',
    description: 'Create a profile in the current project. The server assigns its MongoDB ID.',
});

export const UpdateInferenceProfilePayloadSchema = CreateInferenceProfilePayloadSchema.extend({}).meta({
    id: 'UpdateInferenceProfilePayload',
    description: 'Replace editable profile fields, preserving its ID and references.',
});

export const InferenceProfileRecordSchema = CreateInferenceProfilePayloadSchema.extend({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/),
    project: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
}).meta({
    id: 'InferenceProfileRecord',
    description: 'A project-scoped inference profile stored as a MongoDB document.',
});

export const InferenceProfileRecordArraySchema = z
    .array(InferenceProfileRecordSchema)
    .meta({ id: 'InferenceProfileRecordArray' });

export const UpdateInteractionConfigurationPayloadSchema = z
    .strictObject({
        inference_profile: InferenceProfileIdSchema.nullable(),
    })
    .meta({ id: 'UpdateInteractionConfigurationPayload' });
export const InteractionConfigurationRecordSchema = UpdateInteractionConfigurationPayloadSchema.extend({
    id: z.string().regex(/^[a-fA-F0-9]{24}$/),
    project: z.string(),
    interaction: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
}).meta({ id: 'InteractionConfigurationRecord' });
export const InteractionConfigurationResultSchema = z
    .strictObject({
        configuration: InteractionConfigurationRecordSchema.nullable(),
    })
    .meta({ id: 'InteractionConfigurationResult' });

export const InferenceProfileUsageQuerySchema = z
    .strictObject({
        search: z.string().max(200).optional(),
        kind: z.enum(['stored', 'system', 'app']).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .meta({ id: 'InferenceProfileUsageQuery' });

export const InferenceProfileUsageEntrySchema = z
    .strictObject({
        id: z.string(),
        name: z.string(),
        kind: z.enum(['stored', 'system', 'app']),
        version: z.number().optional(),
        status: z.string().optional(),
    })
    .meta({ id: 'InferenceProfileUsageEntry' });

export const InferenceProfileUsageSchema = z
    .strictObject({
        interactions: z.array(InferenceProfileUsageEntrySchema),
        total: z.number().int().nonnegative(),
        defaults: z.array(z.string()).meta({ description: 'Project default slots directly referencing this profile.' }),
    })
    .meta({
        id: 'InferenceProfileUsage',
        description: 'Persisted direct assignments; runtime overrides and inherited usage are not enumerated.',
    });
