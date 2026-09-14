import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i);
export const CreateDelegationGrantPayloadSchema = z
    .strictObject({
        schedule_id: id,
        subject: id,
        output_collection_id: id,
        policy_hash: z.string().regex(/^[a-f0-9]{64}$/),
        expires_at: z.string().datetime().nullable(),
    })
    .meta({ id: 'CreateDelegationGrantPayload' });
export const DelegationGrantSchema = CreateDelegationGrantPayloadSchema.extend({
    id,
    account_id: id,
    project_id: id,
    granter: id,
    created_at: z.string().datetime(),
    revoked_at: z.string().datetime().nullable(),
}).meta({ id: 'DelegationGrant' });
export const DelegationGrantArraySchema = z.array(DelegationGrantSchema).meta({ id: 'DelegationGrantArray' });
