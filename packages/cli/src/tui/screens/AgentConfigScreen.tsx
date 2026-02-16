import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { InteractionRef } from '@vertesia/common';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';
import { useAsyncData } from '../hooks/useAsyncData.js';
import { Spinner } from '../components/Spinner.js';
import { FormField } from '../components/FormField.js';
import { Toggle } from '../components/Toggle.js';

interface ConfigState {
    environment: string;
    model: string;
    interactive: boolean;
    maxIterations: string;
    prompt: string;
}

const FIELDS = ['environment', 'model', 'interactive', 'maxIterations', 'prompt', 'start'] as const;

export function AgentConfigScreen() {
    const { client } = useClient();
    const { current, navigate, goBack } = useNavigation();
    const agent = current.params?.agent as InteractionRef | undefined;

    const [config, setConfig] = useState<ConfigState>({
        environment: '',
        model: agent?.model || '',
        interactive: true,
        maxIterations: '20',
        prompt: '',
    });
    const [activeField, setActiveField] = useState(0);
    const [editing, setEditing] = useState(false);
    const [launching, setLaunching] = useState(false);

    const { data: environments } = useAsyncData(
        async () => {
            if (!client) return [];
            return client.environments.list();
        },
        [client],
    );

    useInput((_input, key) => {
        if (launching) return;

        if (editing) {
            if (key.return || key.escape) {
                setEditing(false);
            }
            return;
        }

        if (key.upArrow) {
            setActiveField(i => Math.max(0, i - 1));
        } else if (key.downArrow) {
            setActiveField(i => Math.min(FIELDS.length - 1, i + 1));
        } else if (key.return) {
            const field = FIELDS[activeField];
            if (field === 'interactive') {
                setConfig(c => ({ ...c, interactive: !c.interactive }));
            } else if (field === 'start') {
                void launchAgent();
            } else {
                setEditing(true);
            }
        }
    });

    async function launchAgent() {
        if (!client || !agent) return;
        setLaunching(true);

        try {
            const payload = {
                type: 'conversation' as const,
                interaction: agent.name || agent.endpoint,
                data: config.prompt ? { userMessage: config.prompt } : undefined,
                config: {
                    environment: config.environment || undefined,
                    model: config.model || undefined,
                },
                interactive: config.interactive,
                max_iterations: parseInt(config.maxIterations, 10) || 20,
            };

            const { runId, workflowId } = await client.interactions.executeAsync(payload);
            navigate('run-execution', { runId, workflowId, agentName: agent.name });
        } catch (err) {
            setLaunching(false);
            // Error will be shown in the run execution screen
        }
    }

    if (!agent) {
        goBack();
        return null;
    }

    if (launching) {
        return <Spinner label="Launching agent..." />;
    }

    const currentField = FIELDS[activeField];

    return (
        <Box flexDirection="column" gap={1}>
            <Text bold color="cyan">Configure: {agent.name || agent.endpoint}</Text>
            {agent.description && <Text color="gray">{agent.description}</Text>}

            <Box flexDirection="column" marginTop={1}>
                {editing && (currentField === 'environment') ? (
                    <Box>
                        <Text color="green">{`> Environment: `}</Text>
                        <TextInput
                            value={config.environment}
                            onChange={v => setConfig(c => ({ ...c, environment: v }))}
                            onSubmit={() => setEditing(false)}
                            placeholder={environments?.map(e => e.name).join(', ') || 'env ID'}
                        />
                    </Box>
                ) : (
                    <FormField
                        label="Environment"
                        value={config.environment || '(default)'}
                        active={activeField === 0}
                    />
                )}

                {editing && (currentField === 'model') ? (
                    <Box>
                        <Text color="green">{`> Model: `}</Text>
                        <TextInput
                            value={config.model}
                            onChange={v => setConfig(c => ({ ...c, model: v }))}
                            onSubmit={() => setEditing(false)}
                        />
                    </Box>
                ) : (
                    <FormField
                        label="Model"
                        value={config.model || '(default)'}
                        active={activeField === 1}
                    />
                )}

                <Toggle
                    label="Interactive"
                    value={config.interactive}
                    active={activeField === 2}
                />

                {editing && (currentField === 'maxIterations') ? (
                    <Box>
                        <Text color="green">{`> Max Iterations: `}</Text>
                        <TextInput
                            value={config.maxIterations}
                            onChange={v => setConfig(c => ({ ...c, maxIterations: v }))}
                            onSubmit={() => setEditing(false)}
                        />
                    </Box>
                ) : (
                    <FormField
                        label="Max Iterations"
                        value={config.maxIterations}
                        active={activeField === 3}
                    />
                )}

                {editing && (currentField === 'prompt') ? (
                    <Box>
                        <Text color="green">{`> Initial Prompt: `}</Text>
                        <TextInput
                            value={config.prompt}
                            onChange={v => setConfig(c => ({ ...c, prompt: v }))}
                            onSubmit={() => setEditing(false)}
                        />
                    </Box>
                ) : (
                    <FormField
                        label="Initial Prompt"
                        value={config.prompt || '(none)'}
                        active={activeField === 4}
                    />
                )}

                <Box marginTop={1}>
                    <Text
                        bold={activeField === 5}
                        color={activeField === 5 ? 'green' : 'cyan'}
                    >
                        {activeField === 5 ? '> ' : '  '}[Start Agent]
                    </Text>
                </Box>
            </Box>

            <Text color="gray" dimColor>
                Use arrows to navigate, Enter to edit/toggle, Enter on Start to launch
            </Text>
        </Box>
    );
}
