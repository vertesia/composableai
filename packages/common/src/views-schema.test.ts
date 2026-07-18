import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import type { ViewExperienceConfiguration } from './views.js';
import { ViewExperienceConfigurationJsonSchema } from './views-schema.js';
import { validateViewExperienceConfiguration, validateViewExperienceId } from './views-validation.js';

function documentLibrary(): ViewExperienceConfiguration {
    return {
        name: 'Document Library',
        layout: {
            mode: 'browse',
            navigation_position: 'sidebar',
        },
        scope: {
            locations: ['/documents'],
            head_only: true,
        },
        navigation: [
            {
                id: 'location',
                label: 'Folders',
                source: 'location',
                roots: ['/documents'],
                presentation: 'tree',
            },
            {
                id: 'brand',
                label: 'Brand',
                source: 'terms',
                field: 'properties.brand.keyword',
                size: 30,
            },
            {
                id: 'project_size',
                label: 'Project size',
                source: 'range',
                field: 'properties.project_size',
                ranges: [
                    { id: 'small', label: 'Small', to: 100 },
                    { id: 'large', label: 'Large', from: 100 },
                ],
            },
        ],
        search: {
            mode: 'agentic',
            placeholder: 'Describe what you need',
            key_terms: [{ id: 'client', label: 'Client', type: 'keyword' }],
            agentic: {
                interaction: 'sys:ContentSearchAgent',
                config: {
                    environment: 'production-search',
                    model: 'openai:gpt-5-mini',
                },
                mode: 'query',
            },
        },
        results: {
            default_display: 'table',
            allow_display_switch: true,
            displays: [
                {
                    id: 'table',
                    label: 'Table',
                    type: 'table',
                    columns: [
                        {
                            field: 'name',
                            label: 'Name',
                            sortable: true,
                            sort_option: 'name_asc',
                        },
                    ],
                },
                {
                    id: 'cards',
                    label: 'Cards',
                    type: 'cards',
                    title: { field: 'name' },
                    fields: [{ field: 'properties.brand', label: 'Brand' }],
                    columns: 3,
                },
            ],
            default_sort: 'name_asc',
            sort_options: [
                {
                    id: 'name_asc',
                    label: 'Name',
                    sort: [{ field: 'name.keyword', order: 'asc' }],
                },
            ],
        },
    };
}

describe('View Experience configuration schema', () => {
    it('accepts navigation, one agentic model, and visual result displays', () => {
        const validate = new Ajv.default({ allErrors: true, strict: false }).compile(
            ViewExperienceConfigurationJsonSchema,
        );

        expect(validate(documentLibrary())).toBe(true);
        expect(validate.errors).toBeNull();
    });

    it('rejects malformed discriminated navigation and display entries', () => {
        const validate = new Ajv.default({ allErrors: true, strict: false }).compile(
            ViewExperienceConfigurationJsonSchema,
        );
        const invalid = documentLibrary() as unknown as Record<string, unknown>;
        invalid.navigation = [{ id: 'brand', label: 'Brand', source: 'terms' }];

        expect(validate(invalid)).toBe(false);
        expect(validate.errors?.some((error) => error.instancePath.includes('/navigation/0'))).toBe(true);
    });
});

describe('View Experience semantic validation', () => {
    it('accepts a complete document library configuration', () => {
        expect(validateViewExperienceConfiguration(documentLibrary())).toEqual([]);
        expect(validateViewExperienceId('document-library')).toEqual([]);
    });

    it('reports invalid cross-references that JSON Schema cannot express', () => {
        const invalid = documentLibrary();
        if (invalid.results) {
            invalid.results.default_display = 'missing';
            invalid.results.displays.push({
                id: 'table',
                label: 'Duplicate table',
                type: 'table',
                columns: [{ field: 'name' }],
            });
        }

        const issues = validateViewExperienceConfiguration(invalid);

        expect(issues).toContainEqual({
            path: 'results.default_display',
            message: 'must reference a configured display',
        });
        expect(issues).toContainEqual({
            path: 'results.displays[2].id',
            message: 'must be unique',
        });
    });
});
