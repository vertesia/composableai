/**
 * Types for tracking pending ask_user requests and webhook notifications.
 * Used to notify external systems when agents are waiting for user input.
 */

import type { z } from 'zod';
import type {
    ListPendingAsksResponseSchema,
    PendingAskDataSchema,
    PendingAskStatusSchema,
    RegisterPendingAskRequestSchema,
    RegisterPendingAskResponseSchema,
    ResolvePendingAskRequestSchema,
    ResolvePendingAskResponseSchema,
} from './api-schemas/agent-communication.js';

// ================= Pending Ask Data ====================

/**
 * Status of a pending ask request.
 */
export type PendingAskStatus = z.infer<typeof PendingAskStatusSchema>;

/**
 * Data stored in Redis for pending ask_user requests.
 * Tracks which agents are waiting for user input and enables
 * both webhook notifications and portal views.
 */
export type PendingAskData = z.infer<typeof PendingAskDataSchema>;

// ================= Webhook Events ====================

/**
 * Event types for ask_user webhooks.
 */
export type AskUserWebhookEventType = 'ask_user.requested' | 'ask_user.resolved';

/**
 * Simplified channel info for webhook payloads.
 */
export interface WebhookChannelInfo {
    type: 'email' | 'interactive';
    /** Email address (only for email channels) */
    email?: string;
}

/**
 * Webhook payload sent when ask_user events occur.
 * Sent to configured webhook endpoints when agents request user input
 * or when users respond.
 */
export interface AskUserWebhookEvent {
    /** Event type */
    event: AskUserWebhookEventType;
    /** Timestamp of the event (ms since epoch) */
    timestamp: number;
    /** Unique identifier for this ask */
    askId: string;
    /** Temporal workflow run ID */
    runId: string;
    /** Temporal workflow ID */
    workflowId: string;
    /** Project ID */
    projectId: string;
    /** Name of the agent/interaction */
    agentName: string;
    /** Questions asked by the agent */
    questions: string[];
    /** Communication channels available */
    userChannels: WebhookChannelInfo[];
    /** User's response (only for resolved events) */
    response?: string;
    /** Timestamp when resolved (only for resolved events) */
    resolvedAt?: number;
    /** How long the agent waited for response in ms (only for resolved events) */
    waitDurationMs?: number;
}

// ================= API Types ====================

/**
 * Response from listing pending asks.
 */
export type RegisterPendingAskRequest = z.infer<typeof RegisterPendingAskRequestSchema>;
export type RegisterPendingAskResponse = z.infer<typeof RegisterPendingAskResponseSchema>;
export type ResolvePendingAskRequest = z.infer<typeof ResolvePendingAskRequestSchema>;
export type ResolvePendingAskResponse = z.infer<typeof ResolvePendingAskResponseSchema>;
export type ListPendingAsksResponse = z.infer<typeof ListPendingAsksResponseSchema>;
