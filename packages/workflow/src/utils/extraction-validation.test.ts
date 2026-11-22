import { describe, expect, it, vi } from 'vitest';
import {
    buildRepairInstructions,
    canonicalToken,
    findDerivationGaps,
    normalizeDate,
    normalizeDateTime,
    normalizeExtractedProperties,
    schemaForFields,
    validateAndRepairExtraction,
} from './extraction-validation.js';

const AGREEMENT_SCHEMA = {
    type: 'object',
    properties: {
        agreement_type: { type: 'string', enum: ['reimbursable', 'non_reimbursable', 'funded'] },
        agreement_number: {
            type: 'string',
            pattern: '^\\d{5}$',
            description: 'The agreement number, digits only.',
        },
        signature_date: { type: 'string', format: 'date', description: 'Date of the last signature.' },
        effective_date: {
            type: 'string',
            format: 'date',
            description: 'Effective date. If not stated, the signature date.',
        },
        term: { type: 'string', description: 'Duration of the agreement, such as "5 years".' },
        expiration_date: {
            type: 'string',
            format: 'date',
            description: 'Expiration date. If not stated, the effective date plus the term.',
        },
        value: { type: 'number' },
        partners: { type: 'array', items: { type: 'string' } },
    },
};

describe('canonicalToken', () => {
    it('ignores case, separators, whitespace and accents', () => {
        expect(canonicalToken('Non-Reimbursable')).toBe('nonreimbursable');
        expect(canonicalToken(' non_reimbursable ')).toBe('nonreimbursable');
        expect(canonicalToken('Résumé')).toBe('resume');
    });
});

describe('normalizeDate', () => {
    it.each([
        ['2025-09-10', '2025-09-10'],
        ['2025-9-1', '2025-09-01'],
        ['2025-09-10T14:00:00Z', '2025-09-10'],
        ['2025/09/10', '2025-09-10'],
        ['September 10, 2025', '2025-09-10'],
        ['Sept. 10th 2025', '2025-09-10'],
        ['Wednesday, September 10, 2025', '2025-09-10'],
        ['10 September 2025', '2025-09-10'],
        ['10th of Sep 2025', '2025-09-10'],
        ['25/09/2025', '2025-09-25'],
        ['09/25/2025', '2025-09-25'],
        ['05/05/2025', '2025-05-05'],
    ])('reads %s as %s', (input, expected) => {
        expect(normalizeDate(input)).toEqual({ ok: true, value: expected });
    });

    it('refuses an ambiguous day/month order instead of guessing', () => {
        const result = normalizeDate('9/10/2025');
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toContain('ambiguous');
    });

    it.each(['2025-02-30', 'soon', 'Marketing 10, 2025', '2025'])('rejects %s', (input) => {
        expect(normalizeDate(input).ok).toBe(false);
    });
});

describe('normalizeDateTime', () => {
    it('completes a date-time to RFC 3339', () => {
        expect(normalizeDateTime('2025-09-10 14:30')).toEqual({ ok: true, value: '2025-09-10T14:30:00Z' });
        expect(normalizeDateTime('2025-09-10T14:30:05+0200')).toEqual({
            ok: true,
            value: '2025-09-10T14:30:05+02:00',
        });
        expect(normalizeDateTime('2025-09-10')).toEqual({ ok: true, value: '2025-09-10T00:00:00Z' });
        expect(normalizeDateTime('2025-09-10T14:30:00.123Z')).toEqual({
            ok: true,
            value: '2025-09-10T14:30:00.123Z',
        });
    });

    it('rejects text that is not a date-time', () => {
        expect(normalizeDateTime('yesterday').ok).toBe(false);
    });
});

