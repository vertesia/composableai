import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { ContentTypeEditingPolicySchema } from './store.js';

const validate = new Ajv.default({ allErrors: true, strict: false }).compile(ContentTypeEditingPolicySchema);

describe('ContentTypeEditingPolicySchema', () => {
    it('accepts an omitted or configured interaction', () => {
        expect(validate({})).toBe(true);
        expect(validate({ interaction: 'sys:GeneralAgent' })).toBe(true);
    });

    it('rejects unknown fields and non-string interactions', () => {
        expect(validate({ interaction: 42 })).toBe(false);
        expect(validate({ interaction: 'sys:GeneralAgent', tools: [] })).toBe(false);
    });
});
