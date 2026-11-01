import { describe, expect, it } from 'vitest';
import type { ApiComponentName } from './registry.js';
import { validateApiRequest } from './registry.js';

/**
 * The bounds request components publish for rules their endpoints already enforced: a value that must not be
 * empty, or blank where the server trims it, a list that needs at least one item, a name in the server's format, a
 * page window the route accepts.
 *
 * Each case checks one field by its own path, so a body only needs that field: what else the component requires
 * is reported at the root and does not count. A refused value must be reported at the field; a value the server
 * has always accepted, whitespace included, must not be.
 */

type Case = [label: string, value: unknown];

interface FieldBounds {
    component: ApiComponentName;
    /** Path of the field from the body root, e.g. `files/0/name`. */
    field: string;
    refused: Case[];
    accepted: Case[];
}

/** The issues reported at `field` when `value` is placed there, in an otherwise empty body. */
function issuesAt(component: ApiComponentName, field: string, value: unknown) {
    const keys = field.split('/');
    const body: Record<string, unknown> = {};
    let target: Record<string, unknown> | unknown[] = body;
    keys.forEach((key, index) => {
        const last = index === keys.length - 1;
        const next = last ? value : /^\d+$/.test(keys[index + 1]) ? [] : {};
        if (Array.isArray(target)) target[Number(key)] = next;
        else target[key] = next;
        target = next as Record<string, unknown> | unknown[];
    });
    const result = validateApiRequest(component, body);
    return result.valid ? [] : result.issues.filter((issue) => issue.path === `/${field}`);
}

const nonEmpty = (component: ApiComponentName, field: string): FieldBounds => ({
    component,
    field,
    refused: [['an empty string', '']],
    accepted: [
        ['a value', 'value'],
        ['whitespace', '  '],
    ],
});

const nonBlank = (component: ApiComponentName, field: string): FieldBounds => ({
    component,
    field,
    refused: [
        ['an empty string', ''],
        ['whitespace', ' \t '],
    ],
    accepted: [
        ['a value', 'value'],
        ['a value with surrounding whitespace', ' value '],
    ],
});

const nonEmptyList = (component: ApiComponentName, field: string, item: unknown): FieldBounds => ({
    component,
    field,
    refused: [['an empty list', []]],
    accepted: [['one item', [item]]],
});