describe('normalizeExtractedProperties', () => {
    it('rewrites an enum near-miss to the allowed value and reports it', () => {
        const result = normalizeExtractedProperties({ agreement_type: 'nonreimbursable' }, AGREEMENT_SCHEMA);
        expect(result.value).toEqual({ agreement_type: 'non_reimbursable' });
        expect(result.normalized).toEqual([{ path: 'agreement_type', rule: 'enum' }]);
        expect(result.invalid).toEqual([]);
    });

    it('omits and reports an enum value that matches no allowed value', () => {
        const result = normalizeExtractedProperties({ agreement_type: 'grant' }, AGREEMENT_SCHEMA);
        expect(result.value).toEqual({});
        expect(result.invalid).toEqual([
            {
                path: 'agreement_type',
                field: 'agreement_type',
                value: 'grant',
                error: expect.stringContaining('"non_reimbursable"'),
            },
        ]);
    });

    it('does not pick between two enum values that only differ by separators', () => {
        const schema = { type: 'object', properties: { code: { type: 'string', enum: ['a-b', 'a_b'] } } };
        const result = normalizeExtractedProperties({ code: 'AB' }, schema);
        expect(result.invalid).toHaveLength(1);
    });

    it('stores every empty value the same way: omitted', () => {
        const result = normalizeExtractedProperties(
            {
                agreement_type: null,
                agreement_number: '',
                term: '   ',
                signature_date: 'N/A',
                partners: [],
                value: null,
                extra: { nested: '' },
            },
            AGREEMENT_SCHEMA,
        );
        expect(result.value).toEqual({});
        expect(result.invalid).toEqual([]);
        expect(result.normalized).toEqual([]);
    });

    it('keeps an allowed enum value that looks like a placeholder', () => {
        const schema = { type: 'object', properties: { status: { type: 'string', enum: ['N/A', 'open'] } } };
        expect(normalizeExtractedProperties({ status: 'n/a' }, schema).value).toEqual({ status: 'N/A' });
    });

    it('keeps the one identifier matching the pattern out of a longer phrase', () => {
        const result = normalizeExtractedProperties(
            { agreement_number: 'Space Act Umbrella Agreement No. 37779, dated 9/10/2025' },
            AGREEMENT_SCHEMA,
        );
        expect(result.value).toEqual({ agreement_number: '37779' });
        expect(result.normalized).toEqual([{ path: 'agreement_number', rule: 'pattern' }]);
    });

    it('reports a pattern mismatch with several candidate identifiers', () => {
        const result = normalizeExtractedProperties(
            { agreement_number: 'Agreements 37779 and 37780' },
            AGREEMENT_SCHEMA,
        );
        expect(result.value).toEqual({});
        expect(result.invalid[0]).toMatchObject({
            path: 'agreement_number',
            error: expect.stringContaining('^\\d{5}$'),
        });
    });

    it('normalizes dates, numbers, booleans and single values given for arrays', () => {
        const schema = {
            type: 'object',
            properties: {
                ...AGREEMENT_SCHEMA.properties,
                active: { type: 'boolean' },
                count: { type: 'integer' },
            },
        };
        const result = normalizeExtractedProperties(
            {
                signature_date: 'September 10, 2025',
                value: '$1,250,000.50',
                active: 'Yes',
                count: '12',
                partners: 'Acme Corp',
            },
            schema,
        );
        expect(result.value).toEqual({
            signature_date: '2025-09-10',
            value: 1250000.5,
            active: true,
            count: 12,
            partners: ['Acme Corp'],
        });
        expect(result.normalized.map((entry) => `${entry.path}:${entry.rule}`).sort()).toEqual([
            'active:type',
            'count:type',
            'partners:wrap',
            'signature_date:format',
            'value:type',
        ]);
    });

    it('rejects a non-integer for an integer and a word for a number', () => {
        const schema = { type: 'object', properties: { count: { type: 'integer' }, total: { type: 'number' } } };
        const result = normalizeExtractedProperties({ count: 2.5, total: 'about ten' }, schema);
        expect(result.value).toEqual({});
        expect(result.invalid.map((entry) => entry.path).sort()).toEqual(['count', 'total']);
    });

    it('walks nested objects, arrays, $refs and nullable unions', () => {
        const schema = {
            type: 'object',
            $defs: {
                party: {
                    type: 'object',
                    properties: {
                        role: { type: 'string', enum: ['sponsor', 'partner'] },
                        signed_on: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
                    },
                    additionalProperties: false,
                },
            },
            properties: {
                parties: { type: 'array', items: { $ref: '#/$defs/party' } },
            },
        };
        const result = normalizeExtractedProperties(
            {
                parties: [
                    { role: 'Sponsor', signed_on: '10 Sep 2025', note: 'drop me' },
                    { role: 'observer', signed_on: null },
                    { role: null, signed_on: '' },
                ],
            },
            schema,
        );
        expect(result.value).toEqual({ parties: [{ role: 'sponsor', signed_on: '2025-09-10' }] });
        expect(result.normalized).toEqual([
            { path: 'parties[0].role', rule: 'enum' },
            { path: 'parties[0].signed_on', rule: 'format' },
            { path: 'parties[0].note', rule: 'unknown_property' },
        ]);
        expect(result.invalid).toEqual([
            expect.objectContaining({ path: 'parties[1].role', field: 'parties', value: 'observer' }),
        ]);
    });

    it('accepts values of a nullable type array and a string typed number', () => {
        const schema = { type: 'object', properties: { code: { type: ['string', 'null'] }, n: { type: 'string' } } };
        const result = normalizeExtractedProperties({ code: ' X1 ', n: 42 }, schema);
        expect(result.value).toEqual({ code: 'X1', n: '42' });
        expect(result.normalized).toEqual([{ path: 'n', rule: 'type' }]);
    });

    it('returns an empty object for output that is not an object', () => {
        expect(normalizeExtractedProperties('nope', AGREEMENT_SCHEMA).value).toEqual({});
    });
});

