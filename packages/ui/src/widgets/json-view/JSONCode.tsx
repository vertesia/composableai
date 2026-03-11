
import { useTheme } from '@vertesia/ui/core';
import { MonacoEditor } from '../monacoEditor/MonacoEditor';
import { useMemo } from 'react';

export function JSONCode({ data, className }: { data: any; className?: string }) {
    const { theme } = useTheme();

    // Convert data to formatted JSON string
    const jsonString = useMemo(() => {
        try {
            return JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Failed to stringify JSON:', error);
            return '{}';
        }
    }, [data]);

    return (
        <div className={`h-full pb-2 mb-2 ${className || ''}`}>
            <MonacoEditor
                value={jsonString}
                language="json"
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                options={{
                    readOnly: true,
                    domReadOnly: true,
                }}
            />
        </div>
    );
}
