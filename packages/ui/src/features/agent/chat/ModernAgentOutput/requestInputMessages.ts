import { type AgentMessage, AgentMessageType, type AskUserMessageDetails } from '@vertesia/common';
import { getWorkstreamId } from './utils';

export type RequestInputMessageWithUx = AgentMessage & {
    details: AskUserMessageDetails & { ux: NonNullable<AskUserMessageDetails['ux']> };
};

export function getAgentMessageText(message: AgentMessage): string {
    if (!message.message) return '';
    if (typeof message.message === 'object') return JSON.stringify(message.message, null, 2);
    return String(message.message).trim();
}

export function getRequestInputDisplayText(message: AgentMessage): string {
    const toolApproval = getRecord((message.details as Record<string, unknown> | undefined)?.tool_approval);
    if (!toolApproval) return getAgentMessageText(message);

    const title = getString(toolApproval.tool_title) ?? getString(toolApproval.tool_name);
    const target = formatToolApprovalTargetForDisplay(getString(toolApproval.target));
    if (title && target) return `Approve ${title}: ${target}?`;

    const actionSummary = getString(toolApproval.action_summary);
    if (actionSummary) return `Approve ${formatToolApprovalActionSummaryForDisplay(actionSummary)}?`;

    return getAgentMessageText(message);
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function formatToolApprovalActionSummaryForDisplay(actionSummary: string): string {
    return actionSummary.replace(/:\s*name(?::|\s+)/i, ': ');
}

function formatToolApprovalTargetForDisplay(target: string | undefined): string | undefined {
    if (!target) return undefined;

    const separatorIndex = target.indexOf(':');
    if (separatorIndex < 0) return target;

    const key = target.slice(0, separatorIndex);
    const value = target.slice(separatorIndex + 1).trim();
    if (!value) return target;

    switch (key) {
        case 'document_id':
            return `document ${value}`;
        case 'object_id':
            return `object ${value}`;
        case 'collection_id':
            return `collection ${value}`;
        case 'process_id':
            return `process ${value}`;
        case 'process_definition_id':
            return `process definition ${value}`;
        case 'interaction_id':
            return `interaction ${value}`;
        case 'prompt_id':
            return `prompt ${value}`;
        case 'dashboard_id':
            return `dashboard ${value}`;
        case 'database_id':
            return `database ${value}`;
        case 'table_id':
            return `table ${value}`;
        default:
            return value;
    }
}

export function hasRequestInputUx(message: AgentMessage): message is RequestInputMessageWithUx {
    const details = message.details as AskUserMessageDetails | undefined;
    return message.type === AgentMessageType.REQUEST_INPUT && !!details?.ux;
}

export function getRequestInputMessageKey(message: AgentMessage): string {
    const details = message.details as Record<string, unknown> | undefined;
    const keyParts = [
        details?.request_id,
        details?.requestId,
        details?.activity_id,
        details?.activityId,
        details?.tool_run_id,
        details?.toolRunId,
        message.timestamp,
        getAgentMessageText(message),
    ];
    return keyParts
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map(String)
        .join('|');
}

export function getRequestInputId(message: AgentMessage): string | undefined {
    const details = message.details as Record<string, unknown> | undefined;
    const requestId = details?.request_id ?? details?.tool_use_id;
    return typeof requestId === 'string' && requestId ? requestId : undefined;
}

export function getRequestInputResolutionKey(message: AgentMessage): string {
    return getRequestInputId(message) ?? getRequestInputMessageKey(message);
}

const ANSWERED_REQUEST_INPUT_STORAGE_PREFIX = 'vertesia:answered-request-input:';

function getAnsweredRequestInputStorageKey(agentRunId: string, requestId: string): string {
    return `${ANSWERED_REQUEST_INPUT_STORAGE_PREFIX}${agentRunId}:${requestId}`;
}

export function markRequestInputIdAnsweredForSession(agentRunId: string, requestId: string): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(getAnsweredRequestInputStorageKey(agentRunId, requestId), '1');
    } catch {
        // Session storage can be unavailable in privacy-restricted browser contexts.
    }
}

