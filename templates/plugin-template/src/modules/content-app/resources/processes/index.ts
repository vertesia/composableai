import type { InCodeProcessDefinition } from '@vertesia/common';
import { GuideReviewProcess } from './review-workflow.js';

export const processes = [GuideReviewProcess] satisfies InCodeProcessDefinition[];
