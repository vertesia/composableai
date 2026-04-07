import { ChevronDownIcon } from 'lucide-react';
import { Button, Dropdown, MenuItem } from '@vertesia/ui/core';
import type { OpenDocument } from './types/document.js';

interface DocumentTabBarProps {
    documents: OpenDocument[];
    activeId: string | null;
    onSelect: (id: string) => void;
}

export function DocumentTabBar({ documents, activeId, onSelect }: DocumentTabBarProps) {
    if (documents.length === 0) return null;

    return (
        <div className="flex items-center gap-1 px-2 py-1.5">
            <Dropdown
                align="right"
                trigger={
                    <Button variant="ghost" size="xs"
                        title='All documents'
                        className="flex items-center gap-1.5 max-w-[220px] text-xs h-7 px-2">
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
                        <span className="truncate max-w-[200px]">{doc.title}</span>
                    </MenuItem>
                ))}
            </Dropdown>
        </div>
    );
}
