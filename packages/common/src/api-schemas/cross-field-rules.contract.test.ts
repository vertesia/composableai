import { describe, expect, it } from 'vitest';
import { type ApiComponentName, validateApiRequest } from './registry.js';

const spec = { mark: 'bar' };

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
];

describe.each(rules)('%s %s', (component, _rule, cases) => {
    it.each(cases)('%s: valid is %s', (_case, body, valid) => {
        const result = validateApiRequest(component, body);

        expect(result.valid, JSON.stringify(result.valid ? null : result.issues)).toBe(valid);
    });
});
