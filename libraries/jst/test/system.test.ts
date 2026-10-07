import Handlebars from 'handlebars';
import { describe, expect, test } from 'vitest';
import { HANDLEBARS_HELPER_NAMES, isHandlebarsHelper, renderHandlebarsTemplate } from '../src/handlebars/index.js';
import {
    buildTemplateSystemVariables,
    isTemplateSystemVariable,
    TEMPLATE_SYSTEM_VARIABLE_NAMES,
    withTemplateSystemVariables,
} from '../src/system.js';
import { renderJsTemplate } from '../src/template.js';

const NOW = new Date('2026-01-02T03:04:05.000Z');
const data = withTemplateSystemVariables({}, { model: 'test-model', now: NOW });
const expected: Record<string, string> = { _now: NOW.toISOString(), _model: 'test-model' };

describe('template system variables', () => {
    test('every registered system variable gets a value', () => {
        expect(Object.keys(expected).sort()).toEqual([...TEMPLATE_SYSTEM_VARIABLE_NAMES].sort());
        expect(data).toEqual(expected);
    });

    test('system values override caller input of the same name', () => {
        expect(withTemplateSystemVariables({ _model: 'spoofed', name: 'x' }, { model: 'real' })).toMatchObject({
            _model: 'real',
            name: 'x',
        });
    });

    test('_model is omitted when the model is unknown', () => {
        expect(buildTemplateSystemVariables({ now: NOW })).toEqual({ _now: NOW.toISOString() });
    });

    test('only registered names are system variables', () => {
        expect(isTemplateSystemVariable('_now')).toBe(true);
        expect(isTemplateSystemVariable('_other')).toBe(false);
    });

    // Every position a variable can appear in must resolve to the injected value. This is the
    // check that fails when a name is only a helper, or only data, in some positions.
    describe.each(TEMPLATE_SYSTEM_VARIABLE_NAMES)('%s in Handlebars', (name) => {
        const value = expected[name];
        test.each([
            [`{{${name}}}`, value],
            [`{{{${name}}}}`, value],
            [`{{#if ${name}}}yes{{else}}no{{/if}}`, 'yes'],
            [`{{stringify ${name}}}`, value],
            [`{{stringify (${name})}}`, value],
            [`{{#each items}}{{../${name}}}{{/each}}`, value],
            [`{{#with obj}}{{@root.${name}}}{{/with}}`, value],
        ])('%s', (template, out) => {
            expect(renderHandlebarsTemplate(template, { ...data, items: [1], obj: {} })).toBe(out);
        });
    });

    test.each(TEMPLATE_SYSTEM_VARIABLE_NAMES)('%s in JST', (name) => {
        expect(renderJsTemplate(`return ${name};`, [], data)).toBe(expected[name]);
    });

    test('JST accepts a schema that also declares a system variable', () => {
        expect(renderJsTemplate('return _model;', ['_model'], data)).toBe('test-model');
    });

    test('without injected values, _now falls back to the current time and _model to empty', () => {
        expect(renderHandlebarsTemplate('{{_now}}', {})).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(renderHandlebarsTemplate('[{{_model}}]', {})).toBe('[]');
    });
});

describe('prompt Handlebars environment', () => {
    test('exposes the built-in and custom helpers, nothing else', () => {
        expect(HANDLEBARS_HELPER_NAMES).toEqual([
            '_model',
            '_now',
            'each',
            'if',
            'log',
            'lookup',
            'stringify',
            'unless',
            'with',
        ]);
        expect(isHandlebarsHelper('stringify')).toBe(true);
        expect(isHandlebarsHelper('helperMissing')).toBe(false);
    });

    test('helpers registered on the global Handlebars do not reach prompts', () => {
        Handlebars.registerHelper('globalOnlyHelper', () => 'leaked');
        try {
            expect(() => renderHandlebarsTemplate('{{globalOnlyHelper 1}}', {})).toThrow(/Missing helper/);
        } finally {
            Handlebars.unregisterHelper('globalOnlyHelper');
        }
    });
});