describe('findDerivationGaps', () => {
    it('reports a field left empty whose description derives it from filled fields', () => {
        const gaps = findDerivationGaps({ signature_date: '2025-09-10', term: '5 years' }, AGREEMENT_SCHEMA);
        expect(gaps).toEqual([
            { field: 'effective_date', sources: ['signature_date'] },
            { field: 'expiration_date', sources: ['term'] },
        ]);
    });

    it('reports nothing when the derivation sources are empty too', () => {
        expect(findDerivationGaps({ agreement_type: 'funded' }, AGREEMENT_SCHEMA)).toEqual([]);
    });

    it('reports nothing for filled fields or descriptions without a derivation cue', () => {
        const schema = {
            type: 'object',
            properties: {
                term: { type: 'string' },
                notes: { type: 'string', description: 'Notes about the term.' },
            },
        };
        expect(findDerivationGaps({ term: '5 years' }, schema)).toEqual([]);
    });

    it('honours x-derived-from and skips fields marked x-extract: false', () => {
        const schema = {
            type: 'object',
            properties: {
                start: { type: 'string' },
                months: { type: 'integer' },
                end: { type: 'string', 'x-derived-from': ['start', 'months', 'missing'] },
                erp_end: { type: 'string', 'x-extract': false, description: 'If not stated, start plus months.' },
            },
        };
        expect(findDerivationGaps({ start: '2025-01-01', months: 12 }, schema)).toEqual([
            { field: 'end', sources: ['start', 'months'] },
        ]);
    });

    it('matches a sibling by its title', () => {
        const schema = {
            type: 'object',
            properties: {
                sd: { type: 'string', title: 'Signing date' },
                eff: { type: 'string', description: 'Defaults to the signing date.' },
            },
        };
        expect(findDerivationGaps({ sd: '2025-01-01' }, schema)).toEqual([{ field: 'eff', sources: ['sd'] }]);
    });
});

describe('schemaForFields', () => {
    it('keeps only the requested properties and their required entries', () => {
        const schema = {
            type: 'object',
            $defs: { x: { type: 'string' } },
            properties: { a: { type: 'string' }, b: { $ref: '#/$defs/x' }, c: { type: 'string' } },
            required: ['a', 'c'],
        };
        expect(schemaForFields(schema, ['b', 'c', 'unknown'])).toEqual({
            type: 'object',
            $defs: { x: { type: 'string' } },
            properties: { b: { $ref: '#/$defs/x' }, c: { type: 'string' } },
            required: ['c'],
        });
    });
});

describe('buildRepairInstructions', () => {
    it('names each problem, keeps the type instructions first and gives the known values', () => {
        const text = buildRepairInstructions(
            [{ path: 'agreement_type', field: 'agreement_type', error: '"grant" is not allowed', value: 'grant' }],
            [{ field: 'expiration_date', sources: ['effective_date', 'term'] }],
            { term: '5 years' },
            'Read the signature block.',
        );
        expect(text.startsWith('Read the signature block.')).toBe(true);
        expect(text).toContain('`agreement_type`: "grant" is not allowed.');
        expect(text).toContain('`expiration_date`: left empty');
        expect(text).toContain('`effective_date`, `term`');
        expect(text).toContain('{"term":"5 years"}');
    });
});

