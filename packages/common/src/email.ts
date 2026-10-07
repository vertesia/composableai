import type * as Wire from './wire-types.generated.js';
/**
 * Email-related types for agent communication and routing.
 */

// ================= User Communication Channels ====================

/**
 * Email channel configuration with threading support.
 * Used for email-based agent communication.
 */
export type EmailChannel = Wire.EmailChannel;

/**
 * Interactive (UI chat) channel configuration.
 * Used for real-time chat interface communication.
 */
export type InteractiveChannel = Wire.InteractiveChannel;

/**
 * Union of all supported user communication channel types.
 */
/**
 * @discriminator type
 */
export type UserChannel = Wire.UserChannel;

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
export type EmailRouteData = Wire.EmailRouteData;
export type SendEmailRequest = Wire.SendEmailRequest;
export type SendEmailResponse = Wire.SendEmailResponse;
export type ResolveEmailRouteRequest = Wire.ResolveEmailRouteRequest;
export type CreateEmailRouteRequest = Wire.CreateEmailRouteRequest;
export type CreateEmailRouteResponse = Wire.CreateEmailRouteResponse;
export type EmailRouteResponse = Wire.EmailRouteResponse;
export type UpdateEmailRouteRequest = Wire.UpdateEmailRouteRequest;
export type UpdateEmailRouteResponse = Wire.UpdateEmailRouteResponse;
export type ForwardEmailRequest = Wire.ForwardEmailRequest;
export type ForwardEmailResponse = Wire.ForwardEmailResponse;
