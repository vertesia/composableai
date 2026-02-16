import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { ErrorBox } from '../components/ErrorBox.js';

export function SkillBrowserScreen() {
    const { client } = useClient();
    const { navigate } = useNavigation();
    const [selectedIndex, setSelectedIndex] = useState(0);

    const { data: skills, loading, error, refetch } = useAsyncData(
        async () => {
            if (!client) return [];
            const interactions = await client.interactions.list();
            return interactions.filter(i => i.tags?.includes('skill'));
        },
        [client],
    );

    useInput((_input, key) => {
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
        } else if (key.downArrow) {
            setSelectedIndex(i => Math.min((skills?.length || 1) - 1, i + 1));
        } else if (key.return && skills && skills.length > 0) {
            const skill = skills[selectedIndex];
            navigate('prompt-editor', { interactionId: skill.id, name: skill.name });
        }
    });

    if (loading) return <Spinner label="Loading skills..." />;
    if (error) return <ErrorBox message={error} onRetry={refetch} />;

    return (
        <Box flexDirection="column">
            <Text bold color="cyan">Skills</Text>
            <Text color="gray">Select a skill to view/edit its prompt</Text>
            <Text> </Text>

            {!skills || skills.length === 0 ? (
                <Text color="gray">No skills found</Text>
            ) : (
                skills.map((skill, i) => (
                    <Box key={skill.id}>
                        <Text color={i === selectedIndex ? 'green' : 'white'}>
                            {i === selectedIndex ? '> ' : '  '}
                        </Text>
                        <Text bold={i === selectedIndex} color={i === selectedIndex ? 'green' : 'white'}>
                            {skill.name || skill.endpoint}
                        </Text>
                        <Text color="gray">
                            {' '}{skill.description ? `- ${skill.description}` : ''}
                        </Text>
                    </Box>
                ))
            )}
        </Box>
    );
}
