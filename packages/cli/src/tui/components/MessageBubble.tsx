import { Box, Text } from 'ink';
import { AgentMessageType, type AgentMessage } from '@vertesia/common';
import { Markdown } from './Markdown.js';

const TYPE_ICONS: Partial<Record<AgentMessageType, string>> = {
    [AgentMessageType.SYSTEM]: '\u2630',     // hamburger
    [AgentMessageType.THOUGHT]: '?',
    [AgentMessageType.PLAN]: '\u2192',       // arrow right
    [AgentMessageType.UPDATE]: '\u2191',     // arrow up
    [AgentMessageType.COMPLETE]: '\u2713',   // tick
    [AgentMessageType.WARNING]: '\u26a0',    // warning
    [AgentMessageType.ERROR]: '\u2717',      // cross
    [AgentMessageType.ANSWER]: '\u2605',     // star
    [AgentMessageType.QUESTION]: '?',
    [AgentMessageType.REQUEST_INPUT]: '\u270e', // pencil
};

const TYPE_COLORS: Partial<Record<AgentMessageType, string>> = {
    [AgentMessageType.SYSTEM]: 'blue',
    [AgentMessageType.THOUGHT]: 'magenta',
    [AgentMessageType.PLAN]: 'red',
    [AgentMessageType.UPDATE]: 'cyan',
    [AgentMessageType.COMPLETE]: 'green',
    [AgentMessageType.WARNING]: 'yellow',
    [AgentMessageType.ERROR]: 'red',
    [AgentMessageType.ANSWER]: 'green',
    [AgentMessageType.QUESTION]: 'yellow',
    [AgentMessageType.REQUEST_INPUT]: 'yellow',
};

interface MessageBubbleProps {
    message: AgentMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const icon = TYPE_ICONS[message.type] || '\u2022';
    const color = TYPE_COLORS[message.type] || 'white';
    const typeName = AgentMessageType[message.type] || 'UPDATE';

    const isBoxed = message.type === AgentMessageType.ERROR ||
                    message.type === AgentMessageType.WARNING ||
                    message.type === AgentMessageType.COMPLETE;

    const timestamp = message.timestamp
        ? new Date(message.timestamp).toLocaleTimeString()
        : '';

    if (isBoxed) {
        return (
            <Box flexDirection="column" borderStyle="round"
                 borderColor={color} paddingX={1} marginY={0}>
                <Box>
                    <Text color={color} bold>{icon} {typeName}</Text>
                    <Text color="gray"> {timestamp}</Text>
                </Box>
                <Markdown content={message.message} />
            </Box>
        );
    }

    return (
        <Box>
            <Text color={color}>{icon} </Text>
            <Text color="gray" dimColor>[{typeName}] </Text>
            <Box flexShrink={1}>
                <Markdown content={message.message} />
            </Box>
        </Box>
    );
}
