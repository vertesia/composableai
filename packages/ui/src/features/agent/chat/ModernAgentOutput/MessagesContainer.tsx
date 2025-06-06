import { AgentMessage } from "@vertesia/common";
import React, { useEffect } from "react";
import StackedMessages from "./StackedMessages";

interface MessagesContainerProps {
    messages: AgentMessage[];
    isCompleted: boolean;
    bottomRef: React.RefObject<HTMLDivElement>;
}

export default function MessagesContainer({ messages, bottomRef }: MessagesContainerProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, bottomRef]);

    // Sort all messages chronologically
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
        <div
            ref={containerRef}
            className="flex-1 min-h-0 h-full overflow-y-auto py-4 px-4 sm:px-6 lg:px-8 bg-white flex flex-col"
            data-testid="messages-container"
        >
            {sortedMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center py-8">
                    <div className="flex items-center px-4 py-3 text-gray-500">
                        Waiting for agent response...
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col justify-start h-full min-h-0">
                    <StackedMessages messages={sortedMessages} isCompleted={false} />
                </div>
            )}
        </div>
    );
}
