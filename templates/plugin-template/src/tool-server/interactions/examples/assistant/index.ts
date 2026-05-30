import type { InteractionSpec } from '@vertesia/common';
import SYSTEM_PROMPT from './system.hbs?prompt';
import USER_PROMPT from './user.hbs?prompt';

export default {
    name: 'assistant',
    title: 'Plugin Assistant',
    description: 'A conversational assistant for the plugin.',
    tags: ['assistant', 'chat'],
    agent_runner_options: {
        is_agent: true,
    },
    prompts: [SYSTEM_PROMPT, USER_PROMPT],
} satisfies InteractionSpec;