export function clearRequestInputIdAnsweredForSession(agentRunId: string, requestId: string): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(getAnsweredRequestInputStorageKey(agentRunId, requestId));
    } catch {
        // Session storage can be unavailable in privacy-restricted browser contexts.
    }
}

export function isRequestInputAnsweredForSession(agentRunId: string, message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.REQUEST_INPUT) return false;

    const requestId = getRequestInputId(message);
    if (!requestId || typeof window === 'undefined') return false;

    try {
        return window.sessionStorage.getItem(getAnsweredRequestInputStorageKey(agentRunId, requestId)) === '1';
    } catch {
        return false;
    }
}

function getRequestInputResponseId(message: AgentMessage): string | undefined {
    if (message.type !== AgentMessageType.QUESTION) return undefined;

    const details = getRecord(message.details);
    const metadata = getRecord(details?.metadata);
    const response = getRecord(details?.request_input_response) ?? getRecord(metadata?.request_input_response);
    const requestId = response?.request_id;
    return typeof requestId === 'string' && requestId ? requestId : undefined;
}

export function getRequestInputAnswerMessageKey(message: AgentMessage): string {
    const details = message.details as Record<string, unknown> | undefined;
    const keyParts = [
        details?.ack,
        details?._messageId,
        details?._deliveryStatus,
        message.timestamp,
        getWorkstreamId(message),
        getAgentMessageText(message),
    ];
    return keyParts
        .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
        .map(String)
        .join('|');
}

export function getAnsweredRequestInputKeys(messages: AgentMessage[]): Set<string> {
    const answered = new Set<string>();
    const latestResponseIndexByRequestId = new Map<string, number>();
    messages.forEach((message, index) => {
        const requestId = getRequestInputResponseId(message);
        if (requestId) latestResponseIndexByRequestId.set(requestId, index);
    });

    messages.forEach((message, index) => {
        if (message.type !== AgentMessageType.REQUEST_INPUT) return;

        const requestId = getRequestInputId(message);
        const correlatedResponseIndex = requestId ? latestResponseIndexByRequestId.get(requestId) : undefined;
        if (correlatedResponseIndex !== undefined && correlatedResponseIndex > index) {
            answered.add(getRequestInputMessageKey(message));
            return;
        }

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;

            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                if (!getRequestInputResponseId(nextMessage)) {
                    answered.add(getRequestInputMessageKey(message));
                }
                break;
            }
        }
    });

    return answered;
}

export function getRequestInputResponseMetadata(
    message: AgentMessage,
    metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
    const requestId = getRequestInputId(message);
    if (!requestId) return metadata;

    return {
        ...metadata,
        request_input_response: { request_id: requestId },
    };
}

export function sendRequestInputResponse(
    onSendMessage: ((message: string, metadata?: Record<string, unknown>) => void) | undefined,
    requestMessage: AgentMessage,
    response: string,
    metadata?: Record<string, unknown>,
): void {
    if (!onSendMessage) return;

    const responseMetadata = getRequestInputResponseMetadata(requestMessage, metadata);
    if (responseMetadata) {
        onSendMessage(response, responseMetadata);
    } else {
        onSendMessage(response);
    }
}

export function getRequestInputResponseIdFromMetadata(metadata?: Record<string, unknown>): string | undefined {
    const response = getRecord(metadata?.request_input_response);
    const requestId = response?.request_id;
    return typeof requestId === 'string' && requestId ? requestId : undefined;
}

/**
 * Prefix marking a resolution that belongs to ONE request rather than to every prompt sharing an
 * approval key. Approval keys are `tool_name:target`, so the same action repeats across turns.
 */
const RESOLVED_REQUEST_ID_PREFIX = 'request:';

