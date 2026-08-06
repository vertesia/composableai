import type { InteractionSpec } from '@vertesia/common';
import PROMPT from './prompt.hbs?prompt';
import result_schema from './result_schema.js';

export default {
    name: 'guide_summarizer',
    title: 'Guide Summarizer',
    description: 'Summarizes a guide and recommends editorial next steps.',
    result_schema,
    prompts: [PROMPT],
    tags: ['content-app', 'guide', 'summary'],
} satisfies InteractionSpec;
