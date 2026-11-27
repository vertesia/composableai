import type { ActivityDefinition } from '@vertesia/tools-sdk';
import { wordCount } from './word_count.js';

export const WordCountActivity = {
    name: 'word_count',
    title: 'Word Count',
    description:
        'Counts words and characters in a text string. Deprecated: remote activities only run in DSL workflows, which no longer start.',
    input_schema: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'The text to count words and characters in',
            },
        },
        required: ['text'],
    },
    output_schema: {
        type: 'object',
        properties: {
            word_count: { type: 'number', description: 'Number of words' },
            character_count: { type: 'number', description: 'Number of characters' },
        },
    },
    run: wordCount,
} satisfies ActivityDefinition;
