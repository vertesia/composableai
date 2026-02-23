/**
 * Agent Schedule Types
 *
 * Defines types for scheduling agents to run on a recurring basis using cron expressions.
 * Schedules are stored in MongoDB with execution handled by Temporal.
 */

/**
 * Represents a scheduled agent execution configuration.
 */
export interface AgentSchedule {
    /** Unique identifier for the schedule */
    id: string;

    /** Human-readable name for the schedule */
    name: string;

    /** Optional description of what the schedule does */
    description?: string;

    /** Project ID this schedule belongs to */
    project: string;

    /** Account ID this schedule belongs to */
    account: string;

    /** Interaction ID or endpoint name to execute (e.g., "MyAgent" or ObjectId) */
    interaction: string;

    /** Cached interaction name for display purposes */
    interaction_name?: string;

    /**
     * Cron expression defining when to run.
     * Standard 5-field format: minute hour day-of-month month day-of-week
     * Examples:
     * - "0 0 * * MON" - Every Monday at midnight
     * - "0 9 * * *" - Daily at 9am
     * - "0 * * * *" - Every hour
     */
    cron_expression: string;

    /** Timezone for the cron expression (defaults to "UTC") */
    timezone?: string;

    /** Variables to pass to the agent workflow */
    vars?: Record<string, any>;

    /** Optional task queue override for the workflow */
    task_queue?: string;

    /** Whether the schedule is enabled (can be paused/resumed) */
    enabled: boolean;

    /** Temporal schedule ID once created (format: schedule:{accountId}:{projectId}:{scheduleId}) */
    temporal_schedule_id?: string;

    /** User or service that created this schedule */
    created_by: string;

    /** User or service that last updated this schedule */
    updated_by?: string;

    /** Timestamp when the schedule was created */
    created_at: Date;

    /** Timestamp when the schedule was last updated */
    updated_at: Date;

    /** Timestamp of the last successful execution */
    last_run_at?: Date;

    /** Timestamp of the next scheduled execution */
    next_run_at?: Date;

    /** Total number of times this schedule has executed */
    run_count?: number;
}

/**
 * Payload for creating a new schedule.
 */
export interface CreateSchedulePayload {
    /** Human-readable name for the schedule */
    name: string;

    /** Optional description of what the schedule does */
    description?: string;

    /** Interaction ID or endpoint name to execute */
    interaction: string;

    /**
     * Cron expression defining when to run.
     * Standard 5-field format: minute hour day-of-month month day-of-week
     */
    cron_expression: string;

    /** Timezone for the cron expression (defaults to "UTC") */
    timezone?: string;

    /** Variables to pass to the agent workflow */
    vars?: Record<string, any>;

    /** Optional task queue override */
    task_queue?: string;

    /** Whether the schedule should be enabled immediately (defaults to true) */
    enabled?: boolean;

    /** Visibility of the conversation (defaults to "project") */
    visibility?: 'project' | 'private';
}

/**
 * Payload for updating an existing schedule.
 */
export interface UpdateSchedulePayload {
    /** Updated name */
    name?: string;

    /** Updated description */
    description?: string;

    /** Updated cron expression */
    cron_expression?: string;

    /** Updated timezone */
    timezone?: string;

    /** Updated variables */
    vars?: Record<string, any>;

    /** Updated task queue */
    task_queue?: string;

    /** Enable or disable the schedule */
    enabled?: boolean;
}

/**
 * Summary information for listing schedules.
 */
export interface ScheduleListItem {
    id: string;
    name: string;
    description?: string;
    interaction: string;
    interaction_name?: string;
    cron_expression: string;
    timezone?: string;
    enabled: boolean;
    last_run_at?: Date;
    next_run_at?: Date;
    run_count?: number;
    created_by: string;
    updated_at: Date;
}

/**
 * Information about a schedule's recent and upcoming runs.
 */
export interface ScheduleRunInfo {
    /** The schedule ID */
    schedule_id: string;

    /** Recent workflow executions from this schedule */
    recent_runs: Array<{
        workflow_id: string;
        run_id: string;
        started_at: Date;
        status: string;
    }>;

    /** Upcoming scheduled execution times */
    upcoming_runs: Date[];
}

/**
 * Extended schedule information including Temporal execution details.
 */
export interface AgentScheduleWithTemporalInfo extends AgentSchedule {
    /** Information from Temporal about the schedule execution */
    temporal_info?: {
        /** Number of actions (workflow starts) executed */
        num_actions_taken: number;

        /** Number of actions missed due to catchup window */
        num_actions_missed: number;

        /** Number of actions skipped due to overlap policy */
        num_actions_skipped: number;

        /** Currently running workflows started by this schedule */
        running_actions: Array<{
            workflow_id: string;
            run_id: string;
        }>;

        /** Recent actions taken by the schedule */
        recent_actions: Array<{
            scheduled_at: Date;
            taken_at: Date;
            workflow_id: string;
            run_id: string;
        }>;

        /** Next scheduled action times */
        next_action_times: Date[];

        /** Whether the schedule is currently paused in Temporal */
        paused: boolean;

        /** Optional note about why the schedule is paused */
        pause_note?: string;
    };
}

/**
 * Common cron expression presets for UI convenience.
 */
export const CRON_PRESETS = {
    EVERY_HOUR: '0 * * * *',
    EVERY_DAY_MIDNIGHT: '0 0 * * *',
    EVERY_DAY_9AM: '0 9 * * *',
    EVERY_MONDAY_MIDNIGHT: '0 0 * * MON',
    EVERY_WEEKDAY_9AM: '0 9 * * MON-FRI',
    FIRST_OF_MONTH: '0 0 1 * *',
} as const;

/**
 * Human-readable descriptions for cron presets.
 */
export const CRON_PRESET_LABELS: Record<keyof typeof CRON_PRESETS, string> = {
    EVERY_HOUR: 'Every hour',
    EVERY_DAY_MIDNIGHT: 'Daily at midnight',
    EVERY_DAY_9AM: 'Daily at 9:00 AM',
    EVERY_MONDAY_MIDNIGHT: 'Every Monday at midnight',
    EVERY_WEEKDAY_9AM: 'Weekdays at 9:00 AM',
    FIRST_OF_MONTH: 'First day of month at midnight',
};
