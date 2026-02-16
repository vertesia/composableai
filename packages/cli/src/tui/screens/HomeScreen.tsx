import { Box, Text } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';
import { useAsyncData } from '../hooks/useAsyncData.js';

export function HomeScreen() {
    const { client, loading: clientLoading, error: clientError } = useClient();

    const { data: recentRuns, loading: runsLoading } = useAsyncData(
        async () => {
            if (!client) return null;
            const result = await client.workflows.listConversations({
                page_size: 5,
                type: 'conversation',
            });
            return result.runs;
        },
        [client],
    );

    if (clientLoading) return <Spinner label="Connecting to Vertesia..." />;
    if (clientError) return <ErrorBox message={clientError} />;

    return (
        <Box flexDirection="column" gap={1}>
            <Box flexDirection="column">
                <Text bold color="cyan">Welcome to Vertesia Agent TUI</Text>
                <Text color="gray">Use number keys or Tab to navigate between sections</Text>
            </Box>

            <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
                <Text bold color="white">Quick Actions</Text>
                <Text color="gray">  2  Browse and launch agents</Text>
                <Text color="gray">  3  View run history</Text>
                <Text color="gray">  4  Manage documents</Text>
                <Text color="gray">  5  Browse skills</Text>
            </Box>

            <Box flexDirection="column">
                <Text bold color="white">Recent Runs</Text>
                {runsLoading ? (
                    <Spinner label="Loading recent runs..." />
                ) : recentRuns && recentRuns.length > 0 ? (
                    recentRuns.map((run, i) => (
                        <Box key={run.run_id || i}>
                            <Text color={getStatusColor(run.status)}>
                                {getStatusIcon(run.status)}{' '}
                            </Text>
                            <Text color="white">
                                {run.interaction_name || run.type || 'Unknown'}
                            </Text>
                            <Text color="gray">
                                {' '} - {run.topic || 'No topic'}
                                {run.started_at ? ` (${formatRelativeTime(run.started_at)})` : ''}
                            </Text>
                        </Box>
                    ))
                ) : (
                    <Text color="gray">  No recent runs</Text>
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

function getStatusIcon(status?: unknown): string {
    switch (String(status || '').toLowerCase()) {
        case 'completed': return '\u2713';
        case 'running': return '\u25cf';
        case 'failed': return '\u2717';
        case 'terminated': case 'canceled': return '\u25cb';
        default: return '\u2022';
    }
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
}
