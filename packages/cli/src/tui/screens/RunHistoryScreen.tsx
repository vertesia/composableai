import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { WorkflowRun } from '@vertesia/common';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';

export function RunHistoryScreen() {
    const { client } = useClient();
    const { navigate } = useNavigation();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

    const { data, loading, error, refetch } = useAsyncData(
        async () => {
            if (!client) return { runs: [], has_more: false };
            return client.workflows.listConversations({
                page_size: 30,
                type: 'conversation',
                status: statusFilter,
            });
        },
        [client, statusFilter],
    );

    const runs = data?.runs || [];

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
        } else if (key.downArrow) {
            setSelectedIndex(i => Math.min(runs.length - 1, i + 1));
        } else if (key.return && runs.length > 0) {
            const run = runs[selectedIndex];
            if (run.run_id && run.workflow_id) {
                const isRunning = String(run.status || '').toLowerCase() === 'running';
                if (isRunning) {
                    navigate('run-execution', {
                        runId: run.run_id,
                        workflowId: run.workflow_id,
                        agentName: run.interaction_name,
                    });
                } else {
                    navigate('run-detail', {
                        runId: run.run_id,
                        workflowId: run.workflow_id,
                        run,
                    });
                }
            }
        } else if (input === 'r') {
            refetch();
        } else if (input === 'f') {
            // Cycle through status filters
            const filters = [undefined, 'Running', 'Completed', 'Failed', 'Terminated'];
            const currentIdx = filters.indexOf(statusFilter);
            setStatusFilter(filters[(currentIdx + 1) % filters.length]);
            setSelectedIndex(0);
        }
    });

    if (loading) return <Spinner label="Loading run history..." />;
    if (error) return <ErrorBox message={error} onRetry={refetch} />;

    return (
        <Box flexDirection="column">
            <Box justifyContent="space-between">
                <Text bold color="cyan">Run History</Text>
                <Box gap={2}>
                    <Text color="gray">Filter: {statusFilter || 'All'} (f to change)</Text>
                    <Text color="gray">r to refresh</Text>
                </Box>
            </Box>
            <Text> </Text>

            {runs.length === 0 ? (
                <Text color="gray">No runs found</Text>
            ) : (
                runs.map((run, i) => (
                    <RunRow
                        key={run.run_id || i}
                        run={run}
                        selected={i === selectedIndex}
                    />
                ))
            )}

            {data?.has_more && (
                <Text color="gray" dimColor>More runs available...</Text>
            )}
        </Box>
    );
}

function RunRow({ run, selected }: { run: WorkflowRun; selected: boolean }) {
    const statusColor = getStatusColor(run.status);
    const statusIcon = getStatusIcon(run.status);
    const time = run.started_at ? formatTime(run.started_at) : '??';

    return (
        <Box>
            <Text color={selected ? 'green' : 'white'}>
                {selected ? '> ' : '  '}
            </Text>
            <Text color={statusColor}>{statusIcon} </Text>
            <Text bold={selected} color={selected ? 'green' : 'white'}>
                {run.interaction_name || run.type || 'Unknown'}
            </Text>
            <Text color="gray">
                {' '}{run.topic ? `- ${truncate(run.topic, 40)}` : ''}{' '}({time})
            </Text>
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

function formatTime(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleString();
    } catch {
        return dateStr;
    }
}

function truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}
