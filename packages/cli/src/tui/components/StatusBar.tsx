import type { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useClient } from '../context/ClientContext.js';
import { useNavigation } from '../context/NavigationContext.js';

export function StatusBar() {
    const { client, loading, error } = useClient();
    const { canGoBack } = useNavigation();

    let connectionStatus: ReactNode;
    if (loading) {
        connectionStatus = <Text color="yellow">Connecting...</Text>;
    } else if (error) {
        connectionStatus = <Text color="red">Disconnected</Text>;
    } else if (client) {
        connectionStatus = <Text color="green">Connected</Text>;
    }

    return (
        <Box borderStyle="single" borderTop={true} borderBottom={false}
             borderLeft={false} borderRight={false} paddingX={1}
             justifyContent="space-between">
            <Box>
                {connectionStatus}
            </Box>
            <Box gap={2}>
                <Text color="gray">Tab:navigate</Text>
                {canGoBack && <Text color="gray">Esc:back</Text>}
                <Text color="gray">Ctrl+C:quit</Text>
            </Box>
        </Box>
    );
}
