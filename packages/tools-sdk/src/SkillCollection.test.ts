import { describe, expect, it } from 'vitest';
import { SkillCollection } from './SkillCollection.js';

describe('SkillCollection.getToolDefinitions', () => {
    it('emits context-trigger keywords for skill routing', () => {
        const collection = new SkillCollection({
            name: 'data-analysis',
            skills: [
                {
                    name: 'analyze_data',
                    description: 'Analyze structured data.',
                    instructions: 'Use SQL.',
                    content_type: 'md',
                    context_triggers: { keywords: ['sql', 'data analysis'] },
                },
            ],
        });

        expect(collection.getToolDefinitions()[0]).toMatchObject({
            name: 'learn_analyze_data',
            keywords: ['sql', 'data analysis'],
        });
    });

    it('omits keywords when a skill has none', () => {
        const collection = new SkillCollection({
            name: 'plain',
            skills: [
                {
                    name: 'plain_skill',
                    description: 'Plain skill.',
                    instructions: 'Do the task.',
                    content_type: 'md',
                },
            ],
        });

        expect(collection.getToolDefinitions()[0]).not.toHaveProperty('keywords');
    });
});
