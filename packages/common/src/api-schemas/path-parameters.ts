import { z } from 'zod';

/**
 * Path parameter components: the format of each identifier a route reads from its path.
 *
 * Each component describes a family of routes and names the parameters whose format the server checks before it
 * looks anything up, answering a malformed value with a 400. A route declares one with `path: apiComponent(...)`, and
 * the published parameter then carries the format. Parameters that a malformed value sends to a lookup answering 404,
 * or that are free-form names, are left out, so their published type stays a plain string.
 */

/** A MongoDB ObjectId: 24 hexadecimal characters, the only spelling the server accepts as an identifier. */
function objectId(description: string) {
    return z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .meta({ description: `${description}, as 24 hexadecimal characters.` });
}

/**
 * A reference to a capability an installed app contributes: `app:<app name>:<local id>`. Only the `app` prefix is a
 * format check: the server answers 400 without it, and looks every other value up, so a reference missing its app name
 * or local id keeps the lookup's 403 or 404.
 */
function appReference(what: string) {
    return z
        .string()
        .regex(/^app(:|$)/)
        .meta({
            description:
                `The ${what}, as \`app:<app name>:<local id>\`. Only the \`app\` prefix is checked as a format; ` +
                'a reference without an app name or local id is refused by the lookup, as forbidden or not found.',
        });
}

export const DashboardPathParamsSchema = z
    .object({
        storeId: objectId('The data store ID'),
        dashboardId: objectId('The dashboard ID'),
        versionId: objectId('The dashboard version ID'),
    })
    .partial()
    .meta({ id: 'DashboardPathParams' });

export const DataStoreImportPathParamsSchema = z
    .object({ importId: objectId('The import job ID') })
    .partial()
    .meta({ id: 'DataStoreImportPathParams' });

export const DataStoreVersionPathParamsSchema = z
    .object({ versionId: objectId('The data store version ID') })
    .partial()
    .meta({ id: 'DataStoreVersionPathParams' });

export const ContentObjectExportPathParamsSchema = z
    .object({
        exportId: objectId('The content object export ID'),
        role: z.enum(['data', 'manifest']).meta({ description: 'The export file: its data or its manifest.' }),
    })
    .partial()
    .meta({ id: 'ContentObjectExportPathParams' });

export const ProcessTestRunPathParamsSchema = z
    .object({ runId: objectId('The process test run ID') })
    .partial()
    .meta({ id: 'ProcessTestRunPathParams' });

export const ProcessPathParamsSchema = z
    .object({
        processId: objectId('The process definition ID'),
        runId: objectId('The process test run ID'),
        suiteId: objectId('The process test suite ID'),
    })
    .partial()
    .meta({ id: 'ProcessPathParams' });

export const TaskPathParamsSchema = z
    .object({ taskId: objectId('The task ID') })
    .partial()
    .meta({ id: 'TaskPathParams' });

export const AgentRunPathParamsSchema = z
    .object({ agentRunId: objectId('The agent run ID') })
    .partial()
    .meta({ id: 'AgentRunPathParams' });

export const AppVersionPathParamsSchema = z
    .object({ id: objectId('The app version ID') })
    .partial()
    .meta({ id: 'AppVersionPathParams' });

export const AppInstallationPathParamsSchema = z
    .object({ installId: objectId('The app installation ID') })
    .partial()
    .meta({ id: 'AppInstallationPathParams' });

export const DelegationGrantPathParamsSchema = z
    .object({ grantId: objectId('The delegation grant ID') })
    .partial()
    .meta({ id: 'DelegationGrantPathParams' });

export const OAuthProviderPathParamsSchema = z
    .object({ id: objectId('The OAuth provider ID') })
    .partial()
    .meta({ id: 'OAuthProviderPathParams' });

export const ProjectAppCapabilityPathParamsSchema = z
    .object({
        processId: appReference('app process'),
        templateId: appReference('app rendering template'),
        typeId: appReference('app content type'),
        viewId: z
            .string()
            .regex(/^app:[A-Za-z0-9][A-Za-z0-9._@-]*:[A-Za-z0-9][A-Za-z0-9._:-]*$/)
            .meta({ description: 'The app View, as `app:<app name>:<local id>`.' }),
    })
    .partial()
    .meta({ id: 'ProjectAppCapabilityPathParams' });
