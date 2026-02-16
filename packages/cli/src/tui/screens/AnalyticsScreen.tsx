import { Box, Text } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';

export function AnalyticsScreen() {
    const { client } = useClient();

    const { data, loading, error } = useAsyncData(
        async () => {
            if (!client) return null;

            // Get recent runs for basic statistics
            const result = await client.workflows.listConversations({
                page_size: 100,
                type: 'conversation',
            });

            const runs = result.runs;
            const total = runs.length;
            const completed = runs.filter(r => String(r.status || '').toLowerCase() === 'completed').length;
            const failed = runs.filter(r => String(r.status || '').toLowerCase() === 'failed').length;
            const running = runs.filter(r => String(r.status || '').toLowerCase() === 'running').length;

            // Count by interaction name
            const byAgent: Record<string, number> = {};
            for (const run of runs) {
                const name = run.interaction_name || 'Unknown';
                byAgent[name] = (byAgent[name] || 0) + 1;
            }

            return { total, completed, failed, running, byAgent };
        },
        [client],
    );

    if (loading) return <Spinner label="Loading analytics..." />;
    if (error) return <ErrorBox message={error} />;
    if (!data) return <Text color="gray">No data available</Text>;

    return (
        <Box flexDirection="column" gap={1}>
            <Text bold color="cyan">Analytics (Recent 100 Runs)</Text>

            <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
                <Text bold>Run Status Summary</Text>
                <Text color="green">  Completed: {data.completed}</Text>
                <Text color="red">  Failed:    {data.failed}</Text>
                <Text color="cyan">  Running:   {data.running}</Text>
                <Text color="gray">  Total:     {data.total}</Text>
            </Box>

            <Box flexDirection="column">
                <Text bold>Runs by Agent</Text>
                {Object.entries(data.byAgent)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([name, count]) => (
                        <Box key={name}>
                            <Text color="white">  {name}</Text>
                            <Text color="gray"> - {count} runs</Text>
                        </Box>
                    ))
                }
            </Box>
        </Box>
    );
}
