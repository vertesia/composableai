import React, { useState, useEffect } from 'react';
import { XIcon } from 'lucide-react';

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
    width = '320px'
}: InlineSlideInPanelProps) {
    const [mounted, setMounted] = useState(false);

    // Debug logging
    console.log("InlineSlideInPanel render:", { isOpen, mounted, title });

    // Handle animation timing
    useEffect(() => {
        console.log("InlineSlideInPanel useEffect triggered. isOpen:", isOpen);
        if (isOpen) {
            console.log("InlineSlideInPanel setting mounted to true");
            setMounted(true);
        } else {
            console.log("InlineSlideInPanel setting up timer to unmount");
            const timer = setTimeout(() => {
                console.log("InlineSlideInPanel timer fired, setting mounted to false");
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
            className={`absolute top-12 right-0 bottom-0 z-40 bg-white dark:bg-gray-900 shadow-lg border-l border-gray-200 dark:border-gray-800 border-4 border-red-500`}
            style={{ width, transform: 'none' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
                <h3 className="font-medium text-gray-800 dark:text-gray-200 text-sm">{title}</h3>
                <button 
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full"
                    onClick={onClose}
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </div>
            
            {/* Content */}
            <div className="p-3 overflow-y-auto" style={{ height: 'calc(100% - 44px)' }}>
                {children}
            </div>
        </div>
    );
}