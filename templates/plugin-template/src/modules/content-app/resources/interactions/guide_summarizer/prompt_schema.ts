import type { JSONSchema } from '@llumiverse/common';

export default {
    type: 'object',
    properties: {
        guide_title: { type: 'string', description: 'Guide title.' },
        body: { type: 'string', description: 'Guide body text.' },
        location: { type: 'string', description: 'Location name or slug.' },
        audience: { type: 'string', description: 'Target audience.' },
    },
    required: ['guide_title', 'body'],
    additionalProperties: false,
} satisfies JSONSchema;
