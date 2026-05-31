import { ActivityCollection } from '@vertesia/tools-sdk';
import { WordCountActivity } from './word_count/index.js';

export const ExampleActivities = new ActivityCollection({
    name: 'examples',
    title: 'Example Activities',
    description: 'A collection of example remote activities for DSL workflows',
    activities: [WordCountActivity],
});

// config.ts imports `activities` from here; minimal scaffold exports `[]`.
export const activities = [ExampleActivities];
