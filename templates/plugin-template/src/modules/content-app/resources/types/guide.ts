import type { InCodeTypeSpec } from '@vertesia/common';

export const GuideType = {
    name: 'guide',
    description: 'Editorial guide content owned by this app.',
    tags: ['content-app', 'guide'],
    object_schema: {
        type: 'object',
        properties: {
            slug: {
                type: 'string',
                description: 'Stable app-local guide identifier.',
            },
            title: {
                type: 'string',
                description: 'Guide title displayed in the library.',
            },
            summary: {
                type: 'string',
                description: 'Short editorial summary.',
            },
            body: {
                type: 'string',
                description: 'Primary guide content.',
            },
            location_slug: {
                type: 'string',
                description: 'Related location slug.',
            },
            category: {
                type: 'string',
                description: 'Guide category.',
            },
            status: {
                type: 'string',
                enum: ['draft', 'in_review', 'published'],
                description: 'Editorial status.',
            },
            owner: {
                type: 'string',
                description: 'Editorial owner.',
            },
            audience: {
                type: 'string',
                description: 'Target audience.',
            },
            tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Search and filtering tags.',
            },
            seed_marker: {
                type: 'string',
                description: 'Idempotent demo-data marker.',
            },
        },
        required: ['slug', 'title', 'summary', 'body', 'location_slug', 'category', 'status', 'owner', 'audience'],
        additionalProperties: false,
    },
    table_layout: [
        { field: 'properties.title', name: 'Title', type: 'string' },
        { field: 'properties.status', name: 'Status', type: 'string' },
        { field: 'properties.category', name: 'Category', type: 'string' },
        { field: 'properties.owner', name: 'Owner', type: 'string' },
    ],
    is_chunkable: true,
    strict_mode: true,
} satisfies InCodeTypeSpec;
