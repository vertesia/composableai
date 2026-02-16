import { Box, Text } from 'ink';

interface ToggleProps {
    label: string;
    value: boolean;
    active?: boolean;
}

export function Toggle({ label, value, active }: ToggleProps) {
    return (
        <Box>
            <Text color={active ? 'green' : 'cyan'} bold={active}>
                {active ? '> ' : '  '}{label}:{' '}
            </Text>
            <Text color={value ? 'green' : 'red'}>
                {value ? '[ON]' : '[OFF]'}
            </Text>
        </Box>
    );
}
