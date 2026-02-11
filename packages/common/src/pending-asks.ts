/**
 * Types for tracking pending ask_user requests and webhook notifications.
 * Used to notify external systems when agents are waiting for user input.
 */

import { UserChannel } from "./email.js";

// ================= Pending Ask Data ====================

/**
 * Status of a pending ask request.
 */
export type PendingAskStatus = 'pending' | 'resolved' | 'expired';

/**
 * Data stored in Redis for pending ask_user requests.
 * Tracks which agents are waiting for user input and enables
 * both webhook notifications and portal views.
 */
export interface PendingAskData {
    /** Unique identifier for this ask (10-char alphanumeric) */
    askId: string;
    /** Temporal workflow run ID */
    runId: string;
    /** Temporal workflow ID */
    workflowId: string;
    /** Project ID */
    projectId: string;
    /** Account ID */
    accountId: string;
    /** Name of the agent/interaction that asked */
    agentName: string;
    /** Questions asked by the agent */
    questions: string[];
    /** Timeout in hours (default 48) */
    timeoutHours: number;
    /** Communication channels configured for the conversation */
    userChannels: UserChannel[];
    /** Timestamp when the ask was created (ms since epoch) */
    createdAt: number;
    /** Timestamp when the ask expires (ms since epoch) */
    expiresAt: number;
    /** Current status of the ask */
    status: PendingAskStatus;
    /** Timestamp when resolved (ms since epoch) */
    resolvedAt?: number;
    /** User's response (after resolution) */
    response?: string;
}

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
export interface ListPendingAsksResponse {
    asks: PendingAskData[];
}
