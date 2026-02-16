import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';

export function DocumentScreen() {
    const { client } = useClient();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [search, setSearch] = useState('');

    const { data: documents, loading, error, refetch } = useAsyncData(
        async () => {
            if (!client) return [];
            return client.objects.list({ limit: 50 });
        },
        [client],
    );

    const filtered = (documents || []).filter(doc => {
        if (!search) return true;
        const name = doc.name || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    useInput((input, key) => {
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
        } else if (key.downArrow) {
            setSelectedIndex(i => Math.min(filtered.length - 1, i + 1));
        } else if (input === 'r') {
            refetch();
        } else if (key.backspace || key.delete) {
            setSearch(s => s.slice(0, -1));
            setSelectedIndex(0);
        } else if (input && !key.ctrl && !key.meta && input.length === 1 &&
                   !key.tab && !key.escape && !key.upArrow && !key.downArrow && !key.return) {
            setSearch(s => s + input);
            setSelectedIndex(0);
        }
    });

    if (loading) return <Spinner label="Loading documents..." />;
    if (error) return <ErrorBox message={error} onRetry={refetch} />;

    return (
        <Box flexDirection="column">
            <Text bold color="cyan">Documents</Text>
            <Box>
                <Text color="gray">Search: </Text>
                <Text color="yellow">{search || '_'}</Text>
                <Text color="gray"> ({filtered.length} items) | r to refresh</Text>
            </Box>
            <Text> </Text>

            {filtered.length === 0 ? (
                <Text color="gray">No documents found</Text>
            ) : (
                filtered.slice(0, 25).map((doc, i) => (
                    <Box key={doc.id}>
                        <Text color={i === selectedIndex ? 'green' : 'white'}>
                            {i === selectedIndex ? '> ' : '  '}
                        </Text>
                        <Text bold={i === selectedIndex} color={i === selectedIndex ? 'green' : 'white'}>
                            {doc.name || doc.id}
                        </Text>
                        <Text color="gray">
                            {' '}[{doc.type?.name || 'unknown'}]
                        </Text>
                    </Box>
                ))
            )}

            {filtered.length > 25 && (
                <Text color="gray">  ... and {filtered.length - 25} more</Text>
            )}
        </Box>
    );
}
