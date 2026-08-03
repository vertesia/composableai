import { describe, expect, it } from 'vitest';
import { type JsonObject, toOpenApiComponents } from './adapter.js';
import { normalizeParameters } from './parameters.js';
import { ApiSchemaComponents, normalizeApiParameters, validateApiRequest } from './registry.js';

/**
 * Fixtures are LOCAL rather than added to the registry, on purpose. `ApiSchemaComponents` is what the
 * OpenAPI document publishes, so registering a component to exercise a coercion rule would put it in
 * the spec. Everything below drives the pure normalizer against hand-built components; the two tests
 * at the bottom then bind to the real registry to prove the published component is the one used.
 */
const COMPONENTS: Record<string, JsonObject> = toOpenApiComponents(
    {
        Params: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                limit: { type: 'integer' },
                ratio: { type: 'number' },
                enabled: { type: 'boolean' },
                level: { type: 'string', enum: ['account', 'project'] },
                tags: { type: 'array', items: { type: 'string' } },
                ids: { type: 'array', items: { type: 'integer' } },
                // What zod emits for `z.union([z.string(), z.array(z.string())])`, and what the scanner
                // publishes as a single `type: array` parameter with `explode: true`.
                single_or_many: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
                statuses: { type: 'array', items: { $ref: '#/components/schemas/Status' } },
                // The same union shape as `single_or_many`, over an enum: what `ListTasksQuery`
                // declares for `status`.
                status_or_many: {
                    anyOf: [
                        { $ref: '#/components/schemas/Status' },
                        { type: 'array', items: { $ref: '#/components/schemas/Status' } },
                    ],
                },
                // An enum with a comma inside a member, which is what makes splitting ambiguous.
                separators: { type: 'array', items: { type: 'string', enum: ['a,b', 'c'] } },
                nullable_count: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                listed_type: { type: ['integer', 'null'] },
                freeform: {},
                status: { $ref: '#/components/schemas/Status' },
            },
            required: ['name'],
        },
        Status: { type: 'string', enum: ['on', 'off'] },
        Headers: {
            type: 'object',
            properties: { 'X-Request-Id': { type: 'string' }, 'x-retry-count': { type: 'integer' } },
        },
        NotAnObject: { type: 'string' },
    },
    {},
);

function normalize(raw: Record<string, string | string[] | undefined>, component = 'Params') {
    return normalizeParameters(component, raw, 'query', COMPONENTS[component], COMPONENTS);
}

describe('required and optional values', () => {
    it('omits a parameter that did not arrive, leaving requiredness to the component', () => {
        // The distinction that matters: omitted, not present-as-undefined. Validating `undefined`
        // against `type: string` would report a type error where the contract says "absent".
        expect(normalize({ name: 'acme' }).value).toEqual({ name: 'acme' });
        expect('limit' in normalize({ name: 'acme' }).value).toBe(false);
    });

    it('treats an explicitly undefined transport value as absence too', () => {
        // `ctx.headers` exposes this shape for a header that was not sent.
        expect(normalize({ name: 'acme', limit: undefined }).value).toEqual({ name: 'acme' });
    });

    it('produces an empty object when every declared parameter is optional and none arrived', () => {
        expect(normalizeParameters('Headers', {}, 'query', COMPONENTS.Headers, COMPONENTS).value).toEqual({});
    });

    it('leaves a missing required parameter for the component to reject, rather than inventing a message', () => {
        // The normalizer never rejects: it omits `name` and returns. That the omission is an error is
        // the component's own statement, which keeps one contract in charge of requiredness.
        expect(() => normalize({ limit: '5' })).not.toThrow();
        expect(normalize({ limit: '5' }).value).toEqual({ limit: 5 });
    });

    it('keeps an empty string as a value for a string parameter', () => {
        // `?name=` is a present, empty value. A `type: string` can hold it, so it passes through and
        // the component decides — inventing absence here would let the server read a URL the schema
        // does not describe.
        expect(normalize({ name: '' }).value).toEqual({ name: '' });
    });
});

describe('scalar coercion', () => {
    it.each([
        ['integer', 'limit', '25', 25],
        ['integer with exponent', 'limit', '1e3', 1000],
        ['integer, zero-padded', 'limit', '007', 7],
        ['negative integer', 'limit', '-3', -3],
        ['number', 'ratio', '1.5', 1.5],
        ['number, leading dot', 'ratio', '.5', 0.5],
        ['number, explicit plus', 'ratio', '+2', 2],
        ['boolean true', 'enabled', 'true', true],
        ['boolean false', 'enabled', 'false', false],
        ['boolean spelled as 1', 'enabled', '1', true],
        ['boolean spelled as 0', 'enabled', '0', false],
        ['string is untouched', 'name', '25', '25'],
        ['enum is untouched', 'level', 'account', 'account'],
        ['a schema with no type is untouched', 'freeform', 'anything', 'anything'],
    ])('coerces %s', (_label, key, raw, expected) => {
        expect(normalize({ [key]: raw }).value[key]).toBe(expected);
    });

    it('coerces through a $ref to a hoisted enum', () => {
        // Reached through the adapter's own reference resolution, so what is coerced towards and what
        // the spec publishes are read off the same node.
        expect(normalize({ status: 'on' }).value.status).toBe('on');
    });

    it.each([
        ['a nullable integer union', 'nullable_count'],
        ['a type list containing null', 'listed_type'],
    ])('coerces %s as its non-null type', (_label, key) => {
        expect(normalize({ [key]: '4' }).value[key]).toBe(4);
    });
});

