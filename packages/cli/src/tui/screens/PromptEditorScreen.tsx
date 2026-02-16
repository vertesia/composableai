import { Box, Text } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';
import { Markdown } from '../components/Markdown.js';

export function PromptEditorScreen() {
    const { client } = useClient();
    const { current } = useNavigation();
    const interactionId = current.params?.interactionId as string;
    const name = current.params?.name as string;

    const { data: interaction, loading, error } = useAsyncData(
        async () => {
            if (!client || !interactionId) return null;
            return client.interactions.retrieve(interactionId);
        },
        [client, interactionId],
    );

    if (loading) return <Spinner label="Loading interaction..." />;
    if (error) return <ErrorBox message={error} />;
    if (!interaction) return <Text color="gray">Interaction not found</Text>;

    const prompts = interaction.prompts || [];

    return (
        <Box flexDirection="column">
            <Text bold color="cyan">{name || interaction.name}</Text>
            <Text color="gray">
                Status: {interaction.status} | Version: {interaction.version}
            </Text>
            <Text> </Text>

            {prompts.length === 0 ? (
                <Text color="gray">No prompts defined</Text>
            ) : (
                prompts.map((prompt, i) => (
                    <Box key={i} flexDirection="column" marginBottom={1}
                         borderStyle="round" borderColor="gray" paddingX={1}>
                        <Text bold color="yellow">
                            [{prompt.type}] Segment {i + 1}
                        </Text>
                        {prompt.template && typeof prompt.template === 'object' && 'content' in prompt.template ? (
                            <Markdown content={String((prompt.template as unknown as Record<string, unknown>).content)} />
                        ) : prompt.template ? (
                            <Text color="gray">{typeof prompt.template === 'string' ? prompt.template : JSON.stringify(prompt.template, null, 2)}</Text>
                        ) : (
                            <Text color="gray">No template content</Text>
                        )}
                    </Box>
                ))
            )}

            <Text color="gray" dimColor>
                View-only. Use the Studio web UI for editing prompts.
            </Text>
        </Box>
    );
}
