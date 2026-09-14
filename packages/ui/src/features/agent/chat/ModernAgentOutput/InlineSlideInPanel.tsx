import { Button } from '@vertesia/ui/core';
import { XIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';

interface InlineSlideInPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    width?: string;
}

export default function InlineSlideInPanel({
    isOpen,
    onClose,
    title,
    children,
    width = '320px',
}: InlineSlideInPanelProps) {
    const [mounted, setMounted] = useState(false);

    // Debug logging
    console.log('InlineSlideInPanel render:', { isOpen, mounted, title });

    // Handle animation timing
    useEffect(() => {
        console.log('InlineSlideInPanel useEffect triggered. isOpen:', isOpen);
        if (isOpen) {
            console.log('InlineSlideInPanel setting mounted to true');
            setMounted(true);
        } else {
            console.log('InlineSlideInPanel setting up timer to unmount');
            const timer = setTimeout(() => {
                console.log('InlineSlideInPanel timer fired, setting mounted to false');
                setMounted(false);
            }, 300); // Match transition duration
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!mounted && !isOpen) {
        return null;
    }

    return (
        <div
            className={`absolute top-12 end-0 bottom-0 z-40 bg-white dark:bg-muted shadow-lg border-s border-border border-4 border-destructive`}
            style={{ width, transform: 'none' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border">
                <h3 className="font-medium text-foreground text-sm">{title}</h3>
                <Button
                    variant="unstyled"
                    className="p-1 text-muted hover:text-foreground rounded-full"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <XIcon className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="p-3 overflow-y-auto" style={{ height: 'calc(100% - 44px)' }}>
                {children}
            </div>
        </div>
    );
}
