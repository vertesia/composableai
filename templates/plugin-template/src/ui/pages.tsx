import { useCallback, useState } from "react";
import { Bot } from "lucide-react";
import { ModernAgentConversation } from "@vertesia/ui/features";
import { Button } from "@vertesia/ui/core";
import { useNavigate } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import type { AsyncConversationExecutionPayload } from "@vertesia/common";

// Format: app:<plugin-name>:<collection-name>:<interaction-name>
const ASSISTANT_INTERACTION = "app:my-app:examples:assistant";

export function HomePage() {
    const { user } = useUserSession();
    const navigate = useNavigate();

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-semibold">Welcome, {user?.name || user?.email}!</h1>
            <p className="text-muted">
                This is the plugin template. Use it as a starting point to build your own plugin UI.
            </p>
            <Button variant="outline" onClick={() => navigate('/chat')}>
                <Bot className="size-4 mr-2" />
                Try the Agent Chat
            </Button>
        </div>
    );
}

export function ChatPage() {
    const { client } = useUserSession();
    const [run, setRun] = useState<{ run_id: string; workflow_id: string } | null>(null);

    const startWorkflow = useCallback(async (initialMessage?: string) => {
        const payload: AsyncConversationExecutionPayload = {
            type: 'conversation',
            interaction: ASSISTANT_INTERACTION,
            interactive: true,
            data: { user_prompt: initialMessage || '' },
        };
        const result = await client.interactions.executeAsync(payload);
        if (result) {
            const runData = { run_id: result.runId, workflow_id: result.workflowId };
            setRun(runData);
            return runData;
        }
        return undefined;
    }, [client]);

    const handleReset = useCallback(() => setRun(null), []);

    return (
        <div className="flex flex-col h-full">
            <ModernAgentConversation
                run={run ? { runId: run.run_id, workflowId: run.workflow_id } : undefined}
                startWorkflow={startWorkflow}
                title="Plugin Assistant"
                placeholder="Ask me anything..."
                startButtonText="Start Conversation"
                resetWorkflow={handleReset}
                hideObjectLinking
                interactive
            />
        </div>
    );
}
