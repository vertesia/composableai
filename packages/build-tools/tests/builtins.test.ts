/**
 * Tests for the BUILTIN_TRANSFORMERS registry and `resolveTransformerNames`.
 * These are the lookup points used by the `vertesia-build` CLI to convert
 * user-supplied transformer names into concrete `TransformerRule` instances.
 */

import { describe, expect, it } from 'vitest';
import { promptTransformer } from '../src/core/transformers/prompt.js';
import { rawTransformer } from '../src/core/transformers/raw.js';
import { skillTransformer } from '../src/core/transformers/skill.js';
import { skillCollectionTransformer } from '../src/core/transformers/skill-collection.js';
import { templateTransformer } from '../src/core/transformers/template.js';
import { templateCollectionTransformer } from '../src/core/transformers/template-collection.js';
import {
    BUILTIN_TRANSFORMER_NAMES,
    BUILTIN_TRANSFORMERS,
    resolveTransformerNames,
} from '../src/import-transform/builtins.js';

describe('BUILTIN_TRANSFORMERS', () => {
    it('exposes every preset under its query-suffix-aligned name', () => {
        expect(BUILTIN_TRANSFORMERS.skill).toBe(skillTransformer);
        expect(BUILTIN_TRANSFORMERS.skills).toBe(skillCollectionTransformer);
        expect(BUILTIN_TRANSFORMERS.template).toBe(templateTransformer);
        expect(BUILTIN_TRANSFORMERS.templates).toBe(templateCollectionTransformer);
        expect(BUILTIN_TRANSFORMERS.prompt).toBe(promptTransformer);
        expect(BUILTIN_TRANSFORMERS.raw).toBe(rawTransformer);
    });

    it('lists names in a stable order matching the registry keys', () => {
        expect(BUILTIN_TRANSFORMER_NAMES).toEqual(['skill', 'skills', 'template', 'templates', 'prompt', 'raw']);
    });
});

describe('resolveTransformerNames', () => {
    it('returns the matching transformer instances in the order requested', () => {
        const resolved = resolveTransformerNames(['raw', 'skill']);
        expect(resolved).toEqual([rawTransformer, skillTransformer]);
    });

    it('throws and lists known transformers when a name is unknown', () => {
        expect(() => resolveTransformerNames(['skill', 'bogus'])).toThrowError(
            /Unknown transformer name\(s\): bogus.*Known transformers: skill, skills, template, templates, prompt, raw/,
        );
    });

    it('reports every unknown name in a single error', () => {
        expect(() => resolveTransformerNames(['nope', 'skill', 'alsoNope'])).toThrowError(
            /Unknown transformer name\(s\): nope, alsoNope/,
        );
    });
});
