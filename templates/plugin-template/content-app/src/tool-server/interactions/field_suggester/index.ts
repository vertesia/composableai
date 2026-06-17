import type { InteractionSpec } from '@vertesia/common';
import PROMPT from './prompt.hbs?prompt';
import result_schema from './result_schema.js';

export default {
    name: 'field_suggester',
    title: 'Field Suggester',
    description: 'Suggests content ideas for a guide library.',
    result_schema,
    prompts: [PROMPT],
    tags: ['content-app', 'ideation'],
} satisfies InteractionSpec;
