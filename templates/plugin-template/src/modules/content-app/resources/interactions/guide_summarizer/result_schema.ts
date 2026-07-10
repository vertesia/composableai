import type { JSONSchema } from '@llumiverse/common';

export default {
    type: 'object',
    properties: {
        summary: { type: 'string', description: 'Concise guide summary.' },
        bullets: {
            type: 'array',
            items: { type: 'string' },
            description: 'Key points for editors or readers.',
        },
        recommended_status: {
            type: 'string',
            enum: ['draft', 'in_review', 'published'],
            description: 'Suggested editorial status.',
        },
        next_steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recommended editorial next steps.',
        },
    },
    required: ['summary', 'bullets', 'recommended_status', 'next_steps'],
    additionalProperties: false,
} satisfies JSONSchema;
