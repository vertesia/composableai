import { describe, expect, it } from 'vitest';
import { type ApiComponentName, validateApiRequest } from './registry.js';

const spec = { mark: 'bar' };
const source = { type: 'agent', run_id: 'r' };
const scenarios = [
    { id: 's', name: 's', initial_context: {}, actors: [], fixtures: [], human_actions: [], assertions: {} },
];

// Rules that span several fields are published as `if`/`then`, which validators enforce and SDK generators
// ignore, so each generated model keeps its plain fields. Each table pins the accepted and refused bodies.
const rules: Array<[ApiComponentName, string, Array<[string, unknown, boolean]>]> = [
    [
        'CreateDashboardPayload',
        'needs a non-empty SQL query, top-level or in its data source',
        [
            ['a top-level query', { name: 'd', spec, query: 'SELECT 1' }, true],
            ['a data source query', { name: 'd', spec, dataSource: { kind: 'data_sql', query: 'SELECT 1' } }, true],
            ['a whitespace query', { name: 'd', spec, query: ' ' }, true],
            ['no query at all', { name: 'd', spec }, false],
            ['an empty top-level query', { name: 'd', spec, query: '' }, false],
            ['an empty data source query', { name: 'd', spec, dataSource: { kind: 'data_sql', query: '' } }, false],
            // The top-level query replaces the data source's, so the empty one is what would be stored.
            [
                'an empty top-level query beside a data source',
                { name: 'd', spec, query: '', dataSource: { kind: 'data_sql', query: 'SELECT 1' } },
                false,
            ],
        ],
    ],
    [
        'UpdateDashboardPayload',
        'keeps every field optional',
        [
            ['an empty update', {}, true],
            ['an empty query', { query: '' }, true],
        ],
    ],
    [
        'DashboardBulkIdsPayload',
        'needs at least one dashboard ID',
        [
            ['one ID', { ids: ['0123456789abcdef01234567'] }, true],
            ['an ID that is not an ObjectId', { ids: ['0123456789abcdef01234567', 'd'] }, false],
            ['a whitespace ID', { ids: [' '] }, false],
            ['no IDs', {}, false],
            ['an empty list', { ids: [] }, false],
            ['IDs under another key', { other: ['d'] }, false],
        ],
    ],
    [
        'CreateContentObjectPayload',
        'needs a name of its own or one to derive from the content',
        [
            ['a name', { name: 'n' }, true],
            ['a content name', { content: { name: 'n' } }, true],
            ['a content source', { content: { source: 'gs://bucket/file.pdf', type: 'application/pdf' } }, true],
            ['a whitespace name', { name: ' ' }, true],
            ['nothing to name it', {}, false],
            ['an empty name', { name: '' }, false],
            ['content with neither name nor source', { content: { type: 'text/plain' } }, false],
            ['an empty content name and source', { name: '', content: { name: '', source: '' } }, false],
        ],
    ],
    [
        'BulkOperationPayload',
        'needs objects to create',
        [
            ['a create with one object', { name: 'create', ids: [], params: { objects: [{ name: 'n' }] } }, true],
            ['a delete without objects', { name: 'delete', ids: [], params: {} }, true],
            ['a create without objects', { name: 'create', ids: [], params: {} }, false],
            ['a create with no objects', { name: 'create', ids: [], params: { objects: [] } }, false],
            ['a create whose objects are not a list', { name: 'create', ids: [], params: { objects: {} } }, false],
            [
                'a create with too many objects',
                { name: 'create', ids: [], params: { objects: Array.from({ length: 10_001 }, () => ({})) } },
                false,
            ],
        ],
    ],
    [
        'CreateTaskPayload',
        'needs named fields, each default of the field type, and options for a select',
        [
            ['a text default', { title: 't', source, fields: [{ name: 'f', type: 'text', default: 'x' }] }, true],
            ['a number default', { title: 't', source, fields: [{ name: 'f', type: 'number', default: 1 }] }, true],
            ['no default', { title: 't', source, fields: [{ name: 'f', type: 'boolean' }] }, true],
            [
                'a select with options',
                { title: 't', source, fields: [{ name: 'f', type: 'select', options: ['a'], default: 'a' }] },
                true,
            ],
            [
                'an object text default',
                { title: 't', source, fields: [{ name: 'f', type: 'text', default: {} }] },
                false,
            ],
            ['a null default', { title: 't', source, fields: [{ name: 'f', type: 'string', default: null }] }, false],
            [
                'a list number default',
                { title: 't', source, fields: [{ name: 'f', type: 'number', default: [] }] },
                false,
            ],
            ['a select without options', { title: 't', source, fields: [{ name: 'f', type: 'select' }] }, false],
            ['an unnamed field', { title: 't', source, fields: [{ name: '', type: 'text' }] }, false],
        ],
    ],
    [
        'UpdateTaskPayload',
        'needs a non-empty title, named fields and typed field defaults',
        [
            ['a title', { title: 't' }, true],
            ['an empty title', { title: '' }, false],
            ['a text default on a number field', { fields: [{ name: 'f', type: 'number', default: 'x' }] }, false],
            ['an unnamed field', { fields: [{ name: '', type: 'text' }] }, false],
        ],
    ],
    [
        'CreateAgentRunPayload',
        'needs a content type name when one is linked',
        [
            [
                'a named content type',
                { interaction: 'i', content_type: { ref_type: 'stored', id: 'x', name: 'n' } },
                true,
            ],
            [
                'an unnamed content type',
                { interaction: 'i', content_type: { ref_type: 'stored', id: 'x', name: '' } },
                false,
            ],
        ],
    ],
    [
        'SubmitProcessTestRunPayload',
        'needs an in-code process id, and app_version only for an app id',
        [
            ['a sys id', { process: { id: 'sys:noop' }, scenarios }, true],
            ['an app id with a version', { process: { id: 'app:a:p', app_version: '1' }, scenarios }, true],
            ['a stored ObjectId', { process: { id: '000000000000000000000000' }, scenarios }, false],
            ['an empty id', { process: { id: '' }, scenarios }, false],
            ['a sys id with a version', { process: { id: 'sys:noop', app_version: '1' }, scenarios }, false],
        ],
    ],
    [
        'ContentQueryPayload',
        'needs exactly one query',
        [
            ['sql', { sql: 'SELECT 1' }, true],
            ['esql', { esql: 'FROM x' }, true],
            ['dsl', { dsl: {} }, true],
            ['sql beside an empty esql', { sql: 'SELECT 1', esql: '' }, true],
            ['no query', {}, false],
            ['only empty queries', { sql: '', esql: '' }, false],
            ['sql and esql', { sql: 'SELECT 1', esql: 'FROM x' }, false],
            ['sql and dsl', { sql: 'SELECT 1', dsl: {} }, false],
            ['esql and dsl', { esql: 'FROM x', dsl: {} }, false],
        ],
    ],
    [
        'CostRunPriceQuery',
        'needs a run identifier',
        [
            ['a run id', { run_id: 'run' }, true],
            ['a workflow run id beside an empty run id', { run_id: '', workflow_run_id: 'run' }, true],
            ['a whitespace agent run id', { agent_run_id: ' ' }, true],
            ['no identifier', {}, false],
            ['only empty identifiers', { run_id: '', agent_run_id: '', workflow_id: '', workflow_run_id: '' }, false],
            ['only a project', { project_id: 'p' }, false],
        ],
    ],
];

describe.each(rules)('%s %s', (component, _rule, cases) => {
    it.each(cases)('%s: valid is %s', (_case, body, valid) => {
        const result = validateApiRequest(component, body);

        expect(result.valid, JSON.stringify(result.valid ? null : result.issues)).toBe(valid);
    });
});
