import { Box, Text } from 'ink';

interface FormFieldProps {
    label: string;
    value: string;
    active?: boolean;
}

/**
 * Simple label + value display for forms.
 */
export function FormField({ label, value, active }: FormFieldProps) {
    return (
        <Box>
            <Text color={active ? 'green' : 'cyan'} bold={active}>
                {active ? '> ' : '  '}{label}:{' '}
            </Text>
            <Text color="white">{value || '<not set>'}</Text>
        </Box>
    );
}