describe('invalid coercion is left for the component to report', () => {
    it.each([
        ['non-numeric text', 'limit', 'abc'],
        ['an empty value for a number', 'limit', ''],
        ['whitespace around a number', 'limit', ' 1'],
        ['hex', 'limit', '0x10'],
        ['Infinity', 'ratio', 'Infinity'],
        ['NaN', 'ratio', 'NaN'],
        ['a trailing exponent', 'limit', '1e'],
        ['a boolean spelled as yes', 'enabled', 'yes'],
        ['an empty value for a boolean', 'enabled', ''],
        ['a capitalised boolean', 'enabled', 'True'],
    ])('leaves %s as the original text', (_label, key, raw) => {
        const { value } = normalize({ name: 'acme', [key]: raw });
        // Left as text rather than coerced to NaN or a guess: the component then reports a type error
        // naming this parameter, which is a better message than anything invented here.
        expect(value[key]).toBe(raw);
    });

    it('does not truncate a non-integral value for an integer parameter', () => {
        // Coerced to a number and handed on, so `type: integer` rejects it. `parseInt` would have
        // silently produced 1 and accepted a request the document says is invalid.
        expect(normalize({ name: 'a', limit: '1.5' }).value.limit).toBe(1.5);
    });
});

describe('arrays and repeated values', () => {
    it('wraps a single occurrence, matching the published explode: true', () => {
        expect(normalize({ name: 'a', tags: 'x' }).value.tags).toEqual(['x']);
    });

    it('collects repeated occurrences in arrival order', () => {
        expect(normalize({ name: 'a', tags: ['x', 'y'] }).value.tags).toEqual(['x', 'y']);
    });

    it('coerces each item', () => {
        expect(normalize({ name: 'a', ids: ['1', '2'] }).value.ids).toEqual([1, 2]);
    });

    it('leaves an uncoercible item in place rather than dropping it', () => {
        // Dropping would silently shorten the array; the component reports the bad item by index.
        expect(normalize({ name: 'a', ids: ['1', 'x'] }).value.ids).toEqual([1, 'x']);
    });

    it('reads a string-or-array union as an array, the shape the spec publishes', () => {
        // The scanner collapses this union into one `type: array` parameter with `explode: true`, so
        // reading the scalar variant would hand the handler a bare string where the spec promised an
        // array.
        expect(normalize({ name: 'a', single_or_many: 'x' }).value.single_or_many).toEqual(['x']);
        expect(normalize({ name: 'a', single_or_many: ['x', 'y'] }).value.single_or_many).toEqual(['x', 'y']);
    });

    it('hands repeated occurrences of a single-valued parameter on as an array, so the component rejects them', () => {
        // `?level=account&level=project` is ambiguous and nothing published says which wins. Passing the
        // array through makes the component report a type error instead of the server silently picking
        // one — which is what several hand-written handlers do today.
        expect(normalize({ name: 'a', level: ['account', 'project'] }).value.level).toEqual(['account', 'project']);
    });
});

/**
 * Comma-splitting applies to every array parameter, not only to enums.
 *
 * `explode: true` — what the document publishes — describes repeated keys and says nothing about
 * commas, so this is something the server accepts BEYOND what it promises. It does so because
 * `@vertesia/client` joins every array parameter with `,`, which means every SDK in the field sends
 * the comma form, and because it is what all the hand-written readers this layer replaced already
 * did: `readArray`, `parseTagsFilter`, `parseSourcesQuery`, and the agent-run search's `sort`,
 * `tags` and `categories`.
 */