export function getResolvedToolApprovalKeys(messages: AgentMessage[]): Set<string> {
    const resolved = new Set<string>();

    for (const message of messages) {
        const details = getRecord(message.details);
        const approvalRequest = getRecord(details?.approval_request);
        const approvalKey = approvalRequest?.approval_key;
        const decision = details?.approval_decision;

        // Released without a user answer (approval mode change, or the reviewer allowed it after the
        // run switched to auto_review). Scoped to the released request: a later prompt for the same
        // action still has to be answered, or the run would wait with nothing on screen.
        if (decision === 'auto_approved') {
            const requestId = details?.request_id;
            if (typeof requestId === 'string' && requestId) {
                resolved.add(`${RESOLVED_REQUEST_ID_PREFIX}${requestId}`);
            }
            continue;
        }

        if (
            typeof approvalKey === 'string' &&
            (decision === 'denied' ||
                decision === 'denied_with_feedback' ||
                decision === 'timeout' ||
                decision === 'reviewer_denied' ||
                decision === 'cancelled_after_denial')
        ) {
            resolved.add(approvalKey);
        }
    }

    return resolved;
}

function getToolApprovalKey(message: AgentMessage): string | undefined {
    const details = getRecord(message.details);
    const toolApproval = getRecord(details?.tool_approval);
    const approvalKey = toolApproval?.approval_key;
    return typeof approvalKey === 'string' ? approvalKey : undefined;
}

export function isToolApprovalRequestInput(message: AgentMessage): boolean {
    return message.type === AgentMessageType.REQUEST_INPUT && getToolApprovalKey(message) !== undefined;
}

const TOOL_APPROVAL_OPTION_DECISIONS = new Set(['allow_once', 'allow_for_run', 'deny']);

/**
 * Metadata to attach when the user picks an option on a tool-approval prompt, so the workflow
 * reads the decision structurally instead of from the message text (which clients may decorate,
 * e.g. with an attachments footer). Returns undefined for non-approval prompts or unknown options.
 */
export function getToolApprovalResponseMetadata(
    message: AgentMessage,
    optionId: string,
): Record<string, unknown> | undefined {
    const approvalKey = getToolApprovalKey(message);
    if (!approvalKey || !TOOL_APPROVAL_OPTION_DECISIONS.has(optionId)) return undefined;
    return { tool_approval_response: { decision: optionId, approval_key: approvalKey } };
}

/** The structured decision of "Edit and run": run the call once with the reviewer's arguments. */
export const TOOL_APPROVAL_EDIT_DECISION = 'allow_edited';

/** What the workflow shows in place of a secret; the reviewer edits around it, never through it. */
export const TOOL_APPROVAL_REDACTED_PLACEHOLDER = '[REDACTED]';

// Keep credential names aligned with workflows/src/tools/approval.ts, which owns the dispatch guard.
const SECRET_INPUT_KEY = /(api[_-]?key|authorization|cookie|credential|password|private[_-]?key|secret|session|token)/i;

export interface ToolApprovalEditConfig {
    /** The call's arguments as the prompt shows them, secrets already redacted. */
    input: Record<string, unknown>;
    /** Paths of the redacted values (`headers.authorization`, `items[0].token`); they cannot be changed. */
    redactedPaths: string[];
}

function holdsPlaceholder(value: unknown): boolean {
    if (value === TOOL_APPROVAL_REDACTED_PLACEHOLDER) return true;
    if (typeof value === 'string') {
        // JSON text: the workflow redacts the secrets inside it.
        const decoded = decodeJsonText(value);
        return decoded !== value && holdsPlaceholder(decoded);
    }
    if (Array.isArray(value)) return value.some(holdsPlaceholder);
    const record = getRecord(value);
    return !!record && Object.values(record).some(holdsPlaceholder);
}

function collectRedactedPaths(value: unknown, path: string, out: string[]): void {
    if (value === TOOL_APPROVAL_REDACTED_PLACEHOLDER) {
        out.push(path);
        return;
    }
    if (typeof value === 'string') {
        const decoded = decodeJsonText(value);
        if (decoded !== value) collectRedactedPaths(decoded, path, out);
        return;
    }
    if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) collectRedactedPaths(item, `${path}[${index}]`, out);
        return;
    }
    const record = getRecord(value);
    if (!record) return;
    for (const [key, child] of Object.entries(record)) {
        collectRedactedPaths(child, path ? `${path}.${key}` : key, out);
    }
}

/**
 * The arguments a reviewer can edit, when the prompt offers "Edit and run". Only a worker that can run an edited call
 * sets `tool_approval.supports_edit`, so a prompt from an older worker never shows the action.
 */
