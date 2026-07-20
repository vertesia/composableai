import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { validateViewConfiguration } from './view-configuration-validation.js';
import { type ViewExperienceConfiguration, type ViewNavigationItem, viewExperienceRoute } from './views.js';
import {
    PersistedViewExperienceConfigurationJsonSchema,
    ViewExperienceConfigurationJsonSchema,
} from './views-schema.js';
import { parseAppViewExperienceId, validateViewExperienceId } from './views-validation.js';

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
                id: 'geography',
                label: 'Geography',
                source: 'hierarchy',
                levels: [
                    { id: 'state', label: 'State', field: 'properties.state' },
                    { id: 'city', label: 'City', field: 'properties.city', sort: 'label' },
                ],
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
            fields: [
                {
                    field: 'text',
                    description: 'Full ingested and OCR document text.',
                    type: 'text',
                    mode: 'full_text',
                    boost: 1.5,
                },
            ],
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

    it('advertises only executable version 1 options', () => {
        const validate = new Ajv.default({ allErrors: true, strict: false }).compile(
            ViewExperienceConfigurationJsonSchema,
        );
        const unsupported = [
            { name: 'Drawer', layout: { navigation_position: 'drawer' } },
            {
                name: 'Missing bucket',
                navigation: [
                    {
                        id: 'brand',
                        label: 'Brand',
                        source: 'terms',
                        field: 'properties.brand',
                        missing_label: 'Unknown',
                    },
                ],
            },
            { name: 'Rerank', search: { mode: 'agentic', agentic: { mode: 'rerank' } } },
            { name: 'Candidate limit', search: { mode: 'agentic', agentic: { candidate_limit: 50 } } },
            {
                name: 'Annotations',
                search: { mode: 'agentic', agentic: { annotations: { mode: 'why_match' } } },
            },
            {
                name: 'Board card renderer',
                results: {
                    default_display: 'board',
                    displays: [
                        {
                            id: 'board',
                            label: 'Board',
                            type: 'board',
                            group_by: 'status',
                            card: { renderer: 'custom-card', title: { field: 'name' } },
                        },
                    ],
                },
            },
        ];

        unsupported.forEach((configuration) => {
            expect(validate(configuration), JSON.stringify(validate.errors)).toBe(false);
        });
    });

    it('matches the agentic timeout schema to the runtime budget', () => {
        const validate = new Ajv.default({ allErrors: true, strict: false }).compile(
            ViewExperienceConfigurationJsonSchema,
        );
        expect(validate({ name: 'Agentic', search: { mode: 'agentic', agentic: { timeout_ms: 60_000 } } })).toBe(true);
        expect(validate({ name: 'Too short', search: { mode: 'agentic', agentic: { timeout_ms: 999 } } })).toBe(false);
        expect(validate({ name: 'Too long', search: { mode: 'agentic', agentic: { timeout_ms: 60_001 } } })).toBe(
            false,
        );
    });

    it('requires a description only for persisted View resources', () => {
        const validatePersisted = new Ajv.default({ allErrors: true, strict: false }).compile(
            PersistedViewExperienceConfigurationJsonSchema,
        );

        expect(validatePersisted(documentLibrary())).toBe(false);
        expect(
            validatePersisted({
                ...documentLibrary(),
                description: 'Browse the project document library by location and business metadata.',
            }),
        ).toBe(true);
        expect(validateViewConfiguration(documentLibrary())).toEqual([]);
        const missingDescriptionIssues = validateViewConfiguration(documentLibrary(), 'persisted');
        expect(missingDescriptionIssues).toHaveLength(1);
        expect(missingDescriptionIssues[0]?.path).toBe('description');
        expect(
            validateViewConfiguration(
                {
                    ...documentLibrary(),
                    description: '   ',
                },
                'persisted',
            ),
        ).toContainEqual({
            path: 'description',
            message: 'must explain the View purpose',
        });
    });
});

