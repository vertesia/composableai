import { Editor } from '@monaco-editor/react';
import { useTheme } from '@vertesia/ui/core';
import debounce from 'debounce';
import clsx from 'clsx';
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as monaco from 'monaco-editor';

export type Monaco = typeof monaco;

const foldingProvidersRegistered = new Set<string>();

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
    useCustomFolding = true,
}: MonacoEditorProps) {
    const [editorValue, setEditorValue] = useState(value || defaultValue || '');
    const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoInstanceRef = useRef<typeof import('monaco-editor') | null>(null);
    const { theme } = useTheme();

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
            // Markdown: fold by heading hierarchy (## sections)
            if (!foldingProvidersRegistered.has('markdown')) {
                foldingProvidersRegistered.add('markdown');
                monacoInstance.languages.registerFoldingRangeProvider('markdown', {
                    provideFoldingRanges(model) {
                        const ranges: monaco.languages.FoldingRange[] = [];
                        const lines = model.getLinesContent();
                        const headingPattern = /^(#{1,6})\s/;
                        const stack: Array<{ level: number; line: number }> = [];

                        for (let i = 0; i < lines.length; i++) {
                            const lineNumber = i + 1;
                            const match = headingPattern.exec(lines[i]);
                            if (match) {
                                const level = match[1].length;
                                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                                    const top = stack.pop()!;
                                    if (lineNumber - 1 > top.line) {
                                        ranges.push({ start: top.line, end: lineNumber - 1 });
                                    }
                                }
                                stack.push({ level, line: lineNumber });
                            }
                        }
                        const lastLine = lines.length;
                        while (stack.length > 0) {
                            const top = stack.pop()!;
                            if (lastLine > top.line) {
                                ranges.push({ start: top.line, end: lastLine });
                            }
                        }
                        return ranges;
                    },
                });
            }

            // JS/TS: brace folding (if/else, functions) takes priority, followed by
            // markdown heading folding inside template literals. Brace ranges are
            // returned first so Monaco resolves conflicts in their favour.
            // Using registerFoldingRangeProvider (not createFoldingRangeFromSelection)
            // so both live in the same range set and Monaco's overlap resolution is
            // consistent — headings are always bounded by their template literal close.
            for (const lang of ['javascript', 'typescript'] as const) {
                if (!foldingProvidersRegistered.has(lang)) {
                    foldingProvidersRegistered.add(lang);
                    monacoInstance.languages.registerFoldingRangeProvider(lang, {
                        provideFoldingRanges(model) {
                            const lines = model.getLinesContent();
                            const headingPattern = /^(#{1,6})\s/;

                            const braceRanges: monaco.languages.FoldingRange[] = [];
                            const headingRanges: monaco.languages.FoldingRange[] = [];

                            const braceStack: number[] = [];
                            const headingStack: Array<{ level: number; line: number }> = [];

                            let inTemplate = false;
                            let inString = false;
                            let stringChar = '';

                            for (let i = 0; i < lines.length; i++) {
                                const lineNumber = i + 1;
                                const line = lines[i];
                                const lineStartedInTemplate = inTemplate;

                                for (let j = 0; j < line.length; j++) {
                                    const ch = line[j];
                                    if (ch === '\\') { j++; continue; }
                                    if (inString) { if (ch === stringChar) inString = false; continue; }
                                    if (inTemplate) { if (ch === '`') inTemplate = false; continue; }
                                    if (ch === '`') { inTemplate = true; continue; }
                                    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
                                    // Brace folding — only outside strings/templates
                                    if (ch === '{') { braceStack.push(lineNumber); }
                                    if (ch === '}' && braceStack.length > 0) {
                                        const start = braceStack.pop()!;
                                        if (lineNumber > start) braceRanges.push({ start, end: lineNumber });
                                    }
                                }

                                // Markdown heading folding — only inside template literals
                                if (lineStartedInTemplate) {
                                    const match = headingPattern.exec(line);
                                    if (match) {
                                        const level = match[1].length;
                                        while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
                                            const top = headingStack.pop()!;
                                            if (lineNumber - 1 > top.line) {
                                                headingRanges.push({ start: top.line, end: lineNumber - 1 });
                                            }
                                        }
                                        headingStack.push({ level, line: lineNumber });
                                    }
                                    // Template just closed — seal all open heading sections here
                                    if (!inTemplate) {
                                        while (headingStack.length > 0) {
                                            const top = headingStack.pop()!;
                                            if (lineNumber > top.line) {
                                                headingRanges.push({ start: top.line, end: lineNumber });
                                            }
                                        }
                                    }
                                }
                            }

                            // Brace ranges first → Monaco resolves conflicts in their favour
                            return [...braceRanges, ...headingRanges];
                        },
                    });
                }
            }
        }

        // Update the setValue ref to use the actual editor instance
        setValueRef.current = (newValue: string) => {
            setEditorValue(newValue);
            editor.setValue(newValue);
        };

        // Set up custom theme for better error line highlighting
        monacoInstance.editor.defineTheme('errorLineTheme', {
            base: theme === 'dark' ? 'vs-dark' : 'vs',
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
    }, [onMount, theme, useCustomFolding, foldAllCodeBlocks]);

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
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
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