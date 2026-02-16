import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface ListItem {
    key: string;
    label: string;
    description?: string;
}

interface SearchableListProps {
    items: ListItem[];
    onSelect: (item: ListItem) => void;
    title?: string;
    emptyMessage?: string;
}

/**
 * Filterable list with arrow key navigation and search.
 */
export function SearchableList({ items, onSelect, title, emptyMessage = 'No items' }: SearchableListProps) {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const filtered = items.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase())
    );

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
        } else if (key.downArrow) {
            setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
        } else if (key.return && filtered.length > 0) {
            onSelect(filtered[selectedIndex]);
        } else if (key.backspace || key.delete) {
            setSearch(s => s.slice(0, -1));
            setSelectedIndex(0);
        } else if (input && !key.ctrl && !key.meta && input.length === 1 &&
                   !key.tab && !key.escape && !key.upArrow && !key.downArrow) {
            setSearch(s => s + input);
            setSelectedIndex(0);
        }
    });

    return (
        <Box flexDirection="column">
            {title && <Text bold color="cyan">{title}</Text>}
            <Box>
                <Text color="gray">Search: </Text>
                <Text color="yellow">{search || '_'}</Text>
                <Text color="gray"> ({filtered.length}/{items.length})</Text>
            </Box>
            <Text> </Text>
            {filtered.length === 0 ? (
                <Text color="gray">{emptyMessage}</Text>
            ) : (
                filtered.slice(0, 20).map((item, i) => (
                    <Box key={item.key}>
                        <Text color={i === selectedIndex ? 'green' : 'white'}>
                            {i === selectedIndex ? '> ' : '  '}
                        </Text>
                        <Text bold={i === selectedIndex} color={i === selectedIndex ? 'green' : 'white'}>
                            {item.label}
                        </Text>
                        {item.description && (
                            <Text color="gray"> - {item.description}</Text>
                        )}
                    </Box>
                ))
            )}
            {filtered.length > 20 && (
                <Text color="gray">  ... and {filtered.length - 20} more</Text>
            )}
        </Box>
    );
}