export function getToolApprovalEditConfig(message: AgentMessage): ToolApprovalEditConfig | undefined {
    if (message.type !== AgentMessageType.REQUEST_INPUT) return undefined;
    const toolApproval = getRecord(getRecord(message.details)?.tool_approval);
    if (toolApproval?.supports_edit !== true || typeof toolApproval.approval_key !== 'string') return undefined;
    const input = getRecord(toolApproval.input);
    if (!input) return undefined;
    const redactedPaths: string[] = [];
    collectRedactedPaths(input, '', redactedPaths);
    return { input, redactedPaths };
}

/** Metadata of an "Edit and run" answer: the decision, the prompt it answers, and the edited arguments. */
export function getToolApprovalEditResponseMetadata(
    message: AgentMessage,
    input: Record<string, unknown>,
): Record<string, unknown> | undefined {
    const approvalKey = getToolApprovalKey(message);
    if (!approvalKey) return undefined;
    const requestId = getRequestInputId(message);
    return {
        tool_approval_response: {
            decision: TOOL_APPROVAL_EDIT_DECISION,
            approval_key: approvalKey,
            ...(requestId ? { request_id: requestId } : {}),
            input,
        },
    };
}

export type ToolApprovalEditProblem =
    | { code: 'invalid_json' }
    | { code: 'not_object' }
    | { code: 'redacted_changed'; path: string }
    | { code: 'secret_added'; path: string }
    | { code: 'secret_changed'; path: string }
    | { code: 'locked_array_changed'; path: string }
    | { code: 'placeholder_added'; path: string };

/**
 * JSON text the workflow would read as an object or array. Its schema check decodes such a string before the tool
 * runs, so the client checks what the string decodes to as well.
 */
function decodeJsonText(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
        return value;
    }
    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return value;
    }
}

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    const record = getRecord(value);
    if (record) {
        return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value) ?? 'undefined';
}

function findLockedEditProblem(shown: unknown, edited: unknown, path: string): ToolApprovalEditProblem | undefined {
    if (shown === TOOL_APPROVAL_REDACTED_PLACEHOLDER) {
        return edited === shown ? undefined : { code: 'redacted_changed', path };
    }
    // Either side may be JSON text: the workflow redacts inside it and merges the secrets back once decoded.
    const shownValue = decodeJsonText(shown);
    const decoded = decodeJsonText(edited);
    if (Array.isArray(shownValue)) {
        if (holdsPlaceholder(shownValue) && canonicalJson(decoded) !== canonicalJson(shownValue)) {
            return { code: 'locked_array_changed', path };
        }
        if (!Array.isArray(decoded)) return undefined;
        for (const [index, item] of shownValue.entries()) {
            if (index >= decoded.length) continue;
            const problem = findLockedEditProblem(item, decoded[index], `${path}[${index}]`);
            if (problem) return problem;
        }
        return undefined;
    }
    const originalRecord = getRecord(shownValue);
    const editedRecord = getRecord(decoded);
    if (!originalRecord || !editedRecord) return undefined;
    for (const [key, child] of Object.entries(originalRecord)) {
        if (!Object.hasOwn(editedRecord, key)) continue;
        const problem = findLockedEditProblem(child, editedRecord[key], path ? `${path}.${key}` : key);
        if (problem) return problem;
    }
    return undefined;
}

