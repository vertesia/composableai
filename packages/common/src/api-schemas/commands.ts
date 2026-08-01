import { z } from 'zod';

/**
 * Generated from the published components by `scripts/convert-to-zod.mjs`, then reviewed.
 *
 * Every schema below was checked against the document it replaces: `--verify` re-emits this
 * module through the registry adapter and diffs it, so the shapes are the shipped ones.
 */
export const RunMigrationResponseSchema = z
    .strictObject({
        status: z.string(),
    })
    .meta({ id: 'RunMigrationResponse' });

export const RunMigrationPayloadSchema = z
    .strictObject({
        force: z.boolean().optional(),
    })
    .meta({ id: 'RunMigrationPayload' });

export const MigrationListResponseSchema = z.unknown().meta({ id: 'MigrationListResponse' });

export const DeleteCountResultSchema = z
    .strictObject({
        id: z.string(),
        count: z.number(),
    })
    .meta({ id: 'DeleteCountResult' });
