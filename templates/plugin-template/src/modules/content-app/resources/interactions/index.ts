import { InteractionCollection } from '@vertesia/tools-sdk';
import fieldSuggester from './field_suggester/index.js';
import guideSummarizer from './guide_summarizer/index.js';
import reviewChecklistBuilder from './review_checklist_builder/index.js';

export const ContentAppInteractions = new InteractionCollection({
    name: 'main',
    title: 'Content App Interactions',
    description: 'Portable app-owned interactions for guide ideation, summarization, and review.',
    interactions: [guideSummarizer, fieldSuggester, reviewChecklistBuilder],
});

export const interactions = [ContentAppInteractions];
