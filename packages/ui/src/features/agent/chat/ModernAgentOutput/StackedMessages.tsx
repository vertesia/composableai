import { AgentMessage } from "@vertesia/common";
import React from "react";
import MessageItem from "./MessageItem";

interface StackedMessagesProps {
    messages: AgentMessage[];
    isCompleted: boolean;
}

export default function StackedMessages({ messages }: StackedMessagesProps) {
    // Sort all messages in ascending chronological order (oldest first)
    const sortedMessages = React.useMemo(
        () =>
            [...messages].sort((a, b) => {
                const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
                const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
                return timeA - timeB;
            }),
        [messages]
    );

    return (
        <div className="flex flex-col overflow-y-auto space-y-6 py-4">
            {sortedMessages.map((message, index) => (
                <MessageItem
                    key={`${message.timestamp}-${index}`}
                    message={message}
                    showPulsatingCircle={false}
                />
            ))}
        </div>
    );
}