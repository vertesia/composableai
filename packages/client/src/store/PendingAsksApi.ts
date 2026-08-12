import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    ListPendingAsksResponse,
    PendingAskData,
    RegisterPendingAskRequest,
    RegisterPendingAskResponse,
    ResolvePendingAskRequest,
    ResolvePendingAskResponse,
} from '@vertesia/common';

export type {
    RegisterPendingAskRequest,
    RegisterPendingAskResponse,
    ResolvePendingAskRequest,
    ResolvePendingAskResponse,
} from '@vertesia/common';

/**
 * Pending Asks API for tracking ask_user requests.
 * Handles registration, resolution, and listing of pending asks.
 */
export class PendingAsksApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/pending-asks');
    }

    /**
     * Register a new pending ask.
     * Called when an agent calls ask_user.
     * Stores in Redis and sends webhook if configured.
     */
    register(request: RegisterPendingAskRequest): Promise<RegisterPendingAskResponse> {
        return this.post('/', { payload: request });
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
        return this.get('/');
    }

    /**
     * Get a specific pending ask by ID.
     */
    retrieve(askId: string): Promise<PendingAskData> {
        return this.get(`/${askId}`);
    }
}
