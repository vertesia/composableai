/**
 * Email-related types for agent communication and routing.
 */

// ================= User Communication Channels ====================

/**
 * Email channel configuration with threading support.
 * Used for email-based agent communication.
 */
export interface EmailChannel {
    type: "email";
    /** Email address to send agent messages to */
    to_email: string;
    /** Subject for the email thread (without "Re:" prefix) */
    thread_subject?: string;
    /** Message ID for In-Reply-To header (most recent message) */
    in_reply_to?: string;
    /** Chain of message IDs for References header */
    references?: string[];
    /** Short routing key for reply emails (8-char alphanumeric, stored in Redis) */
    route_key?: string;
}

/**
 * Interactive (UI chat) channel configuration.
 * Used for real-time chat interface communication.
 */
export interface InteractiveChannel {
    type: "interactive";
}

/**
 * Union of all supported user communication channel types.
 */
export type UserChannel = EmailChannel | InteractiveChannel;

/**
 * Type guard for email channels
 */
export function isEmailChannel(channel: UserChannel): channel is EmailChannel {
    return channel.type === "email";
}

/**
 * Type guard for interactive channels
 */
export function isInteractiveChannel(channel: UserChannel): channel is InteractiveChannel {
    return channel.type === "interactive";
}

// ================= Email Routing ====================

/**
 * Data stored in Redis for email route keys.
 * Used to map short route keys (8-char) to workflow context for email replies.
 *
 * Short keys are used instead of full UUIDs in reply email addresses to avoid
 * Gmail flagging emails as unsafe due to long random-looking strings.
 *
 * Pattern: r+{routeKey}@{domain} instead of r+{32-char-uuid}@{domain}
 */
export interface EmailRouteData {
    /** The workflow run ID */
    runId: string;
    /** Account ID for quick project lookup */
    accountId: string;
    /** Project ID for quick config lookup */
    projectId: string;
    /** Email thread subject (without "Re:" prefix) */
    threadSubject?: string;
    /** Message ID for In-Reply-To header (last message in thread) */
    inReplyTo?: string;
    /** Chain of message IDs for References header */
    references?: string[];
    /** User's email address (recipient of agent emails, sender of replies) */
    userEmail: string;
    /** Inbound domain for filtering (e.g., inbound.vertesia.io) */
    inboundDomain: string;
}
