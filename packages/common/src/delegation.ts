import type * as Wire from './wire-types.generated.js';

export type CreateDelegationGrantPayload = Wire.CreateDelegationGrantPayload;
export type DelegationGrant = Wire.DelegationGrant;
export type DelegationGrantArray = Wire.DelegationGrantArray;

export interface DelegationTokenClaim {
    grant_id: string;
    subject: string;
    schedule_id: string;
    output_collection_id: string;
    policy_hash: string;
}
