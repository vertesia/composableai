import { Editor } from '@monaco-editor/react';
import { useTheme } from '@vertesia/ui/core';
import debounce from 'debounce';
import clsx from 'clsx';
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as monaco from 'monaco-editor';
import { registerCustomFoldingProviders } from './foldingProviders.js';

export type Monaco = typeof monaco;

export interface IEditorApi {
    getValue(): string;
    setValue(value?: string): void;
}

// Define Monaco ViewUpdate interface
export interface ViewUpdate {
    docChanged: boolean;
    state: {
        doc: {
            toString(): string;
            length: number;
        };
    };
}

export class VEditorApi implements IEditorApi {
    constructor(private VgetValue: () => string, private VsetValue: (value: string) => void) { }

    getValue() {
        return this.VgetValue();
    }

    setValue(value?: string) {
        this.VsetValue(value || '');
    }
}

interface MonacoEditorProps {
    value?: string;
    className?: string;
    editorRef?: RefObject<IEditorApi | undefined>;
    language?: string;
    onChange?: (update: ViewUpdate) => void;
    debounceTimeout?: number;
    theme?: string;
    options?: monaco.editor.IStandaloneEditorConstructionOptions;
    beforeMount?: (monaco: typeof import('monaco-editor')) => void;
    onMount?: (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => void;
    defaultValue?: string;
    useCustomFolding?: boolean;
}

export function MonacoEditor({
    onChange,
    value,
    className,
    editorRef,
    language = 'javascript',
    debounceTimeout = 0,
    options = {},
    beforeMount,
    onMount,
    defaultValue,
    useCustomFolding = false,
}: MonacoEditorProps) {
    const [editorValue, setEditorValue] = useState(value || defaultValue || '');
    const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoInstanceRef = useRef<typeof import('monaco-editor') | null>(null);
    const { theme } = useTheme();
    const resolvedTheme = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

    const getValueRef = useRef(() => editorValue);
    const setValueRef = useRef((newValue: string) => {
        setEditorValue(newValue);
        if (editorInstanceRef.current) {
            editorInstanceRef.current.setValue(newValue);
        }
    });

    useEffect(() => {
        getValueRef.current = () => editorValue;
    }, [editorValue]);

    useEffect(() => {
        if (editorRef) {
            editorRef.current = new VEditorApi(
                () => getValueRef.current(),
                (value: string) => setValueRef.current(value)
            );
        }
        return () => {
            if (editorRef) {
                editorRef.current = undefined;
            }
        };
    }, [editorRef]);

    const debouncedOnChange = useMemo(() => {
        if (!onChange) return undefined;

        if (debounceTimeout > 0) {
            return debounce((update: ViewUpdate) => onChange(update), debounceTimeout);
        } else {
            return onChange;
        }
    }, [onChange, debounceTimeout]);

    const foldAllCodeBlocks = useCallback(async (
        editor: monaco.editor.IStandaloneCodeEditor,
        monacoInstance: typeof import('monaco-editor'),
    ) => {
        const model = editor.getModel();
        if (!model) return;
        const codeBlockRegExp = /```[\s\S]*?```/g;
        let match;
        while ((match = codeBlockRegExp.exec(model.getValue())) !== null) {
            const startLine = model.getPositionAt(match.index).lineNumber;
            const endLine = model.getPositionAt(match.index + match[0].length).lineNumber;
            editor.setSelection(new monacoInstance.Selection(startLine, 1, endLine, 1));
            await editor.getAction('editor.createFoldingRangeFromSelection')?.run();
        }
    }, []);

    const handleEditorChange = useCallback((newValue: string | undefined) => {
        const actualValue = newValue || '';
        setEditorValue(actualValue);

        if (debouncedOnChange) {
            const update = {
                docChanged: true,
                state: {
                    doc: {
                        toString: () => actualValue,
                        length: actualValue.length
                    }
                }
            } as unknown as ViewUpdate;
            // Using type assertion through unknown to avoid complex type mocking

            debouncedOnChange(update);
        }
    }, [debouncedOnChange]);

    const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof import('monaco-editor')) => {
        editorInstanceRef.current = editor;
        monacoInstanceRef.current = monacoInstance;

        if (useCustomFolding) {
            registerCustomFoldingProviders(monacoInstance);
        }

        // Update the setValue ref to use the actual editor instance
        setValueRef.current = (newValue: string) => {
            setEditorValue(newValue);
            editor.setValue(newValue);
        };

        // Set up custom theme for better error line highlighting
        monacoInstance.editor.defineTheme('errorLineTheme', {
            base: resolvedTheme === 'dark' ? 'vs-dark' : 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editorError.background': '#ffebee',
                'editorError.border': '#f44336',
            },
        });

        monacoInstance.editor.setTheme('errorLineTheme');

        if (useCustomFolding) {
            setTimeout(() => foldAllCodeBlocks(editor, monacoInstance), 300);
        }

        // Call custom onMount if provided
        onMount?.(editor, monacoInstance);
    }, [onMount, resolvedTheme, useCustomFolding, foldAllCodeBlocks]);

    // Update editor value when prop changes from outside
    useEffect(() => {
        const effectiveValue = value || defaultValue || '';
        if (effectiveValue !== editorValue) {
            setEditorValue(effectiveValue);
            if (editorInstanceRef.current) {
                editorInstanceRef.current.setValue(effectiveValue);
            }
        }
    }, [value]); // Only depend on value prop, not editorValue

    // Re-fold code blocks when value prop changes externally
    useEffect(() => {
        if (!useCustomFolding || !editorInstanceRef.current || !monacoInstanceRef.current) return;
        const editor = editorInstanceRef.current;
        const monacoInstance = monacoInstanceRef.current;
        const timer = setTimeout(() => foldAllCodeBlocks(editor, monacoInstance), 300);
        return () => clearTimeout(timer);
    }, [value, useCustomFolding, foldAllCodeBlocks]);

    const defaultOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
        fontSize: 14,
        fontFamily: 'monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on' as const,
        lineNumbers: 'on' as const,
        folding: useCustomFolding,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        automaticLayout: true,
        formatOnPaste: true,
        formatOnType: true,
        tabSize: 2,
        insertSpaces: true,
        fixedOverflowWidgets: true, // Hover/diagnostic popovers float outside the editor bounds
        glyphMargin: true, // Enable better error reporting
        renderValidationDecorations: 'on', // Show error squiggles
        renderLineHighlight: 'line', // Highlight entire line for errors
        hover: {
            enabled: true,
            delay: 100
        }, // Enable hover for error messages
        quickSuggestions: {
            other: true,
            comments: true,
            strings: true
        }, // Show problems panel information
        ...options
    };

    return (
        <div className={clsx(className, 'w-full h-full!')}>
            <Editor
                className="h-full w-full"
                height="100%"
                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                language={language}
                value={editorValue}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                beforeMount={beforeMount}
                options={defaultOptions}
                defaultValue={defaultValue || ''}
            />
        </div>
    );
}