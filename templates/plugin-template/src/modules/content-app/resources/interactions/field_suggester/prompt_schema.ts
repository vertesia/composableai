import type { JSONSchema } from '@llumiverse/common';

export default {
    type: 'object',
    properties: {
        interest: { type: 'string', description: 'Reader or team interest.' },
        region: { type: 'string', description: 'Target region.' },
        season: { type: 'string', description: 'Relevant season.' },
        constraints: { type: 'string', description: 'Optional constraints.' },
    },
    required: ['interest'],
    additionalProperties: false,
} satisfies JSONSchema;