describe('View Experience semantic validation', () => {
    it('accepts a complete document library configuration', () => {
        expect(validateViewConfiguration(documentLibrary())).toEqual([]);
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

        const issues = validateViewConfiguration(invalid);

        expect(issues).toContainEqual({
            path: 'results.default_display',
            message: 'must reference a configured display',
        });
        expect(issues).toContainEqual({
            path: 'results.displays[2].id',
            message: 'must be unique',
        });
    });

    it('rejects duplicate and incompatible search field definitions', () => {
        const invalid = documentLibrary();
        if (invalid.search) {
            invalid.search.fields = [
                { field: 'properties.total', type: 'number', mode: 'full_text' },
                { field: 'properties.total', type: 'number' },
            ];
        }

        expect(validateViewConfiguration(invalid)).toEqual(
            expect.arrayContaining([
                {
                    path: 'search.fields[0].type',
                    message: 'must be text when mode is full_text',
                },
                {
                    path: 'search.fields[1].field',
                    message: 'must be unique',
                },
            ]),
        );
    });

    it('rejects ambiguous property hierarchies', () => {
        const invalid = documentLibrary();
        invalid.navigation = [
            {
                id: 'geography',
                label: 'Geography',
                source: 'hierarchy',
                levels: [
                    { id: 'state', label: 'State', field: 'properties.state' },
                    { id: 'state', label: 'City', field: 'properties.state' },
                ],
            } as ViewNavigationItem,
        ];

        expect(validateViewConfiguration(invalid)).toEqual(
            expect.arrayContaining([
                {
                    path: 'navigation[0].levels[1].id',
                    message: 'must be unique within the hierarchy',
                },
                {
                    path: 'navigation[0].levels[1].field',
                    message: 'must be unique within the hierarchy',
                },
            ]),
        );
    });

    it('runs structural validation before semantic validation', () => {
        const invalid = {
            ...documentLibrary(),
            navigation: [
                {
                    id: 'geography',
                    label: 'Geography',
                    source: 'hierarchy',
                    multi_select: true,
                    levels: [
                        { id: 'state', label: 'State', field: 'properties.state' },
                        { id: 'state', label: 'City', field: 'properties.state' },
                    ],
                },
            ],
        };

        const issues = validateViewConfiguration(invalid);
        expect(issues.some((issue) => issue.path === 'navigation[0].multi_select')).toBe(true);
        expect(issues.some((issue) => issue.message === 'must be unique within the hierarchy')).toBe(false);
    });

    it('normalizes required and array paths from JSON Schema errors', () => {
        const issues = validateViewConfiguration({
            name: 'Invalid',
            navigation: [{ id: 'brand', label: 'Brand', source: 'terms' }],
        });

        expect(issues.some((issue) => issue.path === 'navigation[0].field')).toBe(true);
        expect(issues.every((issue) => !issue.path.startsWith('/'))).toBe(true);
    });

    it('rejects fixed filters that the execution runtime cannot apply', () => {
        const invalid = documentLibrary();
        if (invalid.scope) {
            invalid.scope.fixed_filter = { query_string: { query: '*' } };
        }

        expect(validateViewConfiguration(invalid)).toContainEqual({
            path: 'scope.fixed_filter.query_string',
            message: "query type 'query_string' is not supported",
        });
    });

    it('parses canonical app View ids and rejects URL path material', () => {
        expect(parseAppViewExperienceId('app:content:document-lib')).toEqual({
            app_name: 'content',
            local_id: 'document-lib',
        });
        expect(parseAppViewExperienceId('app:content:../../environments')).toBeUndefined();
        expect(parseAppViewExperienceId('app:content:%2F..%2Fenvironments')).toBeUndefined();
    });

    it('builds the generic route without exposing path material from an id', () => {
        expect(viewExperienceRoute('app:content:document-library')).toBe('/view/app%3Acontent%3Adocument-library');
        expect(viewExperienceRoute('unsafe/id')).toBe('/view/unsafe%2Fid');
    });
});
