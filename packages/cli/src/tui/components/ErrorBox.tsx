import { Box, Text } from 'ink';

interface ErrorBoxProps {
    message: string;
    onRetry?: () => void;
}

export function ErrorBox({ message, onRetry }: ErrorBoxProps) {
    return (
        <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
            <Text bold color="red">Error</Text>
            <Text color="white">{message}</Text>
            {onRetry && (
                <Text color="gray" dimColor>Press r to retry</Text>
            )}
        </Box>
    );
}
