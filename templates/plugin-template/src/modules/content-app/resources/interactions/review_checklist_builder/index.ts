import type { InteractionSpec } from '@vertesia/common';
import PROMPT from './prompt.hbs?prompt';
import result_schema from './result_schema.js';

export default {
    name: 'review_checklist_builder',
    title: 'Review Checklist Builder',
    description: 'Builds an editorial review checklist for a guide.',
    result_schema,
    prompts: [PROMPT],
    tags: ['content-app', 'review'],
} satisfies InteractionSpec;