const bounds: FieldBounds[] = [
    // Apps
    nonEmpty('AppManifestData', 'name'),
    nonEmpty('UpdateAppPayload', 'name'),
    nonEmpty('ValidateUrlRequest', 'url'),
    nonBlank('UpsertAppVersionRequest', 'app_id'),
    nonBlank('UpsertAppVersionRequest', 'version_id'),
    nonBlank('CreateAppRepoBranchRequest', 'name'),
    nonBlank('CreateAppRepoBranchRequest', 'source_ref'),
    nonBlank('AppRepoFileQuery', 'path'),
    ...(['UpdateAppInstallationToolAllowlistPayload', 'UpdateAppInstallationToolPermissionsPayload'] as const).map(
        (component): FieldBounds => ({
            component,
            field: 'tool_allowlist',
            refused: [['an empty list', []]],
            accepted: [
                ['null, for no restriction', null],
                ['one tool', ['search']],
            ],
        }),
    ),
    {
        // Clearing the tools that need approval is an empty list, and stays allowed.
        component: 'UpdateAppInstallationToolPermissionsPayload',
        field: 'tools_requiring_approval',
        refused: [],
        accepted: [
            ['an empty list', []],
            ['null', null],
        ],
    },
    // Execution and runs
    nonEmpty('NamedInteractionExecutionPayload', 'interaction'),
    nonEmpty('AsyncInteractionExecutionPayload', 'interaction'),
    nonEmpty('AsyncConversationExecutionPayload', 'interaction'),
    nonEmpty('RateLimitRequestPayload', 'interaction'),
    nonEmpty('RunCreatePayload', 'interaction'),
    // Groups, interactions, prompts
    nonEmpty('CreateUserGroupPayload', 'name'),
    nonEmpty('UpdateUserGroupPayload', 'name'),
    nonEmpty('InteractionCreatePayload', 'name'),
    nonEmpty('PromptTemplateCreatePayload', 'name'),
    nonEmpty('PromptTemplateCreatePayload', 'content'),
    // OAuth
    nonEmptyList('CreateOAuthClientPayload', 'redirect_uris', 'https://app.example.com/callback'),
    nonEmptyList('UpdateOAuthClientPayload', 'redirect_uris', 'https://app.example.com/callback'),
    {
        component: 'CreateOAuthProviderPayload',
        field: 'name',
        refused: [
            ['an empty string', ''],
            ['whitespace', '  '],
            ['one character', 'a'],
            ['capitals', 'My-Provider'],
            ['a leading hyphen', '-provider'],
        ],
        accepted: [
            ['a kebab-case name', 'my-provider'],
            ['two characters', 'gh'],
        ],
    },
    nonEmpty('CreateOAuthProviderPayload', 'display_name'),
    nonEmpty('CreateOAuthProviderPayload', 'client_id'),
    {
        // An update writes only what it carries, and keeps accepting what it always did.
        component: 'UpdateOAuthProviderPayload',
        field: 'name',
        refused: [],
        accepted: [
            ['an empty string', ''],
            ['a kebab-case name', 'my-provider'],
        ],
    },
    // Website credentials
    nonBlank('WebsiteCredentialMetadata', 'name'),
    nonEmptyList('WebsiteCredentialMetadata', 'websites', { host: 'example.com' }),
    nonEmptyList('WebsiteCredentialMetadataUpdate', 'websites', { host: 'example.com' }),
    {
        // The update keeps its name unbounded: the server accepts a blank one when no website is sent.
        component: 'WebsiteCredentialMetadataUpdate',
        field: 'name',
        refused: [],
        accepted: [['an empty string', '']],
    },
    // Views
    ...(['CreateViewExperienceRequest', 'UpdateViewExperienceRequest'] as const).flatMap((component) => [
        {
            component,
            field: 'name',
            refused: [
                ['an empty string', ''],
                ['121 characters', 'x'.repeat(121)],
            ],
            accepted: [
                ['a name', 'Contracts'],
                ['whitespace', '  '],
                ['120 characters', 'x'.repeat(120)],
            ],
        } satisfies FieldBounds,
        {
            component,
            field: 'description',
            refused: [
                ['an empty string', ''],
                ['whitespace', '  '],
                ['4001 characters', 'x'.repeat(4001)],
            ],
            accepted: [
                ['a description', 'Browse contracts'],
                ['4000 characters', 'x'.repeat(4000)],
            ],
        } satisfies FieldBounds,
    ]),
    {
        component: 'CreateViewExperienceRequest',
        field: 'id',
        refused: [
            ['an empty string', ''],
            ['whitespace', '  '],
            ['capitals', 'Contracts'],
            ['a trailing hyphen', 'contracts-'],
            ['65 characters', 'x'.repeat(65)],
        ],
        accepted: [
            ['a slug', 'contracts-2026'],
            ['64 characters', 'x'.repeat(64)],
        ],
    },
    // Token requests: exactly the fields the token server checks for each type
    nonEmpty('ApiKeyTokenRequest', 'key'),
    nonEmpty('ProjectTokenRequest', 'project_id'),
    ...(['environment_id', 'environment_name', 'project_id', 'account_id'] as const).map((field) =>
        nonEmpty('EnvironmentTokenRequest', field),
    ),
    ...(['account_id', 'project_id', 'on_behalf_of'] as const).map((field) => nonEmpty('AgentTokenRequest', field)),
    ...(['account_id', 'project_id'] as const).map((field) => nonEmpty('ServiceAccountTokenRequest', field)),
    {
        // Published as required, but the token server never checks it: left unbounded.
        component: 'ProjectTokenRequest',
        field: 'account_id',
        refused: [],
        accepted: [['an empty string', '']],
    },
    // Files
    nonEmpty('FileMetadataQuery', 'file'),
    nonEmpty('SetFileMetadataPayload', 'file'),
    nonEmpty('GetFileUrlPayload', 'file'),
    nonEmpty('CopyFilePayload', 'source'),
    nonEmpty('CopyFilePayload', 'dest'),
    nonEmpty('GetUploadUrlPayload', 'name'),
    nonEmpty('BulkUploadUrlsPayload', 'files/0/name'),
    {
        component: 'BulkUploadUrlsPayload',
        field: 'files',
        refused: [
            ['no files', []],
            ['10,001 files', Array.from({ length: 10_001 }, () => ({ name: 'a.txt' }))],
        ],
        accepted: [['10,000 files', Array.from({ length: 10_000 }, () => ({ name: 'a.txt' }))]],
    },
    // Runs, collections, tasks and definitions
    nonEmpty('CreateAgentRunPayload', 'interaction'),
    ...(['runId', 'workflowId', 'agentName'] as const).map((field) => nonEmpty('RegisterPendingAskRequest', field)),
    nonEmptyList('RegisterPendingAskRequest', 'questions', 'Proceed?'),
    nonEmpty('CreateCollectionPayload', 'name'),
    nonEmptyList('CollectionMembersUpdatePayload', 'members', '000000000000000000000001'),
    nonEmptyList('CollectionChildrenUpdatePayload', 'children', '000000000000000000000001'),
    nonEmpty('CreateProcessDefinitionPayload', 'name'),
    nonEmpty('CreateContentObjectTypePayload', 'name'),
    nonEmpty('UpdateContentObjectTypePayload', 'name'),
    nonEmpty('CreateTaskPayload', 'title'),
    nonEmpty('TaskSource', 'run_id'),
    ...(
        [
            'WorkflowDefinitionPayloadWithSteps',
            'WorkflowDefinitionPayloadWithActivities',
            'UpdateWorkflowDefinitionPayloadWithSteps',
            'UpdateWorkflowDefinitionPayloadWithActivities',
        ] as const
    ).map((component) => nonEmpty(component, 'name')),
    // Data stores and dashboards
    nonEmpty('QueryPayload', 'sql'),
    nonEmpty('DataStoreMutateRowsPayload', 'sql'),
    nonEmpty('DataStoreMutateRowsPayload', 'message'),
    nonEmpty('CreateSnapshotPayload', 'name'),
    nonEmpty('CreateSnapshotPayload', 'message'),
    nonEmpty('CreateTablesPayload', 'message'),
    nonEmpty('UpdateSchemaPayload', 'message'),
    nonEmpty('ImportDataPayload', 'message'),
    nonEmptyList('CreateTablesPayload', 'tables', { name: 't', columns: [{ name: 'id', type: 'STRING' }] }),
    nonEmptyList('AlterTablePayload', 'changes', { op: 'drop_column', column: 'c' }),
    nonEmpty('CreateDashboardPayload', 'name'),
    nonEmpty('UpdateDashboardPayload', 'name'),
    nonEmpty('CreateDashboardSnapshotPayload', 'name'),
    nonEmpty('CreateDashboardSnapshotPayload', 'message'),
    // Page windows, each as its route reads it
    ...(['limit', 'offset'] as const).map(
        (field): FieldBounds => ({
            component: 'InteractionListQuery',
            field,
            refused: [
                ['a fraction', 1.5],
                ['an unsafe integer', 2 ** 53],
                ['a negative number', -1],
                ...(field === 'limit' ? ([['0', 0]] as Case[]) : []),
            ],
            accepted: [
                ['1', 1],
                ['the largest safe integer', Number.MAX_SAFE_INTEGER],
                ...(field === 'offset' ? ([['0', 0]] as Case[]) : []),
            ],
        }),
    ),
    ...(['ListOAuthGrantsQuery', 'SearchAgentRunsQuery', 'ComplexSearchPayload'] as const).flatMap((component) =>
        (['limit', 'offset'] as const).map(
            (field): FieldBounds => ({
                component,
                field,
                // Fractions are truncated and large values clamped or refused by the handler, so only the sign is
                // published.
                refused: [
                    ['a negative number', -1],
                    ['a negative fraction', -0.5],
                ],
                accepted: [
                    ['0', 0],
                    ['a fraction', 2.5],
                    ['a large number', 1e9],
                ],
            }),
        ),
    ),
    ...(['ExecuteViewRequest', 'PreviewViewExperienceRequest'] as const).flatMap((component): FieldBounds[] => [
        {
            component,
            field: 'limit',
            refused: [
                ['0', 0],
                ['201', 201],
                ['a fraction', 1.5],
            ],
            accepted: [
                ['1', 1],
                ['200', 200],
            ],
        },
        {
            component,
            field: 'offset',
            refused: [
                ['a negative number', -1],
                ['50,001', 50_001],
                ['a fraction', 2.5],
            ],
            accepted: [
                ['0', 0],
                ['50,000', 50_000],
            ],
        },
    ]),
    {
        component: 'UpdateViewExperienceRequest',
        field: 'revision',
        refused: [
            ['0', 0],
            ['a fraction', 1.5],
        ],
        accepted: [
            ['1', 1],
            ['a large revision', 2 ** 40],
        ],
    },
    // Components that share these fields with routes that ignore them keep accepting any number.
    ...(
        [
            ['InteractionSearchQuery', 'limit'],
            ['ComputeInteractionFacetPayload', 'query/limit'],
            ['BulkRevokeOAuthGrantsPayload', 'offset'],
            ['ComplexSearchQuery', 'limit'],
            ['ComputeObjectFacetPayload', 'query/offset'],
        ] as const
    ).map(
        ([component, field]): FieldBounds => ({
            component,
            field,
            refused: [],
            accepted: [
                ['a negative number', -1],
                ['a fraction', 1.5],
            ],
        }),
    ),
];

