import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { EmailRouteData } from "@vertesia/common";

/**
 * Request payload for sending an email via the agent.
 * Resend configuration is fetched from project settings.
 * From address is constructed as: {project_namespace}+{agent_name}@{from_domain}
 */
export interface SendEmailRequest {
    /** Email address to send to */
    to_email: string;
    /** Email subject */
    subject: string;
    /** Email body in markdown format */
    body: string;
    /** Agent/interaction endpoint name (used in from address) */
    agent_name: string;
    /** Display name for the sender (overrides project default) */
    from_name?: string;
    /** Workflow run ID for routing replies */
    run_id: string;
    /** Existing route key (for subsequent emails in same conversation) */
    route_key?: string;
    /** Message ID for In-Reply-To header (email threading) */
    in_reply_to?: string;
    /** Chain of message IDs for References header */
    references?: string[];
}

/**
 * Response from sending an email.
 */
export interface SendEmailResponse {
    success: boolean;
    /** Resend email ID */
    email_id?: string;
    /** Message-ID header for threading */
    message_id?: string;
    /** Short route key for reply routing */
    route_key?: string;
    /** Error message if failed */
    error?: string;
}

/**
 * Response from creating an email route.
 */
export interface CreateRouteResponse {
    /** The generated route key (8-char alphanumeric) */
    route_key: string;
    /** Full reply-to address: r+{route_key}@{inbound_domain} */
    reply_to: string;
    /** The inbound domain for receiving replies */
    inbound_domain: string;
}

/**
 * Request to forward an email to a workflow.
 * Used by external services that handle email reception themselves.
 */
export interface ForwardEmailRequest {
    /** Email content received by the external service */
    email: {
        /** Sender email address */
        from: string;
        /** Email subject */
        subject?: string;
        /** Plain text body */
        text: string;
        /** HTML body (optional) */
        html?: string;
        /** Message-ID header for threading */
        message_id?: string;
    };
    /** Custom context data from the external service (e.g., auth tokens, user IDs) */
    context?: Record<string, unknown>;
    /** Attachments with download URLs */
    attachments?: Array<{
        filename: string;
        content_type: string;
        size: number;
        download_url: string;
    }>;
}

/**
 * Response from forwarding an email.
 */
export interface ForwardEmailResponse {
    success: boolean;
    run_id: string;
    workflow_id: string;
    route_key: string;
}

/**
 * Request to create an email route.
 */
export interface CreateRouteRequest {
    /** Workflow run ID for routing replies */
    run_id: string;
    /** Email address of the user (for context) */
    user_email: string;
    /** Subject of the email thread (optional) */
    thread_subject?: string;
}

/**
 * Email API for sending emails from workflows.
 */
export class EmailApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/email");
    }

    /**
     * Send an email from an agent/workflow.
     * Creates a route key if not provided, sends via Resend, and returns routing info.
     */
    send(request: SendEmailRequest): Promise<SendEmailResponse> {
        return this.post("/send", { payload: request });
    }

    /**
     * Resolve a route key to get email context.
     * Used by webhook handler to look up workflow info from reply email.
     * @deprecated Use getRoute() instead
     */
    resolveRoute(routeKey: string): Promise<EmailRouteData> {
        return this.post("/resolve-route", { payload: { route_key: routeKey } });
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
    createRoute(request: CreateRouteRequest): Promise<CreateRouteResponse> {
        return this.post("/routes", { payload: request });
    }

    /**
     * Get an email route by key.
     */
    getRoute(routeKey: string): Promise<EmailRouteData & { route_key: string }> {
        return this.get(`/routes/${routeKey}`);
    }

    /**
     * Update an email route (e.g., to update threading info).
     */
    updateRoute(routeKey: string, updates: Partial<EmailRouteData>): Promise<{ success: boolean; route_key: string }> {
        return this.put(`/routes/${routeKey}`, { payload: updates });
    }

    /**
     * Forward an email to a workflow via route key.
     *
     * Use this when your service receives an email reply and needs to forward
     * it to the Vertesia workflow. You can add custom context data (like auth
     * tokens or user IDs) that will be passed to the workflow.
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
     *         // Your service-specific data passed to the workflow
     *         nagare_auth_token: generateServiceToken(),
     *         user_id: resolvedUser.id,
     *         organization_id: resolvedUser.orgId,
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
