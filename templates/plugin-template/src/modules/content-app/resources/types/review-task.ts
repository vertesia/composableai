import type { InCodeTypeSpec } from '@vertesia/common';

export const ReviewTaskType = {
    name: 'review_task',
    description: 'Editorial review task records for guides.',
    tags: ['content-app', 'review'],
    object_schema: {
        type: 'object',
        properties: {
            slug: {
                type: 'string',
                description: 'Stable app-local task identifier.',
            },
            guide_slug: {
                type: 'string',
                description: 'Related guide slug.',
            },
            title: {
                type: 'string',
                description: 'Task title.',
            },
            priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Review priority.',
            },
            status: {
                type: 'string',
                enum: ['open', 'in_progress', 'done'],
                description: 'Review task status.',
            },
            assignee: {
                type: 'string',
                description: 'Assigned reviewer.',
            },
            checklist: {
                type: 'array',
                items: { type: 'string' },
                description: 'Expected review checks.',
            },
            due_date: {
                type: 'string',
                description: 'ISO date for review target.',
            },
            seed_marker: {
                type: 'string',
                description: 'Idempotent demo-data marker.',
            },
        },
        required: ['slug', 'guide_slug', 'title', 'priority', 'status', 'assignee', 'checklist', 'due_date'],
        additionalProperties: false,
    },
    table_layout: [
        { field: 'properties.title', name: 'Task', type: 'string' },
        { field: 'properties.status', name: 'Status', type: 'string' },
        { field: 'properties.priority', name: 'Priority', type: 'string' },
        { field: 'properties.assignee', name: 'Assignee', type: 'string' },
    ],
    strict_mode: true,
} satisfies InCodeTypeSpec;
