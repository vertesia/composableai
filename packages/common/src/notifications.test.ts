import { describe, expect, it } from 'vitest';
import { taskNotificationOccurrence } from './notifications.js';

describe('taskNotificationOccurrence', () => {
    it('names one assignment revision of the task', () => {
        expect(taskNotificationOccurrence({ id: 't1', assignment_rev: 3 })).toEqual({ type: 'task', id: 't1:3' });
    });

    it('treats a task without a revision as its first assignment', () => {
        expect(taskNotificationOccurrence({ id: 't1' })).toEqual({ type: 'task', id: 't1:1' });
    });
});