/** Same comparison as the workflow: a primitive the schema may coerce (`123` and `'123'`) is the same credential. */
function sameSecretValue(shown: unknown, edited: unknown): boolean {
    const a = decodeJsonText(shown);
    const b = decodeJsonText(edited);
    if ((a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')) {
        return canonicalJson(a) === canonicalJson(b);
    }
    return String(a) === String(b);
}

/**
 * Credentials the edit adds or changes. A credential inside JSON text reaches the client unredacted (redaction works
 * on keys, not on string contents), so its value is compared here too: the workflow refuses a changed one, but only
 * after the new value has been sent.
 */
function findAddedSecret(original: unknown, edited: unknown, path: string): ToolApprovalEditProblem | undefined {
    const shown = decodeJsonText(original);
    const decoded = decodeJsonText(edited);
    if (Array.isArray(decoded)) {
        const originalItems = Array.isArray(shown) ? shown : [];
        for (const [index, item] of decoded.entries()) {
            const problem = findAddedSecret(originalItems[index], item, `${path}[${index}]`);
            if (problem) return problem;
        }
        return undefined;
    }
    const record = getRecord(decoded);
    if (!record) return undefined;
    const originalRecord = getRecord(shown);
    for (const [key, child] of Object.entries(record)) {
        const childPath = path ? `${path}.${key}` : key;
        if (SECRET_INPUT_KEY.test(key)) {
            if (!originalRecord || !Object.hasOwn(originalRecord, key)) {
                return { code: 'secret_added', path: childPath };
            }
            if (!sameSecretValue(originalRecord[key], child)) {
                return { code: 'secret_changed', path: childPath };
            }
            continue;
        }
        const problem = findAddedSecret(originalRecord?.[key], child, childPath);
        if (problem) return problem;
    }
    return undefined;
}

function findAddedPlaceholder(original: unknown, edited: unknown, path: string): string | undefined {
    if (typeof edited === 'string') {
        if (original === edited) return undefined;
        const decoded = decodeJsonText(edited);
        // An escaped placeholder (`\u005BREDACTED]`) only shows once the JSON text is decoded.
        if (decoded !== edited) return findAddedPlaceholder(decodeJsonText(original), decoded, path);
        return edited.includes(TOOL_APPROVAL_REDACTED_PLACEHOLDER) ? path || '$' : undefined;
    }
    // The prompt may show JSON text that the reviewer rewrote as an object or array.
    const shownValue = decodeJsonText(original);
    if (Array.isArray(edited)) {
        const originalItems = Array.isArray(shownValue) ? shownValue : [];
        for (const [index, item] of edited.entries()) {
            const found = findAddedPlaceholder(originalItems[index], item, `${path}[${index}]`);
            if (found) return found;
        }
        return undefined;
    }
    const record = getRecord(edited);
    if (!record) return undefined;
    const originalRecord = getRecord(shownValue);
    for (const [key, child] of Object.entries(record)) {
        const childPath = path ? `${path}.${key}` : key;
        if (
            key.includes(TOOL_APPROVAL_REDACTED_PLACEHOLDER) &&
            !(originalRecord && Object.hasOwn(originalRecord, key))
        ) {
            return childPath;
        }
        const found = findAddedPlaceholder(originalRecord?.[key], child, childPath);
        if (found) return found;
    }
    return undefined;
}

/**
 * Check an edit before sending it, so the reviewer sees the problem at once. The workflow checks again and is the
 * authority: it merges the secrets back and refuses anything that would let a placeholder reach the tool.
 */
export function validateToolApprovalEdit(
    config: ToolApprovalEditConfig,
    text: string,
): { input: Record<string, unknown> } | { problem: ToolApprovalEditProblem } {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return { problem: { code: 'invalid_json' } };
    }
    const input = getRecord(parsed);
    if (!input) return { problem: { code: 'not_object' } };
    // Walk the original keys directly: tool arguments can contain literal dots and brackets in their names.
    const lockedProblem = findLockedEditProblem(config.input, input, '');
    if (lockedProblem) return { problem: lockedProblem };
    const secretProblem = findAddedSecret(config.input, input, '');
    if (secretProblem) return { problem: secretProblem };
    const added = findAddedPlaceholder(config.input, input, '');
    if (added) return { problem: { code: 'placeholder_added', path: added } };
    return { input };
}

function isToolApprovalOptionResponse(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.QUESTION) return false;
    const normalized = getAgentMessageText(message).trim().toLowerCase();
    return normalized === 'allow_once' || normalized === 'allow_for_run' || normalized === 'deny';
}

function isToolApprovalMetadataResponse(message: AgentMessage): boolean {
    if (message.type !== AgentMessageType.QUESTION) return false;
    const details = getRecord(message.details);
    const metadata = getRecord(details?.metadata);
    const toolApprovalResponse =
        getRecord(details?.tool_approval_response) ?? getRecord(metadata?.tool_approval_response);
    const decision = toolApprovalResponse?.decision;
    return (
        decision === 'deny_with_feedback' ||
        decision === TOOL_APPROVAL_EDIT_DECISION ||
        (typeof decision === 'string' && TOOL_APPROVAL_OPTION_DECISIONS.has(decision))
    );
}

