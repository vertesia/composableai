import type { JSONSchema } from '@llumiverse/common';

export default {
    type: 'object',
    properties: {
        checklist: {
            type: 'array',
            items: { type: 'string' },
            description: 'Review checklist items.',
        },
        risk_notes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Risks or content gaps to inspect.',
        },
        decision: {
            type: 'string',
            enum: ['approve', 'request_changes'],
            description: 'Suggested review decision.',
        },
    },
    required: ['checklist', 'risk_notes', 'decision'],
    additionalProperties: false,
} satisfies JSONSchema;
