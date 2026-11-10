import { describe, expect, it } from 'vitest';
import type { ApiComponentName } from './registry.js';
import { validateApiRequest } from './registry.js';

/**
 * Rules the app and interaction endpoints already enforced, now stated by their request components: each case is a
 * value the server refuses with a 400, or one it has always accepted. A case sets the one field it checks (beside the
 * `interaction` a named execution needs), and only the issues reported at that field count.
 */
type Case = [label: string, component: ApiComponentName, value: unknown, valid: boolean];

const OBJECT_ID = '6aefdb50a6900e4e09e363b7';

const cases: Case[] = [
    ['an installation ID', 'AppInstallationPathParams', { installId: OBJECT_ID }, true],
    ['an installation ID that is not an ObjectId', 'AppInstallationPathParams', { installId: '0' }, false],
    ['a settings installation ID', 'AppInstallationPathParams', { app_id: OBJECT_ID }, true],
    ['a settings installation ID that is not an ObjectId', 'AppInstallationPathParams', { app_id: '0' }, false],
    ['a deployment alias', 'AppVersionPathParams', { alias: 'staging-2' }, true],
    ['an uppercase deployment alias', 'AppVersionPathParams', { alias: 'mØ' }, false],
    ['a deployment alias ending in a hyphen', 'AppVersionPathParams', { alias: 'staging-' }, false],
    ['a system interaction', 'InteractionConfigurationPathParams', { interactionId: 'sys:generic_question' }, true],
    ['an app interaction', 'InteractionConfigurationPathParams', { interactionId: 'app:my-app:review' }, true],
    ['a stored interaction ID', 'InteractionConfigurationPathParams', { interactionId: OBJECT_ID }, false],
    ['an app interaction without local id', 'InteractionConfigurationPathParams', { interactionId: 'app:x' }, false],
    [
        'an interaction ID over 300 characters',
        'InteractionConfigurationPathParams',
        { interactionId: `sys:${'a'.repeat(300)}` },
        false,
    ],
    ['a fork into a project', 'InteractionForkPayload', { targetProject: OBJECT_ID }, true],
    ['a fork into an empty project ID', 'InteractionForkPayload', { targetProject: '' }, false],
    ['a version filter', 'InteractionListQuery', { version: '3' }, true],
    ['a version filter parseInt reads', 'InteractionListQuery', { version: ' -2abc' }, true],
    ['an empty version filter', 'InteractionListQuery', { version: '' }, true],
    ['a version filter that is not a number', 'InteractionListQuery', { version: 'latest' }, false],
    ['an update with a publisher', 'UpdateAppPayload', { publisher: 'acme' }, true],
    ['an update with an empty publisher', 'UpdateAppPayload', { publisher: '' }, false],
    ['a UI with an empty src', 'UpdateAppPayload', { ui: { src: '' } }, false],
    ['execution data as an object', 'InteractionExecutionPayload', { data: { a: 1 } }, true],
    ['execution data as null', 'InteractionExecutionPayload', { data: null }, true],
    ['a version record to rebuild', 'UpsertAppVersionRequest', { record_id: OBJECT_ID }, true],
    ['an empty version record, which is none', 'UpsertAppVersionRequest', { record_id: '' }, true],
    ['a version record that is not an ObjectId', 'UpsertAppVersionRequest', { record_id: 'abc' }, false],
    ['a tool name', 'ToolPathParams', { toolName: 'web_search' }, true],
    ['a blank tool name', 'ToolPathParams', { toolName: '\n' }, false],
    ['a status filter', 'InteractionListQuery', { status: ['draft'] }, true],
    ['a comma-separated status filter', 'InteractionListQuery', { status: [' draft , published,'] }, true],
    ['an empty status filter, which is none', 'InteractionListQuery', { status: [''] }, true],
    ['an unknown status', 'InteractionListQuery', { status: ['R~Q'] }, false],
    ['a list with an unknown status', 'InteractionListQuery', { status: ['draft,drafts'] }, false],
    ['a parent run filter', 'RunListQuery', { parent: [OBJECT_ID] }, true],
    ['comma-separated parent runs', 'RunListQuery', { parent: [`${OBJECT_ID}, ${OBJECT_ID}`] }, true],
    ['the legacy root filter', 'RunListQuery', { parent: ['false'] }, true],
    ['an empty parent filter, which is none', 'RunListQuery', { parent: [','] }, true],
    ['a parent run that is not an ObjectId', 'RunListQuery', { parent: ['0'] }, false],
    ['comma-separated environments', 'RunListQuery', { environment: [`${OBJECT_ID},${OBJECT_ID}`] }, true],
    ['an environment that is not an ObjectId', 'RunListQuery', { environment: ['prod'] }, false],
    ['the legacy root filter as an environment', 'RunListQuery', { environment: ['false'] }, false],
    ['a run environment ID', 'UpdateExecutionRunPayload', { environment: OBJECT_ID }, true],
    ['a populated run environment', 'UpdateExecutionRunPayload', { environment: { id: OBJECT_ID } }, false],
    ['a run parent ID', 'UpdateExecutionRunPayload', { parent: OBJECT_ID }, true],
    ['a run parent that is not an ObjectId', 'UpdateExecutionRunPayload', { parent: 'run' }, false],
    ['a run interaction ID', 'UpdateExecutionRunPayload', { interaction: OBJECT_ID }, true],
    ['a populated run interaction', 'UpdateExecutionRunPayload', { interaction: { id: OBJECT_ID } }, false],
];

/** The issues reported at `path`, so that what else a component requires does not count. */
function issuesAt(component: ApiComponentName, value: unknown, path: string) {
    const result = validateApiRequest(component, value);
    return result.valid ? [] : result.issues.filter((issue) => issue.path.startsWith(path));
}

describe('app and interaction request rules', () => {
    it.each(cases)('%s (%s): valid is %s', (_label, component, value, valid) => {
        const field = Object.keys(value as Record<string, unknown>).find((key) => key !== 'interaction') ?? '';
        const issues = issuesAt(component, value, `/${field}`);
        expect(issues.length === 0, JSON.stringify(issues)).toBe(valid);
    });

    it('creates an interaction in an environment named by ID, or by none', () => {
        expect(issuesAt('InteractionCreatePayload', { environment: OBJECT_ID }, '/environment')).toEqual([]);
        expect(issuesAt('InteractionCreatePayload', { environment: '' }, '/environment')).toEqual([]);
        expect(issuesAt('InteractionCreatePayload', { environment: 'prod' }, '/environment')).not.toEqual([]);
    });
});
