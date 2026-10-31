import type * as Wire from './wire-types.generated.js';

export type NotificationKind = Wire.NotificationKind;

export type NotificationCategory = Wire.NotificationCategory;

export type NotificationChannel = Wire.NotificationChannel;

/** A typed reference to the item a notification is about (`{ type: 'task', id }`, ...). */
export type NotificationRef = Wire.NotificationRef;

export type NotificationPayload = Wire.NotificationPayload;

/** One notification in the current user's project inbox. Timestamps are ISO strings. */
export type Notification = Wire.Notification;

export type ListNotificationsQuery = Wire.ListNotificationsQuery;

export type ListNotificationsResponse = Wire.ListNotificationsResponse;

export type NotificationCounts = Wire.NotificationCounts;

export type MarkNotificationsSeenPayload = Wire.MarkNotificationsSeenPayload;

export type MarkNotificationsReadPayload = Wire.MarkNotificationsReadPayload;

export type MarkAllNotificationsReadPayload = Wire.MarkAllNotificationsReadPayload;

export type ArchiveNotificationsPayload = Wire.ArchiveNotificationsPayload;

export type NotificationUpdateResult = Wire.NotificationUpdateResult;

export type NotificationChannelPreferences = Wire.NotificationChannelPreferences;

export type NotificationPreferences = Wire.NotificationPreferences;

export type NotificationStreamEvent = Wire.NotificationStreamEvent;

/** The category each kind belongs to, before the outcome is known (a failed run moves to `failures`). */
export const NOTIFICATION_KIND_CATEGORY: Record<NotificationKind, NotificationCategory> = {
    'agent.question': 'actions',
    'agent.approval': 'actions',
    'task.assigned': 'actions',
    'agent.finished': 'results',
    'agent.turn_finished': 'results',
    'intake.finished': 'results',
};

/** Redis pub/sub channel that tells a user's open clients their project inbox changed. */
export function notificationChannelName(accountId: string, projectId: string, userId: string): string {
    return `notif:${accountId}:${projectId}:${userId}`;
}
