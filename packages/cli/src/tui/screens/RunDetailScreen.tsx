import { Box, Text } from 'ink';
import type { WorkflowRun } from '@vertesia/common';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';
import { MessageList } from '../components/MessageList.js';

export function RunDetailScreen() {
    const { client } = useClient();
    const { current } = useNavigation();
    const runId = current.params?.runId as string;
    const workflowId = current.params?.workflowId as string;
    const run = current.params?.run as WorkflowRun | undefined;

    const { data: messages, loading, error } = useAsyncData(
        async () => {
            if (!client || !workflowId || !runId) return [];
            return client.workflows.retrieveMessages(workflowId, runId);
        },
        [client, workflowId, runId],
    );

    return (
        <Box flexDirection="column">
            <Box justifyContent="space-between">
                <Text bold color="cyan">
                    Run: {run?.interaction_name || 'Unknown'}
                </Text>
                <Text color={getStatusColor(run?.status)}>
                    {run?.status || 'Unknown'}
                </Text>
            </Box>

            <Box gap={2}>
                <Text color="gray">Started: {run?.started_at ? new Date(run.started_at).toLocaleString() : '?'}</Text>
                {run?.closed_at && (
                    <Text color="gray">Ended: {new Date(run.closed_at).toLocaleString()}</Text>
                )}
            </Box>

            {run?.topic && (
                <Text color="white" wrap="wrap">{run.topic}</Text>
            )}

            <Box flexDirection="column" marginTop={1}>
                <Text bold color="white">Messages</Text>
                {loading ? (
                    <Spinner label="Loading messages..." />
                ) : error ? (
                    <ErrorBox message={error} />
                ) : messages && messages.length > 0 ? (
                    <MessageList messages={messages} maxVisible={50} />
                ) : (
                    <Text color="gray">No messages</Text>
                )}
            </Box>
        </Box>
    );
}

function getStatusColor(status?: unknown): string {
    switch (String(status || '').toLowerCase()) {
        case 'completed': return 'green';
        case 'running': return 'cyan';
        case 'failed': return 'red';
        case 'terminated': case 'canceled': return 'yellow';
        default: return 'gray';
    }
}
