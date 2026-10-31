import { z } from 'zod';
import { PageCountSchema } from './schema-primitives.js';

export const NotificationKindSchema = z
    .enum([
        'agent.question',
        'agent.approval',
        'agent.finished',
        'agent.turn_finished',
        'task.assigned',
        'intake.finished',
    ])
    .meta({
        id: 'NotificationKind',
        description: 'What a notification is about. Each kind belongs to one category.',
    });

export const NotificationCategorySchema = z.enum(['actions', 'failures', 'results']).meta({
    id: 'NotificationCategory',
    description:
        'Preference group of a notification: `actions` need the user (questions, approvals, tasks), `failures` ' +
        'report failed runs or intakes, `results` report successful ones.',
});

export const NotificationChannelSchema = z.enum(['in_app']).meta({
    id: 'NotificationChannel',
    description: 'A delivery channel. Only the in-app inbox exists today.',
});

export const NotificationRefSchema = z
    .strictObject({
        type: z.string().min(1),
        id: z.string().min(1),
    })
    .meta({ id: 'NotificationRef', description: 'A typed reference to the item a notification is about.' });

export const NotificationPayloadSchema = z
    .strictObject({
        title: z.string(),
        body: z.string().optional(),
        status: z
            .string()
            .optional()
            .meta({ description: 'Outcome of the item, for example `completed` or `failed`.' }),
        agent_name: z.string().optional(),
        object_name: z.string().optional(),
    })
    .meta({
        id: 'NotificationPayload',
        description: 'Display fields of a notification, copied from the item when the notification was written.',
    });

export const NotificationSchema = z
    .strictObject({
        id: z.string(),
        kind: NotificationKindSchema,
        category: NotificationCategorySchema,
        occurrence: NotificationRefSchema.meta({
            description: 'The exact occurrence acknowledged by `POST /notifications/read` with `occurrences`.',
        }),
        subject: NotificationRefSchema.meta({ description: 'Where the notification links to.' }),
        parent: NotificationRefSchema.optional().meta({ description: 'Lifecycle parent, usually the agent run.' }),
        actor: z.string().optional().meta({ description: 'Principal that caused the notification, when a person.' }),
        payload: NotificationPayloadSchema,
        payload_version: z.number().int(),
        occurred_at: z.string().meta({ format: 'date-time' }),
        created_at: z.string().meta({ format: 'date-time' }),
        seen_at: z.string().meta({ format: 'date-time' }).optional(),
        read_at: z.string().meta({ format: 'date-time' }).optional(),
        archived_at: z.string().meta({ format: 'date-time' }).optional(),
        resolved_at: z
            .string()
            .meta({
                format: 'date-time',
                description: 'When the item stopped needing attention (task closed or reassigned, run ended).',
            })
            .optional(),
    })
    .meta({ id: 'Notification', description: 'One notification in the current user’s project inbox.' });

export const ListNotificationsQuerySchema = z
    .strictObject({
        limit: PageCountSchema.optional(),
        cursor: z.string().optional().meta({ description: 'The `next_cursor` of the previous page.' }),
        unread: z.boolean().optional().meta({ description: 'Only notifications that were not read.' }),
        archived: z.boolean().optional().meta({ description: 'Archived notifications instead of the inbox.' }),
        category: NotificationCategorySchema.optional(),
    })
    .meta({ id: 'ListNotificationsQuery' });

export const ListNotificationsResponseSchema = z
    .strictObject({
        notifications: z.array(NotificationSchema),
        next_cursor: z.string().optional(),
        read_all_before: z.string().meta({
            format: 'date-time',
            description:
                'Server time when this page was read. Pass it to `POST /notifications/read-all` so notifications ' +
                'written afterwards stay unread.',
        }),
    })
    .meta({ id: 'ListNotificationsResponse' });

export const NotificationCountsSchema = z
    .strictObject({
        unseen: z.number().int().meta({
            description: 'Inbox notifications not seen, archived or resolved. Counted up to 100.',
        }),
        needs_action: z.number().int().meta({ description: 'Open tasks assigned to the user. Counted up to 100.' }),
    })
    .meta({ id: 'NotificationCounts' });

export const MarkNotificationsSeenPayloadSchema = z
    .strictObject({
        ids: z.array(z.string()).min(1).max(200),
    })
    .meta({ id: 'MarkNotificationsSeenPayload' });

export const MarkNotificationsReadPayloadSchema = z
    .strictObject({
        ids: z.array(z.string()).max(200).optional(),
        occurrences: z
            .array(NotificationRefSchema)
            .max(200)
            .optional()
            .meta({
                description:
                    'Occurrences the client rendered. An occurrence with no notification yet is remembered for a day ' +
                    'and applied when its notification is written.',
            }),
    })
    .meta({ id: 'MarkNotificationsReadPayload' });

export const MarkAllNotificationsReadPayloadSchema = z
    .strictObject({
        before: z.string().meta({
            format: 'date-time',
            description: 'The `read_all_before` of the list the user saw.',
        }),
    })
    .meta({ id: 'MarkAllNotificationsReadPayload' });

export const ArchiveNotificationsPayloadSchema = z
    .strictObject({
        ids: z.array(z.string()).min(1).max(200),
    })
    .meta({ id: 'ArchiveNotificationsPayload' });

export const NotificationUpdateResultSchema = z
    .strictObject({
        updated: z.number().int(),
        held: z.number().int().optional().meta({
            description: 'Occurrences acknowledged before their notification existed.',
        }),
    })
    .meta({ id: 'NotificationUpdateResult' });

export const NotificationChannelPreferencesSchema = z
    .strictObject({
        in_app: z.boolean().optional(),
    })
    .meta({ id: 'NotificationChannelPreferences' });

export const NotificationPreferencesSchema = z
    .strictObject({
        categories: z.record(z.string(), NotificationChannelPreferencesSchema).meta({
            description: 'Per category (`actions`, `failures`, `results`), the channels it is delivered to.',
        }),
        kinds: z.record(z.string(), NotificationChannelPreferencesSchema).meta({
            description: 'Per kind, an override of its category. Today only `agent.turn_finished` is offered.',
        }),
    })
    .meta({
        id: 'NotificationPreferences',
        description: 'The user’s notification preferences in the project. Unset channels are on.',
    });

export const NotificationStreamEventSchema = z
    .strictObject({
        type: z.enum(['changed', 'heartbeat']),
        emitted_at: z.string().meta({ format: 'date-time' }),
    })
    .meta({
        id: 'NotificationStreamEvent',
        description: 'A server-sent event: the inbox changed and should be fetched again.',
    });
