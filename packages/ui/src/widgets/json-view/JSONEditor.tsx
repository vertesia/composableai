import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@vertesia/ui/core';
import { MonacoEditor, IEditorApi } from '../monacoEditor/MonacoEditor';

export interface JSONEditorProps {
    /** The JSON value to edit */
    value: Record<string, any> | undefined | null;
    /** Called when the user saves (value is the parsed JSON) */
    onChange?: (value: Record<string, any>) => void;
    /** Called on every valid edit (for controlled mode) */
    onValidChange?: (value: Record<string, any>) => void;
    /** If true, the editor is read-only */
    readonly?: boolean;
    /** Editor height (default: '200px') */
    height?: string;
    /** Placeholder text when value is empty */
    placeholder?: string;
    /** Additional CSS class */
    className?: string;
}

/**
 * Reusable JSON editor based on Monaco.
 * Parses and validates JSON, reports errors.
 */
export function JSONEditor({
    value,
    onChange,
    onValidChange,
    readonly = false,
    height = '200px',
    placeholder,
    className,
}: JSONEditorProps) {
    const { theme } = useTheme();
    const editorRef = useRef<IEditorApi>(undefined);
    const [error, setError] = useState<string | null>(null);

    const jsonString = useMemo(() => {
        if (value === undefined || value === null) return placeholder ?? '{}';
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return '{}';
        }
    }, [value, placeholder]);

    // Validate on change
    const handleChange = useCallback(() => {
        if (!editorRef.current || readonly) return;
        const text = editorRef.current.getValue();
        try {
            const parsed = JSON.parse(text);
            setError(null);
            onValidChange?.(parsed);
        } catch {
            setError('Invalid JSON');
        }
    }, [readonly, onValidChange]);

    return (
        <div className={className}>
            <div className="border rounded overflow-hidden" style={{ height }}>
                <MonacoEditor
                    defaultValue={jsonString}
                    editorRef={editorRef}
                    language="json"
                    theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                    onChange={handleChange}
                    options={readonly ? { readOnly: true, domReadOnly: true } : undefined}
                />
            </div>
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
    );
}

/**
 * Get the current parsed value from a JSONEditor ref.
 * Returns the parsed object or null if invalid.
 */
export function getJSONEditorValue(editorRef: React.RefObject<IEditorApi | undefined>): Record<string, any> | null {
    if (!editorRef.current) return null;
    try {
        return JSON.parse(editorRef.current.getValue());
    } catch {
        return null;
    }
}
