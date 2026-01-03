import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import {
    ListPendingAsksResponse,
    PendingAskData,
} from "@vertesia/common";

/**
 * Response payload for responding to a pending ask.
 */
export interface RespondToAskPayload {
    responses: string[];
}

/**
 * Client API for managing pending ask_user requests.
 *
 * Pending asks are created when an agent calls ask_user and waits for user input.
 * This API allows viewing and responding to these requests from a centralized portal.
 */
export class PendingAsksApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/pending-asks");
    }

    /**
     * List all pending asks for the project.
     *
     * @param status - Optional status filter: 'pending', 'resolved', or 'expired'
     * @returns List of pending asks
     *
     * @example
     * ```typescript
     * // List all pending asks
     * const { asks } = await client.pendingAsks.list();
     *
     * // List only pending (waiting for response) asks
     * const { asks } = await client.pendingAsks.list('pending');
     * ```
     */
    list(status?: 'pending' | 'resolved' | 'expired'): Promise<ListPendingAsksResponse> {
        const query = status ? { status } : undefined;
        return this.get("/", { query });
    }

    /**
     * Retrieve a specific pending ask by ID.
     *
     * @param askId - The ask ID
     * @returns The pending ask data
     */
    retrieve(askId: string): Promise<PendingAskData> {
        return this.get(`/${askId}`);
    }

    /**
     * Respond to a pending ask.
     *
     * This sends the user's responses to the workflow, unblocking the agent.
     *
     * @param askId - The ask ID
     * @param responses - Array of responses (one per question)
     * @returns Success status
     *
     * @example
     * ```typescript
     * await client.pendingAsks.respond('ask_123', {
     *   responses: ['Blue', 'Yes, proceed with the task']
     * });
     * ```
     */
    respond(askId: string, payload: RespondToAskPayload): Promise<{ success: boolean }> {
        return this.post(`/${askId}/respond`, { payload });
    }
}
