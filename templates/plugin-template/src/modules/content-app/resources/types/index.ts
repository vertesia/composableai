import { ContentTypesCollection } from '@vertesia/tools-sdk';
import { GuideType } from './guide.js';
import { LocationType } from './location.js';
import { ReviewTaskType } from './review-task.js';

export const ContentAppTypes = new ContentTypesCollection({
    name: 'content',
    title: 'Content App Types',
    description: 'Portable app-owned content types for a content-oriented Studio app.',
    types: [GuideType, LocationType, ReviewTaskType],
});

export const types = [ContentAppTypes];
