import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';

interface SpinnerProps {
    label?: string;
}

export function Spinner({ label = 'Loading...' }: SpinnerProps) {
    return (
        <Box>
            <Text color="cyan">
                <InkSpinner type="dots" />
            </Text>
            <Text> {label}</Text>
        </Box>
    );
}
