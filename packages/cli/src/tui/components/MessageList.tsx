import { Box } from 'ink';
import type { AgentMessage } from '@vertesia/common';
import { AgentMessageType } from '@vertesia/common';
import { MessageBubble } from './MessageBubble.js';

interface MessageListProps {
    messages: AgentMessage[];
    maxVisible?: number;
}

/**
 * Scrollable message list showing the most recent messages.
 * Filters out STREAMING_CHUNK and heartbeat messages for display.
 */
export function MessageList({ messages, maxVisible = 30 }: MessageListProps) {
    // Filter out streaming chunks and show meaningful messages
    const displayMessages = messages.filter(m =>
        m.type !== AgentMessageType.STREAMING_CHUNK &&
        m.type !== AgentMessageType.IDLE &&
        m.type !== AgentMessageType.BATCH_PROGRESS &&
        m.message
    );

    // Show only the most recent messages
    const visible = displayMessages.slice(-maxVisible);

    return (
        <Box flexDirection="column">
            {visible.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
            ))}
        </Box>
    );
}
