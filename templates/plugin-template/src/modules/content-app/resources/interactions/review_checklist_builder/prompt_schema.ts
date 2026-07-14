import type { JSONSchema } from '@llumiverse/common';

export default {
    type: 'object',
    properties: {
        guide_title: { type: 'string', description: 'Guide title.' },
        summary: { type: 'string', description: 'Current summary.' },
        status: { type: 'string', description: 'Current editorial status.' },
        review_notes: { type: 'string', description: 'Existing review notes.' },
    },
    required: ['guide_title'],
    additionalProperties: false,
} satisfies JSONSchema;
