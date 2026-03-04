import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { ListPendingAsksResponse, PendingAskData, UserChannel } from "@vertesia/common";

/**
 * Request to register a pending ask.
 */
export interface RegisterPendingAskRequest {
    /** Temporal workflow run ID */
    runId: string;
    /** Temporal workflow ID */
    workflowId: string;
    /** Name of the agent/interaction */
    agentName: string;
    /** Questions asked by the agent */
    questions: string[];
    /** Timeout in hours (default 48) */
    timeoutHours?: number;
    /** User communication channels */
    userChannels: UserChannel[];
}

/**
 * Response from registering a pending ask.
 */
export interface RegisterPendingAskResponse {
    /** Whether registration succeeded */
    success: boolean;
    /** Generated ask ID */
    askId?: string;
    /** Whether webhook was sent */
    webhookSent?: boolean;
    /** Error message if failed */
    error?: string;
}

/**
 * Request to resolve a pending ask.
 */
export interface ResolvePendingAskRequest {
    /** User's response */
    response: string;
}

/**
 * Response from resolving a pending ask.
 */
export interface ResolvePendingAskResponse {
    /** Whether resolution succeeded */
    success: boolean;
    /** Whether webhook was sent */
    webhookSent?: boolean;
    /** How long the user took to respond (ms) */
    waitDurationMs?: number;
    /** Error message if failed */
    error?: string;
}

/**
 * Pending Asks API for tracking ask_user requests.
 * Handles registration, resolution, and listing of pending asks.
 */
export class PendingAsksApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/pending-asks");
    }

    /**
     * Register a new pending ask.
     * Called when an agent calls ask_user.
     * Stores in Redis and sends webhook if configured.
     */
    register(request: RegisterPendingAskRequest): Promise<RegisterPendingAskResponse> {
        return this.post("/", { payload: request });
    }

    /**
     * Resolve a pending ask with the user's response.
     * Called when a user responds to an ask.
     * Updates Redis and sends webhook if configured.
     */
    resolve(askId: string, request: ResolvePendingAskRequest): Promise<ResolvePendingAskResponse> {
        return this.post(`/${askId}/resolve`, { payload: request });
    }

    /**
     * List all pending asks for the current project.
     */
    list(): Promise<ListPendingAsksResponse> {
        return this.get("/");
    }

    /**
     * Get a specific pending ask by ID.
     */
    retrieve(askId: string): Promise<PendingAskData> {
        return this.get(`/${askId}`);
    }
}
