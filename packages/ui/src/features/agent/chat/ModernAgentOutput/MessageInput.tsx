import { Button, Input, Spinner, VModal, VModalBody, VModalTitle } from "@vertesia/ui/core";
import { Activity, PaperclipIcon, SendIcon, StopCircleIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { SelectDocument } from "../../../store";

interface MessageInputProps {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onStop?: () => void;
    disabled?: boolean;
    isSending?: boolean;
    isStopping?: boolean;
    isCompleted?: boolean;
    activeTaskCount?: number;
    placeholder?: string;
}

export default function MessageInput({
    value,
    onChange,
    onSend,
    onStop,
    disabled = false,
    isSending = false,
    isStopping = false,
    isCompleted = false,
    activeTaskCount = 0,
    placeholder = "Type your message..."
}: MessageInputProps) {
    const ref = useRef<HTMLInputElement | null>(null);
    const [isObjectModalOpen, setIsObjectModalOpen] = useState(false);

    useEffect(() => {
        if (!disabled && isCompleted) ref.current?.focus();
    }, [disabled, isCompleted]);

    const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const handleObjectSelect = (object: any) => {
        // Create a markdown link with the object title and ID
        const objectTitle = object.properties?.title || object.name || 'Object';
        const objectId = object.id;
        const markdownLink = `[${objectTitle}](store:${objectId})`;

        // Insert the link at cursor position or append to end
        const currentValue = value || '';
        const cursorPos = ref.current?.selectionStart || currentValue.length;
        const newValue = currentValue.substring(0, cursorPos) + markdownLink + currentValue.substring(cursorPos);

        // Update the input value
        onChange(newValue);

        // Close the modal
        setIsObjectModalOpen(false);

        // Focus back on the input
        setTimeout(() => {
            if (ref.current) {
                ref.current.focus();
                // Place cursor after the inserted link
                const newCursorPos = cursorPos + markdownLink.length;
                ref.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 100);
    };

    return (
        <div className="p-3 border-t border-muted flex-shrink-0" style={{ minHeight: "90px" }}>
            <div className="flex items-center space-x-2">
                <div className="flex flex-1 space-x-1" >
                    <Input
                        ref={ref}
                        value={value}
                        onKeyDown={keyDown}
                        onChange={onChange}
                        disabled={disabled || isSending}
                        placeholder={placeholder}
                        className="pr-12 py-2.5"
                    />
                    <Button
                        variant="ghost"
                        className="rounded-full"
                        disabled={!isCompleted}
                        onClick={() => setIsObjectModalOpen(true)}
                        alt="Link Object"
                    >
                        <PaperclipIcon className="size-4" />
                    </Button>
                </div>
                {/* Show stop button when agent is actively working */}
                {!isCompleted && activeTaskCount > 0 && onStop && (
                    <Button
                        onClick={onStop}
                        disabled={isStopping}
                        variant="outline"
                        className="px-4 py-2.5 border-destructive text-destructive hover:bg-destructive hover:text-white"
                        title="Interrupt current task"
                    >
                        {isStopping ? (
                            <Spinner size="sm" className="mr-2" />
                        ) : (
                            <StopCircleIcon className="size-4 mr-2" />
                        )}
                        Stop
                    </Button>
                )}
                <Button
                    onClick={onSend}
                    disabled={disabled || isSending || !value.trim()}
                    className="px-4 py-2.5"
                >
                    {isSending ? <Spinner size="sm" className="mr-2" /> : <SendIcon className="size-4 mr-2" />} Send
                </Button>
            </div>

            <div className="text-xs text-muted mt-2 text-center">
                {activeTaskCount > 0 ? (
                    <div className="flex items-center justify-center">
                        <Activity className="h-3 w-3 mr-1 text-attention" />
                        <span>Agent has {activeTaskCount} active workstream{activeTaskCount !== 1 ? 's' : ''} running</span>
                    </div>
                ) : disabled
                    ? "Agent is processing, you can continue once it completes..."
                    : "You can send a message at any time"}
            </div>

            {/* Object Selection Modal */}
            <VModal
                isOpen={isObjectModalOpen}
                onClose={() => setIsObjectModalOpen(false)}
                className='min-w-[60vw]'
            >
                <VModalTitle>Link Object</VModalTitle>
                <VModalBody className="pb-6">
                    <SelectDocument onChange={handleObjectSelect} />
                </VModalBody>
            </VModal>
        </div>
    );
}