describe('comma-joined values, for an array parameter', () => {
    it('splits a plain string array, which is what most filters are', () => {
        // The regression this pins: with splitting limited to enums, `@vertesia/client`'s
        // `sort: ['lol:sideways', 'started_at:desc']` arrived as ONE clause `lol:sideways,started_at:desc`,
        // so the agent-run search sorted on an unmapped field and returned an arbitrary order.
        expect(normalize({ name: 'a', tags: 'x,y' }).value.tags).toEqual(['x', 'y']);
    });

    it('splits one occurrence into several values', () => {
        expect(normalize({ name: 'a', statuses: 'on,off' }).value.statuses).toEqual(['on', 'off']);
    });

    it('splits through the single-or-many union, which is how ListTasksQuery declares status', () => {
        expect(normalize({ name: 'a', status_or_many: 'on,off' }).value.status_or_many).toEqual(['on', 'off']);
        expect(normalize({ name: 'a', status_or_many: 'on' }).value.status_or_many).toEqual(['on']);
    });

    it('composes with repetition rather than replacing it', () => {
        // Both spellings mean the same list, so mixing them is not a third case to decide.
        expect(normalize({ name: 'a', statuses: ['on,off', 'on'] }).value.statuses).toEqual(['on', 'off', 'on']);
    });

    it('leaves an unknown member in place for the enum to reject', () => {
        // Not dropped: the component reports `bogus` by index, so the caller learns which value was
        // wrong rather than getting a silently shorter filter.
        expect(normalize({ name: 'a', statuses: 'on,bogus' }).value.statuses).toEqual(['on', 'bogus']);
    });

    it('cannot express a value that contains a comma — the cost of the rule above', () => {
        // `'a,b'` is a declared member of this enum, and it is now unreachable: the caller has no way
        // to escape the separator. Pinned rather than fixed because it is not a new limit — every
        // reader this layer replaced split unconditionally — and because no published parameter has
        // a comma-bearing member today. It is the reason a parameter whose values may legitimately
        // contain commas must not be declared as an array of plain strings.
        expect(normalize({ name: 'a', separators: 'a,b' }).value.separators).toEqual(['a', 'b']);
    });
});

describe('undeclared parameters', () => {
    it('reports undeclared query keys without removing or rejecting anything', () => {
        const { value, undeclared } = normalize({ name: 'a', sort: 'asc', page: '2' });
        expect(undeclared).toEqual(['sort', 'page']);
        // Not in the validated copy, so the component never sees them: whether they are an error is
        // the endpoint's policy, not the component's.
        expect(value).toEqual({ name: 'a' });
    });

    it('reports nothing when every key is declared', () => {
        expect(normalize({ name: 'a', limit: '1' }).undeclared).toEqual([]);
    });

    it('does not report a declared key that arrived as undefined', () => {
        expect(normalize({ name: 'a', limit: undefined }).undeclared).toEqual([]);
    });

    it('never reports undeclared headers, however many arrive', () => {
        // Structural, not a policy: every request carries headers no endpoint declares, so a caller
        // that rejected on this list could only ever reject correct requests.
        const { undeclared } = normalizeParameters(
            'Headers',
            { accept: '*/*', 'user-agent': 'curl/8', 'x-datadog-trace-id': '1', authorization: 'Bearer x' },
            'header',
            COMPONENTS.Headers,
            COMPONENTS,
        );
        expect(undeclared).toEqual([]);
    });
});

describe('header name casing', () => {
    function headers(raw: Record<string, string | string[] | undefined>) {
        return normalizeParameters('Headers', raw, 'header', COMPONENTS.Headers, COMPONENTS);
    }

    it('matches a declared mixed-case name against the lowercased name Node delivers', () => {
        // HTTP field names are case-insensitive and Node has already lowercased them, so a component
        // spelling `X-Request-Id` would never match a real request without this.
        expect(headers({ 'x-request-id': 'abc' }).value).toEqual({ 'X-Request-Id': 'abc' });
    });

    it('keys the copy by the declared spelling, which is what the component validates', () => {
        expect(Object.keys(headers({ 'x-request-id': 'abc' }).value)).toEqual(['X-Request-Id']);
    });

    it('coerces a lowercase-declared header too', () => {
        expect(headers({ 'x-retry-count': '2' }).value['x-retry-count']).toBe(2);
    });

    it('does not case-fold query names, where case is significant', () => {
        // Query parameter names are octet-exact; folding them would make `?Name=` and `?name=` the
        // same parameter, which no part of the document says.
        const { value, undeclared } = normalize({ Name: 'a' });
        expect(value).toEqual({});
        expect(undeclared).toEqual(['Name']);
    });
});

describe('the request is never mutated', () => {
    it('leaves the raw object untouched, including values it coerced', () => {
        // Koa memoizes `ctx.query` per query string and hands the same object to every later reader,
        // so coercing in place would retype values for middleware that never opted in.
        const raw = { name: 'acme', limit: '25', enabled: 'true', tags: 'x' };
        const snapshot = structuredClone(raw);
        const { value } = normalize(raw);
        expect(raw).toEqual(snapshot);
        expect(value).not.toBe(raw);
        expect(value.limit).toBe(25);
    });

    it('does not alias an array value into the copy', () => {
        const tags = ['x', 'y'];
        const { value } = normalize({ name: 'a', tags });
        expect(value.tags).not.toBe(tags);
        expect(tags).toEqual(['x', 'y']);
    });
});

