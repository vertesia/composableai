import { Box, Text } from 'ink';
import type { AgentMessage } from '@vertesia/common';

interface PlanPanelProps {
    message: AgentMessage;
}

interface PlanTask {
    goal: string;
    instructions?: string[];
    status?: string;
}

export function PlanPanel({ message }: PlanPanelProps) {
    let tasks: PlanTask[] = [];

    try {
        if (message.details?.plan) {
            const plan = Array.isArray(message.details.plan)
                ? message.details.plan
                : JSON.parse(message.details.plan);
            tasks = plan;
        }
    } catch {
        // If parsing fails, show raw message
    }

    return (
        <Box flexDirection="column">
            <Text bold color="magenta">Plan</Text>
            {tasks.length > 0 ? (
                tasks.map((task, i) => (
                    <Box key={i} flexDirection="column" marginTop={i > 0 ? 1 : 0}>
                        <Text color={getStatusColor(task.status)}>
                            {getStatusIcon(task.status)} {i + 1}. {task.goal}
                        </Text>
                        {task.instructions?.map((instr, j) => (
                            <Text key={j} color="gray">
                                {'   '}{'\u2022'} {instr}
                            </Text>
                        ))}
                    </Box>
                ))
            ) : (
                <Text color="gray">{message.message || 'No plan details'}</Text>
            )}
        </Box>
    );
}

function getStatusColor(status?: string): string {
    switch (status) {
        case 'completed': case 'done': return 'green';
        case 'in_progress': case 'running': return 'cyan';
        case 'failed': return 'red';
        default: return 'white';
    }
}

function getStatusIcon(status?: string): string {
    switch (status) {
        case 'completed': case 'done': return '\u2713';
        case 'in_progress': case 'running': return '\u25cf';
        case 'failed': return '\u2717';
        default: return '\u25cb';
    }
}
