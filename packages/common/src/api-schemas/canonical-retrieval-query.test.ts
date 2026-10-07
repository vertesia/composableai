import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ExperimentalCanonicalInteractionRetrievalQuerySchema } from './canonical-interaction-execution.js';
import { normalizeApiParameters, validateApiRequest } from './index.js';
import { ApiSchemaComponents } from './registry.js';

const validate = new Ajv2020({ strict: false }).compile({
    components: { schemas: ApiSchemaComponents },
    $ref: '#/components/schemas/ExperimentalCanonicalInteractionRetrievalQuery',
});

describe('exact-version retained output-only query', () => {
    it.each([{}, { history: 'none' }])('accepts the identical explicit or omitted projection', (value) => {
        expect(ExperimentalCanonicalInteractionRetrievalQuerySchema.parse(value)).toEqual(value);
        expect(validate(value)).toBe(true);
        const normalized = normalizeApiParameters('ExperimentalCanonicalInteractionRetrievalQuery', value, 'query');
        expect(validateApiRequest('ExperimentalCanonicalInteractionRetrievalQuery', normalized.value).valid).toBe(true);
    });
    it.each([
        { history: 'document' },
        { history: null },
        { history: ['none', 'none'] },
        { history: '' },
        { extra: 'none' },
    ])('rejects malformed or unknown query fields with Zod and actual emitted contract', (value) => {
        expect(ExperimentalCanonicalInteractionRetrievalQuerySchema.safeParse(value).success).toBe(false);
        expect(validate(value)).toBe(false);
    });
});