describe('declaration errors', () => {
    it('refuses a component that is not an object schema', () => {
        // Cannot be expanded into named parameters, and the scanner would not publish one either.
        // Failing is the only honest option: reaching the handler with an unchecked query while the
        // spec advertises a checked one is the drift this whole arrangement exists to prevent.
        expect(() => normalize({}, 'NotAnObject')).toThrow(/not an object schema with properties/);
    });

    it('refuses a component that does not exist', () => {
        expect(() => normalizeParameters('Missing', {}, 'query', undefined, COMPONENTS)).toThrow(
            /not an object schema with properties/,
        );
    });
});

describe('inherited members are not read as parameters', () => {
    it('ignores a prototype member with a declared name', () => {
        // A `hasOwn` check rather than a truthiness test: without it a component declaring `toString`
        // would receive a function.
        const components: Record<string, JsonObject> = {
            Proto: { type: 'object', properties: { toString: { type: 'string' } } },
        };
        expect(normalizeParameters('Proto', {}, 'query', components.Proto, components).value).toEqual({});
    });
});

describe('bound to the published registry', () => {
    it('normalizes against the same component object the document publishes', () => {
        // The property this slice exists for: one declaration drives the published parameter and the
        // runtime check. `ApiKeyListQuery` is the component `ListApiKeys` declares.
        expect(normalizeApiParameters('ApiKeyListQuery', { level: 'account' }, 'query').value).toEqual({
            level: 'account',
        });
        expect(ApiSchemaComponents.ApiKeyListQuery.properties).toMatchObject({
            level: { enum: ['account', 'project'] },
        });
    });

    it('produces a copy the registry validator accepts, and rejects a value outside the enum', () => {
        // End to end through the real validators, which is what the enforcer runs.
        const good = normalizeApiParameters('ApiKeyListQuery', { level: 'project' }, 'query');
        expect(validateApiRequest('ApiKeyListQuery', good.value)).toMatchObject({ valid: true });

        const bad = normalizeApiParameters('ApiKeyListQuery', { level: 'bogus' }, 'query');
        expect(validateApiRequest('ApiKeyListQuery', bad.value)).toMatchObject({ valid: false });
    });

    it('accepts an absent optional parameter', () => {
        const empty = normalizeApiParameters('ApiKeyListQuery', {}, 'query');
        expect(empty.value).toEqual({});
        expect(validateApiRequest('ApiKeyListQuery', empty.value)).toMatchObject({ valid: true });
    });

    /**
     * `GET /tasks` is the endpoint the enum rule exists for. `TaskApi.list` builds its status
     * parameter as `query.status.join(',')`, so every SDK in the field sends the comma form; these
     * assertions are what stops enforcement from turning our own client's multi-status listing into
     * a 400.
     */
    it('accepts every spelling of the ListTasksQuery status parameter', () => {
        for (const raw of ['pending,completed', ['pending', 'completed'], ['pending,completed']]) {
            const { value } = normalizeApiParameters('ListTasksQuery', { status: raw }, 'query');
            expect(value.status).toEqual(['pending', 'completed']);
            expect(validateApiRequest('ListTasksQuery', value)).toMatchObject({ valid: true });
        }
    });

    it('coerces the ListTasksQuery paging parameters, and rejects text that is not a number', () => {
        const good = normalizeApiParameters('ListTasksQuery', { limit: '25', offset: '50' }, 'query');
        expect(good.value).toEqual({ limit: 25, offset: 50 });
        expect(validateApiRequest('ListTasksQuery', good.value)).toMatchObject({ valid: true });

        // `parseInt('abc')` reached Mongo as `NaN` before this, which disabled the page size cap.
        const bad = normalizeApiParameters('ListTasksQuery', { limit: 'abc' }, 'query');
        expect(validateApiRequest('ListTasksQuery', bad.value)).toMatchObject({ valid: false });
    });

    it('rejects a status outside the published enum', () => {
        const { value } = normalizeApiParameters('ListTasksQuery', { status: 'pending,bogus' }, 'query');
        expect(validateApiRequest('ListTasksQuery', value)).toMatchObject({ valid: false });
    });

    it('leaves an undeclared ListTasksQuery parameter out of the validated copy rather than rejecting', () => {
        // `GET /tasks` does not set `rejectUndeclaredQuery`, so a stale `?sort=` keeps working. The
        // undeclared list is reported for the endpoint to act on; the component never sees the key.
        const { value, undeclared } = normalizeApiParameters('ListTasksQuery', { sort: 'asc' }, 'query');
        expect(undeclared).toEqual(['sort']);
        expect(value).toEqual({});
        expect(validateApiRequest('ListTasksQuery', value)).toMatchObject({ valid: true });
    });
});
