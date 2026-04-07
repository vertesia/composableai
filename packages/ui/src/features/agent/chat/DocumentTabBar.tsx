import { ChevronDownIcon, XIcon } from 'lucide-react';
import { Button, Dropdown, MenuItem } from '@vertesia/ui/core';
import type { OpenDocument } from './types/document.js';

interface DocumentTabBarProps {
    documents: OpenDocument[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
}

export function DocumentTabBar({ documents, activeId, onSelect, onClose }: DocumentTabBarProps) {
    if (documents.length === 0) return null;

    const activeDoc = documents.find(d => d.id === activeId) ?? documents[0];

    return (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <Dropdown
                align="left"
                trigger={
                    <Button variant="ghost" size="xs" className="flex items-center gap-1.5 max-w-[220px] text-xs h-7 px-2">
                        <span className="truncate">{activeDoc.title}</span>
                        <ChevronDownIcon className="size-3 shrink-0" />
                    </Button>
                }
            >
                {documents.map((doc) => (
                    <MenuItem
                        key={doc.id}
                        onClick={() => onSelect(doc.id)}
                        className={doc.id === activeId ? 'font-medium' : ''}
                    >
                        <div className="flex items-center justify-between gap-4 w-full">
                            <span className="truncate max-w-[180px]">{doc.title}</span>
                            <span
                                role="button"
                                aria-label="Close document"
                                className="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 opacity-60 hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(doc.id);
                                }}
                            >
                                <XIcon className="size-3" />
                            </span>
                        </div>
                    </MenuItem>
                ))}
            </Dropdown>

            {activeId && (
                <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 w-7 p-0 shrink-0"
                    title="Close document"
                    onClick={() => onClose(activeId)}
                >
                    <XIcon className="size-3" />
                </Button>
            )}
        </div>
    );
}
