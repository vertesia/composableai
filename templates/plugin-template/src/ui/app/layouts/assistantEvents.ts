export const OPEN_ASSISTANT_EVENT = "plugin:open-assistant";

export interface OpenAssistantDetail {
    initialMessage?: string;
    agentRunId?: string;
}

export function openAssistant(initialMessage?: string, agentRunId?: string): void {
    const event = new CustomEvent<OpenAssistantDetail>(OPEN_ASSISTANT_EVENT, {
        detail: { initialMessage, agentRunId },
    });
    window.dispatchEvent(event);
}
