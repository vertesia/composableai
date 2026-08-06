import type { JSONSchema } from '@llumiverse/common';

export default {
    type: 'object',
    properties: {
        suggestions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    rationale: { type: 'string' },
                    tags: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                required: ['title', 'rationale', 'tags'],
                additionalProperties: false,
            },
        },
    },
    required: ['suggestions'],
    additionalProperties: false,
} satisfies JSONSchema;
