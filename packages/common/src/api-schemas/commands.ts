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

/**
 * The migration-command body, including the `params` the published component omitted.
 *
 * `force` was all the document ever declared, and while nothing enforced the closed component that
 * was merely incomplete rather than wrong: `MigrationTool.migrate()` reads `payload.params` off the
 * same body and hands it to `doMigrate()`, which is how `migrate-agent-runs` receives its `tenantId`
 * and `since`. Publishing only `force` on a closed component and then enforcing it would have made
 * the endpoint reject the invocation documented in the migration's own header comment.
 *
 * `params` is freeform because it genuinely is: `MigrationTool<P>` is generic and each migration
 * names its own parameter type, so there is no single shape to publish. The alternative — one
 * component per migration — would put the operator endpoint's registry entries in step with a list
 * that changes every time someone adds a backfill.
 */
export const RunMigrationPayloadSchema = z
    .strictObject({
        force: z.boolean().optional(),
        params: z.looseObject({}).optional(),
    })
    .meta({ id: 'RunMigrationPayload' });

/**
 * The migration listing, given the shape the handler has always returned.
 *
 * The converted component was `z.unknown()`, faithfully reproducing what the document published —
 * the endpoint declared a response component and never described it, so the middleware validated
 * every response against "anything". Nothing about that was a conversion artifact worth preserving:
 * the handler returns `{ migrations: [{ name }] }` and has since it was written.
 *
 * Widening a published `{}` to a real object is a contract ADDITION rather than a restriction —
 * every response that validated before still validates — but it is visible in the generated clients,
 * which gain a model where they had a bare object. See operation 27 of the 1.5 runbook.
 */
export const MigrationListResponseSchema = z
    .strictObject({
        migrations: z.array(z.strictObject({ name: z.string() })),
    })
    .meta({ id: 'MigrationListResponse' });

export const DeleteCountResultSchema = z
    .strictObject({
        id: z.string(),
        count: z.number(),
    })
    .meta({ id: 'DeleteCountResult' });
