import { ApiTopic, type ClientBase } from '@vertesia/api-fetch-client';
import type {
    CreateEmailRouteRequest,
    CreateEmailRouteResponse,
    EmailRouteData,
    EmailRouteResponse,
    ForwardEmailRequest,
    ForwardEmailResponse,
    SendEmailRequest,
    SendEmailResponse,
    UpdateEmailRouteRequest,
    UpdateEmailRouteResponse,
} from '@vertesia/common';

export type {
    ForwardEmailRequest,
    ForwardEmailResponse,
    SendEmailRequest,
    SendEmailResponse,
} from '@vertesia/common';
/** @deprecated Use CreateEmailRouteRequest from @vertesia/common. */
export type CreateRouteRequest = CreateEmailRouteRequest;
/** @deprecated Use CreateEmailRouteResponse from @vertesia/common. */
export type CreateRouteResponse = CreateEmailRouteResponse;

/**
 * Email API for sending emails from workflows.
 */
export class EmailApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, '/api/v1/email');
    }

    /**
     * Send an email from an agent/workflow.
     * Creates a route key if not provided, sends via Resend, and returns routing info.
     */
    send(request: SendEmailRequest): Promise<SendEmailResponse> {
        return this.post('/send', { payload: request });
    }

    /**
     * Resolve a route key to get email context.
     * Used by webhook handler to look up workflow info from reply email.
     * @deprecated Use getRoute() instead
     */
    resolveRoute(routeKey: string): Promise<EmailRouteData> {
        return this.post('/resolve-route', { payload: { route_key: routeKey } });
    }

    // ============================================================================
    // Routes API - for external service integration
    // ============================================================================

    /**
     * Create a new email route without sending an email.
     * Useful for external services that want to handle email sending themselves
     * but need reply routing back to Vertesia workflows.
     *
     * @example
     * ```ts
     * const { route_key, reply_to } = await client.store.email.createRoute({
     *     run_id: workflowRunId,
     *     user_email: "user@example.com",
     *     thread_subject: "Contract Review"
     * });
     * // Use reply_to as the Reply-To header when sending your own email
     * // Replies will be routed back to the workflow
     * ```
     */
    createRoute(request: CreateEmailRouteRequest): Promise<CreateEmailRouteResponse> {
        return this.post('/routes', { payload: request });
    }

    /**
     * Get an email route by key.
     */
    getRoute(routeKey: string): Promise<EmailRouteResponse> {
        return this.get(`/routes/${routeKey}`);
    }

    /**
     * Update an email route (e.g., to update threading info).
     */
    updateRoute(routeKey: string, updates: UpdateEmailRouteRequest): Promise<UpdateEmailRouteResponse> {
        return this.put(`/routes/${routeKey}`, { payload: updates });
    }

    /**
     * Forward an email to a workflow via route key.
     *
     * Use this when your service receives an email reply and needs to forward
     * it to the Vertesia workflow. You can add custom context data (like auth
     * tokens or user IDs) that will be merged into `payload.vars.data`.
     *
     * **Important**: Use camelCase keys in context to match the agent start
     * pattern. This ensures tools work identically whether the agent was
     * started directly or received an email reply.
     *
     * @example
     * ```ts
     * // In your email webhook handler:
     * const result = await client.store.email.forwardEmail(routeKey, {
     *     email: {
     *         from: inboundEmail.from,
     *         subject: inboundEmail.subject,
     *         text: inboundEmail.text,
     *         message_id: inboundEmail.messageId,
     *     },
     *     context: {
     *         // Use camelCase - merged into payload.vars.data
     *         apiKey: generateServiceToken(),
     *         tenantId: resolvedUser.tenantId,
     *         userId: resolvedUser.id,
     *         userEmail: resolvedUser.email,
     *     },
     *     attachments: inboundEmail.attachments?.map(att => ({
     *         filename: att.filename,
     *         content_type: att.contentType,
     *         size: att.size,
     *         download_url: att.url,
     *     })),
     * });
     * ```
     */
    forwardEmail(routeKey: string, request: ForwardEmailRequest): Promise<ForwardEmailResponse> {
        return this.post(`/routes/${routeKey}/forward`, { payload: request });
    }
}
