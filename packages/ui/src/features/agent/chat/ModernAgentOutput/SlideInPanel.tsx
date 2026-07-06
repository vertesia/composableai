import { Button } from '@vertesia/ui/core';
import { XIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';

interface SlideInPanelProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    width?: string;
}

export default function SlideInPanel({ isOpen, onClose, title, children, width = '320px' }: SlideInPanelProps) {
    const [mounted, setMounted] = useState(false);

    // Handle animation timing
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
        } else {
            const timer = setTimeout(() => {
                setMounted(false);
            }, 300); // Match transition duration
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!mounted && !isOpen) {
        return null;
    }

    const panelTranslateClass = isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'; // rtl-ok: mirrored inline-end transform

    return (
        <>
            {/* Backdrop overlay */}
            <Button
                variant="unstyled"
                size="none"
                aria-label="Close panel"
                tabIndex={-1}
                className={`!fixed inset-0 bg-black/10 dark:bg-black/30 z-40 transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Slide-in panel */}
            <div
                className={`fixed top-0 end-0 bottom-0 z-50 bg-white dark:bg-gray-900 shadow-lg border-s border-gray-200 dark:border-gray-800 transition-transform duration-300 ease-in-out ${panelTranslateClass}`}
                style={{ width }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                    <h3 className="font-medium text-gray-800 dark:text-gray-200">{title}</h3>
                    <Button
                        variant="unstyled"
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <XIcon className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 57px)' }}>
                    {children}
                </div>
            </div>
        </>
    );
}
