import React from "react";
import { AgentMessage, AgentMessageType } from "@vertesia/common";
import MessageItem from "./MessageItem";
import { ThinkingMessages } from "../WaitingMessages";

interface SlidingMessagesProps {
    messages: AgentMessage[];
    isCompleted: boolean;
}

// Helper function to determine if a message is a thinking message
function isThinkingMessage(message: AgentMessage): boolean {
    return (
        message.type === AgentMessageType.THOUGHT ||
        message.type === AgentMessageType.UPDATE ||
        message.type === AgentMessageType.PLAN ||
        message.type === AgentMessageType.ERROR ||
        message.type === AgentMessageType.WARNING ||
        message.type === AgentMessageType.SYSTEM
    );
}

// Helper function to determine if a message is a permanent message
function isPermanentMessage(message: AgentMessage): boolean {
    return (
        message.type === AgentMessageType.ANSWER ||
        message.type === AgentMessageType.QUESTION ||
        message.type === AgentMessageType.COMPLETE ||
        message.type === AgentMessageType.IDLE ||
        message.type === AgentMessageType.REQUEST_INPUT
    );
}

export default function SlidingMessages({ messages, isCompleted }: SlidingMessagesProps) {
    const [thinkingMessageIndex, setThinkingMessageIndex] = React.useState(0);
    
    // Rotate thinking messages for the indicator
    React.useEffect(() => {
        if (!isCompleted) {
            const interval = setInterval(() => {
                setThinkingMessageIndex(() => Math.floor(Math.random() * (ThinkingMessages.length - 1)));
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [isCompleted]);
    
    // Permanent messages are always displayed
    const permanentMessages = messages.filter(isPermanentMessage);

    // Get thinking messages and find the latest one
    const thinkingMessages = messages.filter(isThinkingMessage).sort((a, b) => {
        const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
        const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
        return timeB - timeA; // Sort descending (newest first)
    });
    
    const latestThinkingMessage = thinkingMessages.length > 0 ? thinkingMessages[0] : null;
    
    // Sort permanent messages by timestamp (oldest first)
    const sortedPermanentMessages = [...permanentMessages].sort((a, b) => {
        const timeA = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime();
        const timeB = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime();
        return timeA - timeB;
    });
    
    return (
        <div className="flex flex-col space-y-6 overflow-y-auto py-4">
            {/* Display permanent messages */}
            {sortedPermanentMessages.map((message, index) => (
                <MessageItem
                    key={`${message.timestamp}-${index}`}
                    message={message}
                />
            ))}

            {/* Only show the latest thinking message when not completed */}
            {!isCompleted && latestThinkingMessage && (
                <MessageItem
                    message={latestThinkingMessage}
                    showPulsatingCircle={true}
                />
            )}

            {/* If no messages and not completed, show a placeholder thinking message */}
            {messages.length === 0 && !isCompleted && (
                <div className="flex items-center justify-center flex-1 text-center py-8">
                    <div className="flex items-center space-x-3 bg-blue-50 rounded-lg border border-blue-100 px-4 py-3">
                        <div className="text-sm text-blue-700 font-medium">
                            {ThinkingMessages[thinkingMessageIndex]}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}