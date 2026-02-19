import { XIcon } from 'lucide-react';
import { cn } from '@vertesia/ui/core';
import type { OpenDocument } from './types/document.js';

interface DocumentTabBarProps {
    documents: OpenDocument[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
}

export function DocumentTabBar({ documents, activeId, onSelect, onClose }: DocumentTabBarProps) {
    if (documents.length === 0) return null;

    return (
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {documents.map((doc) => {
                const isActive = doc.id === activeId;
                return (
                    <button
                        key={doc.id}
                        onClick={() => onSelect(doc.id)}
                        className={cn(
                            'group flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap max-w-[200px]',
                            isActive
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                        )}
                    >
                        <span className="truncate">{doc.title}</span>
                        <span
                            role="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(doc.id);
                            }}
                            className={cn(
                                'shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600',
                                isActive ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
                            )}
                        >
                            <XIcon className="size-3" />
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
