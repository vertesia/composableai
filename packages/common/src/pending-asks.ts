import type * as Wire from './wire-types.generated.js';

// ================= Pending Ask Data ====================

/**
 * Status of a pending ask request.
 */
export type PendingAskStatus = Wire.PendingAskStatus;

/**
 * Data stored in Redis for pending ask_user requests.
 * Tracks which agents are waiting for user input and enables
 * both webhook notifications and portal views.
 */
export type PendingAskData = Wire.PendingAskData;

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
export type RegisterPendingAskRequest = Wire.RegisterPendingAskRequest;
export type RegisterPendingAskResponse = Wire.RegisterPendingAskResponse;
export type ResolvePendingAskRequest = Wire.ResolvePendingAskRequest;
export type ResolvePendingAskResponse = Wire.ResolvePendingAskResponse;
export type ListPendingAsksResponse = Wire.ListPendingAsksResponse;