/**
 * The same paths without a schema in the way: some components are unions or derived, so a mistyped field
 * would report nothing and look accepted. Each refused case above proves its path is real; the components
 * whose cases only accept are checked here instead.
 */
const declaredFields: Array<[ApiComponentName, string]> = [
    ['UpdateAppInstallationToolPermissionsPayload', 'tools_requiring_approval'],
    ['UpdateOAuthProviderPayload', 'name'],
    ['WebsiteCredentialMetadataUpdate', 'name'],
    ['ProjectTokenRequest', 'account_id'],
    ['InteractionSearchQuery', 'limit'],
    ['ComputeInteractionFacetPayload', 'query/limit'],
    ['BulkRevokeOAuthGrantsPayload', 'offset'],
    ['ComplexSearchQuery', 'limit'],
    ['ComputeObjectFacetPayload', 'query/offset'],
];

describe.each(bounds)('$component $field', ({ component, field, refused, accepted }) => {
    if (refused.length > 0) {
        it.each(refused)('refuses %s', (_label, value) => {
            expect(issuesAt(component, field, value)).not.toEqual([]);
        });
    }
    it.each(accepted)('accepts %s', (_label, value) => {
        expect(issuesAt(component, field, value)).toEqual([]);
    });
});

// A value of the wrong type is reported at a declared field, a string field refusing a number and a number field a
// string. An undeclared one is reported at the body instead.
it.each(declaredFields)('%s declares %s', (component, field) => {
    expect([...issuesAt(component, field, 42), ...issuesAt(component, field, 'x')]).not.toEqual([]);
});
