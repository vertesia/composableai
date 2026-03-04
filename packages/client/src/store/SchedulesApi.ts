import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    AgentSchedule,
    AgentScheduleWithTemporalInfo,
    CreateSchedulePayload,
    ScheduleListItem,
    UpdateSchedulePayload,
} from "@vertesia/common";

/**
 * Client API for managing agent schedules.
 *
 * Schedules allow agents to run on a recurring basis using cron expressions.
 */
export class SchedulesApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/schedules");
    }

    /**
     * List all schedules in the project.
     */
    list(): Promise<ScheduleListItem[]> {
        return this.get("/");
    }

    /**
     * Retrieve a schedule by ID.
     * Includes Temporal execution info if available.
     */
    retrieve(id: string): Promise<AgentScheduleWithTemporalInfo> {
        return this.get(`/${id}`);
    }

    /**
     * Create a new schedule.
     *
     * @param payload - Schedule configuration including name, interaction, and cron expression
     * @returns The created schedule
     *
     * @example
     * ```typescript
     * const schedule = await client.schedules.create({
     *   name: 'Weekly Report',
     *   interaction: 'WeeklyReportAgent',
     *   cron_expression: '0 9 * * MON', // Every Monday at 9am
     *   timezone: 'America/New_York',
     *   vars: { reportType: 'summary' }
     * });
     * ```
     */
    create(payload: CreateSchedulePayload): Promise<AgentSchedule> {
        return this.post("/", { payload });
    }

    /**
     * Update an existing schedule.
     *
     * @param id - Schedule ID
     * @param payload - Fields to update
     * @returns The updated schedule
     */
    update(id: string, payload: UpdateSchedulePayload): Promise<AgentSchedule> {
        return this.put(`/${id}`, { payload });
    }

    /**
     * Delete a schedule.
     *
     * This also removes the corresponding Temporal schedule.
     *
     * @param id - Schedule ID
     * @returns Object with the deleted schedule ID
     */
    delete(id: string): Promise<{ id: string }> {
        return this.del(`/${id}`);
    }

    /**
     * Trigger an immediate execution of the scheduled agent.
     *
     * This runs the agent immediately without waiting for the next scheduled time.
     *
     * @param id - Schedule ID
     * @returns Success message
     */
    trigger(id: string): Promise<{ message: string }> {
        return this.post(`/${id}/trigger`, {});
    }

    /**
     * Pause a schedule.
     *
     * The schedule will not run until resumed.
     *
     * @param id - Schedule ID
     * @param note - Optional note explaining why the schedule was paused
     * @returns Success message
     */
    pause(id: string, note?: string): Promise<{ message: string }> {
        return this.post(`/${id}/pause`, { payload: { note } });
    }

    /**
     * Resume a paused schedule.
     *
     * @param id - Schedule ID
     * @param note - Optional note explaining why the schedule was resumed
     * @returns Success message
     */
    resume(id: string, note?: string): Promise<{ message: string }> {
        return this.post(`/${id}/resume`, { payload: { note } });
    }
}