function isToolApprovalResponse(message: AgentMessage): boolean {
    return isToolApprovalOptionResponse(message) || isToolApprovalMetadataResponse(message);
}

export function isRequestInputResolvedByToolApprovalEvent(
    message: AgentMessage,
    resolvedToolApprovalKeys: Set<string>,
): boolean {
    if (message.type !== AgentMessageType.REQUEST_INPUT) return false;
    const requestId = getRequestInputId(message);
    if (requestId && resolvedToolApprovalKeys.has(`${RESOLVED_REQUEST_ID_PREFIX}${requestId}`)) return true;
    const approvalKey = getToolApprovalKey(message);
    return approvalKey ? resolvedToolApprovalKeys.has(approvalKey) : false;
}

export function getAnsweredToolApprovalRequestInputKeys(messages: AgentMessage[]): Set<string> {
    const answered = new Set<string>();

    messages.forEach((message, index) => {
        if (!isToolApprovalRequestInput(message)) return;

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;
            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                if (isToolApprovalResponse(nextMessage)) {
                    answered.add(getRequestInputMessageKey(message));
                }
                break;
            }
        }
    });

    return answered;
}

export function isToolApprovalRequestInputHidden(
    message: AgentMessage,
    answeredToolApprovalRequestInputKeys: Set<string>,
    resolvedToolApprovalKeys: Set<string>,
): boolean {
    return (
        isToolApprovalRequestInput(message) &&
        (answeredToolApprovalRequestInputKeys.has(getRequestInputMessageKey(message)) ||
            isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys))
    );
}

export function getHiddenToolApprovalAnswerKeys(
    messages: AgentMessage[],
    resolvedToolApprovalKeys?: Set<string>,
): Set<string> {
    const hidden = new Set<string>();

    messages.forEach((message, index) => {
        if (
            !isToolApprovalRequestInput(message) ||
            (resolvedToolApprovalKeys && !isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys))
        ) {
            return;
        }

        const workstreamId = getWorkstreamId(message);
        for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
            const nextMessage = messages[nextIndex];
            if (getWorkstreamId(nextMessage) !== workstreamId) continue;
            if (nextMessage.type === AgentMessageType.REQUEST_INPUT) break;
            if (nextMessage.type === AgentMessageType.QUESTION) {
                if (isToolApprovalOptionResponse(nextMessage)) {
                    hidden.add(getRequestInputAnswerMessageKey(nextMessage));
                }
                break;
            }
        }
    });

    return hidden;
}

export function isToolApprovalAnswerHidden(message: AgentMessage, hiddenToolApprovalAnswerKeys: Set<string>): boolean {
    return (
        message.type === AgentMessageType.QUESTION &&
        hiddenToolApprovalAnswerKeys.has(getRequestInputAnswerMessageKey(message))
    );
}

export function isRequestInputAnswered(message: AgentMessage, answeredRequestInputKeys: Set<string>): boolean {
    return (
        message.type === AgentMessageType.REQUEST_INPUT &&
        answeredRequestInputKeys.has(getRequestInputMessageKey(message))
    );
}

export function getPendingRequestInputMessage(
    messages: AgentMessage[],
    workstreamId = 'main',
    locallyAnsweredRequestInputKeys?: ReadonlySet<string>,
): RequestInputMessageWithUx | undefined {
    const answeredRequestInputKeys = getAnsweredRequestInputKeys(messages);
    const resolvedToolApprovalKeys = getResolvedToolApprovalKeys(messages);

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!hasRequestInputUx(message)) continue;
        if (getWorkstreamId(message) !== workstreamId) continue;
        if (locallyAnsweredRequestInputKeys?.has(getRequestInputResolutionKey(message))) continue;
        if (isRequestInputAnswered(message, answeredRequestInputKeys)) continue;
        if (isRequestInputResolvedByToolApprovalEvent(message, resolvedToolApprovalKeys)) continue;
        return message;
    }

    return undefined;
}
