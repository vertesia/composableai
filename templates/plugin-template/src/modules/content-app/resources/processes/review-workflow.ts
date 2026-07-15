import { type InCodeProcessDefinition, PROCESS_DEFINITION_FORMAT_VERSION } from '@vertesia/common';
import { APP_NAME } from '../../../../constants.js';

const guideSummarizer = `app:${APP_NAME}:main:guide_summarizer`;
const reviewChecklistBuilder = `app:${APP_NAME}:main:review_checklist_builder`;

export const GuideReviewProcess = {
    id: 'guide-review',
    name: 'guide_review',
    title: 'Guide Review',
    description: 'Summarize a guide, build a checklist, and wait for editorial review.',
    tags: ['content-app', 'review'],
    definition: {
        format_version: PROCESS_DEFINITION_FORMAT_VERSION,
        process: 'guide_review',
        description: 'Summarize a guide, build a checklist, and wait for editorial review.',
        initial: 'summarize',
        context: {
            schema: {
                type: 'object',
                properties: {
                    guide_slug: { type: 'string' },
                    guide_title: { type: 'string' },
                    guide_body: { type: 'string' },
                    location_slug: { type: 'string' },
                    summary: { type: 'string' },
                    checklist: { type: 'array', items: { type: 'string' } },
                    approved: { type: 'boolean' },
                    review_notes: { type: 'string' },
                },
                additionalProperties: true,
            },
            initial: {
                guide_slug: '',
                guide_title: '',
                guide_body: '',
                location_slug: '',
                summary: '',
                checklist: [],
                approved: false,
                review_notes: '',
            },
        },
        nodes: {
            summarize: {
                type: 'interaction',
                interaction: guideSummarizer,
                input: {
                    guide_title: '{{guide_title}}',
                    body: '{{guide_body}}',
                    location: '{{location_slug}}',
                    audience: 'field editors',
                },
                writes: ['summary'],
                transitions: [{ to: 'build_checklist' }],
            },
            build_checklist: {
                type: 'interaction',
                interaction: reviewChecklistBuilder,
                input: {
                    guide_title: '{{guide_title}}',
                    summary: '{{summary}}',
                    status: 'in_review',
                    review_notes: '{{review_notes}}',
                },
                writes: ['checklist'],
                transitions: [{ to: 'editorial_review' }],
            },
            editorial_review: {
                type: 'human_task',
                task: {
                    title: 'Review {{guide_title}}',
                    description: 'Approve the guide or request changes.',
                    fields: [
                        { name: 'approved', label: 'Approved', type: 'boolean', required: true },
                        { name: 'review_notes', label: 'Review notes', type: 'text' },
                    ],
                },
                writes: ['approved', 'review_notes'],
                transitions: [
                    {
                        to: 'publish_ready',
                        label: 'approve',
                        guard: { '==': [{ var: 'approved' }, true] },
                    },
                    {
                        to: 'draft_revision',
                        label: 'request changes',
                    },
                ],
            },
            publish_ready: {
                type: 'final',
                title: 'Ready to publish',
            },
            draft_revision: {
                type: 'final',
                title: 'Needs revision',
            },
        },
    },
} satisfies InCodeProcessDefinition;
