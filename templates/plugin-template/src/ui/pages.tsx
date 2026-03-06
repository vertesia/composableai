import { useCallback } from "react";
import { Bot } from "lucide-react";
import { ModernAgentConversation } from "@vertesia/ui/features";
import { Button } from "@vertesia/ui/core";
import { useNavigate, useParams } from "@vertesia/ui/router";
import { useUserSession } from "@vertesia/ui/session";
import type { CreateAgentRunPayload } from "@vertesia/common";
import { ASSISTANT_INTERACTION } from "./constants";

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
    const { store } = useUserSession();
    const navigate = useNavigate();
    const params = useParams();
    const { runId, workflowId } = params as { runId?: string; workflowId?: string };

    const run = runId && workflowId ? { run_id: runId, workflow_id: workflowId } : null;

    const startWorkflow = useCallback(async (initialMessage?: string) => {
        const payload: CreateAgentRunPayload = {
            interaction: ASSISTANT_INTERACTION,
            interactive: true,
            data: { user_prompt: initialMessage || '' },
        };
        const result = await store.agents.start(payload);
        if (result) {
            const runData = { run_id: result.first_workflow_run_id!, workflow_id: result.workflow_id! };
            navigate(`/chat/${result.first_workflow_run_id}/${result.workflow_id}`);
            return runData;
        }
        return undefined;
    }, [store, navigate]);

    const handleReset = useCallback(() => navigate('/chat'), [navigate]);

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
