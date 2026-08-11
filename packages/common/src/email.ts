import type { z } from 'zod';
import type { EmailChannelSchema, InteractiveChannelSchema, UserChannelSchema } from './api-schemas/interaction.js';
/**
 * Email-related types for agent communication and routing.
 */

// ================= User Communication Channels ====================

/**
 * Email channel configuration with threading support.
 * Used for email-based agent communication.
 */
export type EmailChannel = z.infer<typeof EmailChannelSchema>;

/**
 * Interactive (UI chat) channel configuration.
 * Used for real-time chat interface communication.
 */
export type InteractiveChannel = z.infer<typeof InteractiveChannelSchema>;

/**
 * Union of all supported user communication channel types.
 */
/**
 * @discriminator type
 */
export type UserChannel = z.infer<typeof UserChannelSchema>;

/**
 * Type guard for email channels
 */
export function isEmailChannel(channel: UserChannel): channel is EmailChannel {
    return channel.type === 'email';
}

/**
 * Type guard for interactive channels
 */
export function isInteractiveChannel(channel: UserChannel): channel is InteractiveChannel {
    return channel.type === 'interactive';
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
