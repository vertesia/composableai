import { Box } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';
import { SearchableList, type ListItem } from '../components/SearchableList.js';

export function AgentListScreen() {
    const { client } = useClient();
    const { navigate } = useNavigation();

    const { data: agents, loading, error, refetch } = useAsyncData(
        async () => {
            if (!client) return [];
            const interactions = await client.interactions.list();
            return interactions.filter(i =>
                i.agent_runner_options?.is_agent || i.tags?.includes('agent')
            );
        },
        [client],
    );

    if (loading) return <Spinner label="Loading agents..." />;
    if (error) return <ErrorBox message={error} onRetry={refetch} />;

    const items: ListItem[] = (agents || []).map(a => ({
        key: a.id,
        label: a.name || a.endpoint,
        description: a.description || `[${a.tags?.join(', ') || 'no tags'}]`,
    }));

    return (
        <Box flexDirection="column">
            <SearchableList
                title="Select an Agent"
                items={items}
                emptyMessage="No agents found. Make sure your project has interactions with agent_runner_options.is_agent=true or 'agent' tag."
                onSelect={(item) => {
                    const agent = agents?.find(a => a.id === item.key);
                    if (agent) {
                        navigate('agent-config', { agent });
                    }
                }}
            />
        </Box>
    );
}
