import type { InCodeViewDefinition } from '@vertesia/common';

/**
 * Example in-code View Experience.
 *
 * When the plugin is installed, Studio contributes this View as
 * `app:<app-name>:document-library`, where `<app-name>` is your plugin's
 * registered app name. Render it with the generic `/view/<id>` route or the
 * `<ViewExperience>` component — see src/modules/app/ui/pages/ViewExamplePage.tsx.
 *
 * Edit `definition` to match your content: change the navigation `field` to a
 * real property/facet, the search `fields`, and the result `displays`.
 */
export const DocumentLibraryView = {
    id: 'document-library',
    name: 'document_library',
    title: 'Document Library',
    description: 'Browse and search indexed documents with a type facet and full-text search.',
    definition: {
        name: 'Document Library',
        navigation: [
            {
                id: 'type',
                label: 'Type',
                source: 'terms',
                field: 'type.name',
            },
        ],
        search: {
            mode: 'deterministic',
            fields: [
                {
                    field: 'name',
                    description: 'Content object name.',
                    type: 'text',
                    mode: 'full_text',
                    boost: 2,
                },
                {
                    field: 'text',
                    description: 'Full ingested document text.',
                    type: 'text',
                    mode: 'full_text',
                },
            ],
        },
        results: {
            default_display: 'list',
            displays: [
                {
                    id: 'list',
                    label: 'List',
                    type: 'list',
                    title: { field: 'name' },
                },
            ],
        },
    },
} satisfies InCodeViewDefinition;
