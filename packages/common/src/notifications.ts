import type * as Wire from './wire-types.generated.js';

export type NotificationKind = Wire.NotificationKind;

export type NotificationCategory = Wire.NotificationCategory;

export type NotificationChannel = Wire.NotificationChannel;

/** A typed reference to the item a notification is about (`{ type: 'task', id }`, ...). */
export type NotificationRef = Wire.NotificationRef;

/** An occurrence the client rendered, with the version it displayed for one that happens again. */
export type NotificationOccurrenceAck = Wire.NotificationOccurrenceAck;

export type NotificationPayload = Wire.NotificationPayload;

/** One notification in the current user's project inbox. Timestamps are ISO strings. */
export type Notification = Wire.Notification;

export type ListNotificationsQuery = Wire.ListNotificationsQuery;

export type ListNotificationsResponse = Wire.ListNotificationsResponse;

export type NotificationCounts = Wire.NotificationCounts;

export type MarkNotificationsReadPayload = Wire.MarkNotificationsReadPayload;

export type MarkAllNotificationsReadPayload = Wire.MarkAllNotificationsReadPayload;

export type ArchiveNotificationsPayload = Wire.ArchiveNotificationsPayload;

export type NotificationUpdateResult = Wire.NotificationUpdateResult;

export type NotificationChannelPreferences = Wire.NotificationChannelPreferences;

export type NotificationPreferences = Wire.NotificationPreferences;

export type NotificationStreamEvent = Wire.NotificationStreamEvent;

/**
 * The occurrence of a task assignment. Each assignment revision is its own occurrence, so reading one
 * assignment never reads a later one: in Alice → Bob → Alice, Alice's second notification stays unread
 * however often she opened the first.
 */
export function taskNotificationOccurrence(task: { id: string; assignment_rev?: number }): NotificationRef {
    return { type: 'task', id: `${task.id}:${task.assignment_rev ?? 1}` };
}
