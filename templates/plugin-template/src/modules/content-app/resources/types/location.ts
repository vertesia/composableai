import type { InCodeTypeSpec } from '@vertesia/common';

export const LocationType = {
    name: 'location',
    description: 'Location records referenced by guides.',
    tags: ['content-app', 'location'],
    object_schema: {
        type: 'object',
        properties: {
            slug: {
                type: 'string',
                description: 'Stable app-local location identifier.',
            },
            name: {
                type: 'string',
                description: 'Location display name.',
            },
            region: {
                type: 'string',
                description: 'Region or operating area.',
            },
            country: {
                type: 'string',
                description: 'Country.',
            },
            terrain: {
                type: 'string',
                description: 'Dominant terrain.',
            },
            best_season: {
                type: 'string',
                description: 'Best time to visit or operate.',
            },
            summary: {
                type: 'string',
                description: 'Short location summary.',
            },
            seed_marker: {
                type: 'string',
                description: 'Idempotent demo-data marker.',
            },
        },
        required: ['slug', 'name', 'region', 'country', 'terrain', 'best_season', 'summary'],
        additionalProperties: false,
    },
    table_layout: [
        { field: 'properties.name', name: 'Name', type: 'string' },
        { field: 'properties.region', name: 'Region', type: 'string' },
        { field: 'properties.terrain', name: 'Terrain', type: 'string' },
        { field: 'properties.best_season', name: 'Best Season', type: 'string' },
    ],
    strict_mode: true,
} satisfies InCodeTypeSpec;
