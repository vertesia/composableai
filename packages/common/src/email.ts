import type { z } from 'zod';
import type {
    CreateEmailRouteRequestSchema,
    CreateEmailRouteResponseSchema,
    EmailRouteDataSchema,
    EmailRouteResponseSchema,
    ForwardEmailRequestSchema,
    ForwardEmailResponseSchema,
    ResolveEmailRouteRequestSchema,
    SendEmailRequestSchema,
    SendEmailResponseSchema,
    UpdateEmailRouteRequestSchema,
    UpdateEmailRouteResponseSchema,
} from './api-schemas/agent-communication.js';
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
export type EmailRouteData = z.infer<typeof EmailRouteDataSchema>;
export type SendEmailRequest = z.infer<typeof SendEmailRequestSchema>;
export type SendEmailResponse = z.infer<typeof SendEmailResponseSchema>;
export type ResolveEmailRouteRequest = z.infer<typeof ResolveEmailRouteRequestSchema>;
export type CreateEmailRouteRequest = z.infer<typeof CreateEmailRouteRequestSchema>;
export type CreateEmailRouteResponse = z.infer<typeof CreateEmailRouteResponseSchema>;
export type EmailRouteResponse = z.infer<typeof EmailRouteResponseSchema>;
export type UpdateEmailRouteRequest = z.infer<typeof UpdateEmailRouteRequestSchema>;
export type UpdateEmailRouteResponse = z.infer<typeof UpdateEmailRouteResponseSchema>;
export type ForwardEmailRequest = z.infer<typeof ForwardEmailRequestSchema>;
export type ForwardEmailResponse = z.infer<typeof ForwardEmailResponseSchema>;
