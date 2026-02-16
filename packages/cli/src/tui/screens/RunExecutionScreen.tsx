import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AgentMessageType, type UserInputSignal } from '@vertesia/common';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useStreamMessages } from '../hooks/useStreamMessages.js';
import { Spinner } from '../components/Spinner.js';
import { MessageList } from '../components/MessageList.js';
import { PlanPanel } from '../components/PlanPanel.js';

export function RunExecutionScreen() {
    const { client } = useClient();
    const { current } = useNavigation();
    const workflowId = current.params?.workflowId as string;
    const runId = current.params?.runId as string;
    const agentName = current.params?.agentName as string;

    const { messages, isStreaming, error, isComplete } = useStreamMessages(client, workflowId, runId);

    const [inputValue, setInputValue] = useState('');
    const [inputMode, setInputMode] = useState(false);
    const [sending, setSending] = useState(false);

    // Extract plan from messages
    const planMessages = messages.filter(
        m => m.type === AgentMessageType.PLAN || m.type === AgentMessageType.UPDATE
    );
    const latestPlan = planMessages.length > 0 ? planMessages[planMessages.length - 1] : null;

    useInput((_input, key) => {
        if (!inputMode && !sending) {
            if (key.return && isStreaming) {
                setInputMode(true);
            }
        }
    });

    async function handleSubmit(value: string) {
        if (!client || !value.trim() || !workflowId || !runId) return;
        setSending(true);
        setInputMode(false);

        try {
            const signal = 'userInput';
            const payload: UserInputSignal = { message: value.trim() };
            await client.workflows.sendSignal(workflowId, runId, signal, payload);
            setInputValue('');
        } catch (err) {
            // Show error in messages area
        } finally {
            setSending(false);
        }
    }

    return (
        <Box flexDirection="column" height="100%">
            <Box justifyContent="space-between">
                <Text bold color="cyan">
                    {agentName || 'Agent Run'}
                </Text>
                <Box gap={1}>
                    <Text color={isStreaming ? 'green' : isComplete ? 'cyan' : 'red'}>
                        {isStreaming ? 'STREAMING' : isComplete ? 'COMPLETE' : error ? 'ERROR' : 'IDLE'}
                    </Text>
                    <Text color="gray">
                        {messages.length} messages
                    </Text>
                </Box>
            </Box>

            <Box flexDirection="row" flexGrow={1} marginTop={1}>
                {/* Main message area */}
                <Box flexDirection="column" flexGrow={1} flexBasis="70%">
                    <MessageList messages={messages} />
                </Box>

                {/* Plan sidebar */}
                {latestPlan && (
                    <Box flexDirection="column" flexBasis="30%" borderStyle="single"
                         borderLeft={true} borderRight={false} borderTop={false}
                         borderBottom={false} paddingLeft={1}>
                        <PlanPanel message={latestPlan} />
                    </Box>
                )}
            </Box>

            {/* Input area */}
            <Box borderStyle="single" borderTop={true} borderBottom={false}
                 borderLeft={false} borderRight={false} paddingX={1}>
                {sending ? (
                    <Spinner label="Sending..." />
                ) : inputMode ? (
                    <Box>
                        <Text color="green">{`> `}</Text>
                        <TextInput
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={handleSubmit}
                            placeholder="Type your message..."
                        />
                    </Box>
                ) : (
                    <Text color="gray">
                        {isStreaming ? 'Press Enter to send a message' : isComplete ? 'Run complete. Esc to go back.' : ''}
                        {error ? `Error: ${error}` : ''}
                    </Text>
                )}
            </Box>
        </Box>
    );
}
