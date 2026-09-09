import type { z } from 'zod';
import type {
    CreateDelegationGrantPayloadSchema,
    DelegationGrantArraySchema,
    DelegationGrantSchema,
} from './api-schemas/delegation.js';

export type CreateDelegationGrantPayload = z.infer<typeof CreateDelegationGrantPayloadSchema>;
export type DelegationGrant = z.infer<typeof DelegationGrantSchema>;
export type DelegationGrantArray = z.infer<typeof DelegationGrantArraySchema>;

export interface DelegationTokenClaim {
    grant_id: string;
    subject: string;
    schedule_id: string;
    output_collection_id: string;
    policy_hash: string;
}