describe('validateAndRepairExtraction', () => {
    const extractionSchema = AGREEMENT_SCHEMA;

    it('makes no repair call when the output conforms or only needs deterministic rewrites', async () => {
        const repair = vi.fn();
        const result = await validateAndRepairExtraction(
            { agreement_type: 'Non-Reimbursable', term: '' },
            { extractionSchema, objectSchema: AGREEMENT_SCHEMA, repair },
        );
        expect(repair).not.toHaveBeenCalled();
        expect(result).toEqual({
            properties: { agreement_type: 'non_reimbursable' },
            report: { normalized: [{ path: 'agreement_type', rule: 'enum' }] },
        });
    });

    it('returns no report for output that conforms as returned', async () => {
        const repair = vi.fn();
        const result = await validateAndRepairExtraction(
            { agreement_type: 'funded' },
            { extractionSchema, objectSchema: AGREEMENT_SCHEMA, repair },
        );
        expect(result).toEqual({ properties: { agreement_type: 'funded' }, report: undefined });
    });

    it('asks once for invalid and derivable fields, restricted to them, and keeps the valid answers', async () => {
        const repair = vi.fn(async (_schema: unknown, _instructions: string) => ({
            agreement_type: 'funded',
            effective_date: '2025-09-10',
            expiration_date: 'September 10, 2030',
            term: 'should be ignored',
        }));
        const result = await validateAndRepairExtraction(
            { agreement_type: 'grant', signature_date: '2025-09-10', term: '5 years' },
            { extractionSchema, objectSchema: AGREEMENT_SCHEMA, repair, instructions: 'Type rules.' },
        );
        expect(repair).toHaveBeenCalledTimes(1);
        const [schema, instructions] = repair.mock.calls[0];
        expect(Object.keys((schema as { properties: object }).properties)).toEqual([
            'agreement_type',
            'effective_date',
            'expiration_date',
        ]);
        expect(instructions).toContain('Type rules.');
        expect(result.properties).toEqual({
            agreement_type: 'funded',
            signature_date: '2025-09-10',
            term: '5 years',
            effective_date: '2025-09-10',
            expiration_date: '2030-09-10',
        });
        expect(result.report).toEqual({
            normalized: [{ path: 'expiration_date', rule: 'format' }],
            cleared: undefined,
            repair: {
                fields: ['agreement_type', 'effective_date', 'expiration_date'],
                filled: ['agreement_type', 'effective_date', 'expiration_date'],
            },
        });
    });

    it('clears a value still invalid after the repair and records why', async () => {
        const repair = vi.fn(async () => ({ agreement_type: 'still-a-grant' }));
        const result = await validateAndRepairExtraction(
            { agreement_type: 'grant', value: 10 },
            { extractionSchema, objectSchema: AGREEMENT_SCHEMA, repair },
        );
        expect(result.properties).toEqual({ value: 10 });
        expect(result.report?.cleared).toEqual([
            { path: 'agreement_type', error: expect.stringContaining('"still-a-grant"') },
        ]);
        expect(result.report?.repair).toEqual({ fields: ['agreement_type'], filled: [] });
    });

    it('keeps the first extraction when the repair call fails', async () => {
        const onRepairError = vi.fn();
        const result = await validateAndRepairExtraction(
            { agreement_type: 'grant', value: 10 },
            {
                extractionSchema,
                objectSchema: AGREEMENT_SCHEMA,
                repair: async () => {
                    throw new Error('model down');
                },
                onRepairError,
            },
        );
        expect(onRepairError).toHaveBeenCalledWith(expect.objectContaining({ message: 'model down' }));
        expect(result.properties).toEqual({ value: 10 });
        expect(result.report?.repair).toEqual({ fields: ['agreement_type'], filled: [], failed: true });
        expect(result.report?.cleared).toHaveLength(1);
    });

    it('keeps the first value of a partly invalid array when the repair gives nothing', async () => {
        const schema = {
            type: 'object',
            properties: { roles: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } } },
        };
        const result = await validateAndRepairExtraction(
            { roles: ['a', 'z'] },
            { extractionSchema: schema, objectSchema: schema, repair: async () => ({ roles: null }) },
        );
        expect(result.properties).toEqual({ roles: ['a'] });
        expect(result.report?.cleared).toEqual([{ path: 'roles[1]', error: expect.any(String) }]);
    });
});
