import type { z } from 'zod';
import type {
    CreateInferenceProfilePayloadSchema,
    InferenceProfileIdSchema,
    InferenceProfileNameSchema,
    InferenceProfileRecordArraySchema,
    InferenceProfileRecordSchema,
    InferenceProfileSchema,
    InferenceProfileSnapshotSchema,
    InteractionConfigurationRecordSchema,
    InteractionConfigurationResultSchema,
    ProjectInferenceProfilesSchema,
    UpdateInferenceProfilePayloadSchema,
    UpdateInteractionConfigurationPayloadSchema,
} from './api-schemas/inference-profile.js';

export type InferenceProfileId = z.infer<typeof InferenceProfileIdSchema>;
export type InferenceProfileName = z.infer<typeof InferenceProfileNameSchema>;
export type InferenceProfile = z.infer<typeof InferenceProfileSchema>;
export type InferenceProfileSnapshot = z.infer<typeof InferenceProfileSnapshotSchema>;
export type ProjectInferenceProfiles = z.infer<typeof ProjectInferenceProfilesSchema>;

export type CreateInferenceProfilePayload = z.infer<typeof CreateInferenceProfilePayloadSchema>;
export type UpdateInferenceProfilePayload = z.infer<typeof UpdateInferenceProfilePayloadSchema>;
export type InferenceProfileRecord = z.infer<typeof InferenceProfileRecordSchema>;
export type InferenceProfileRecordArray = z.infer<typeof InferenceProfileRecordArraySchema>;

export type UpdateInteractionConfigurationPayload = z.infer<typeof UpdateInteractionConfigurationPayloadSchema>;
export type InteractionConfigurationRecord = z.infer<typeof InteractionConfigurationRecordSchema>;
export type InteractionConfigurationResult = z.infer<typeof InteractionConfigurationResultSchema>;
