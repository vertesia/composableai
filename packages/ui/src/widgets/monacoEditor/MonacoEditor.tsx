import { useTheme } from '@vertesia/ui/core';
import clsx from 'clsx';
import debounce from 'debounce';
import type * as monaco from 'monaco-editor';
import { lazy, type RefObject, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { registerCustomFoldingProviders } from './foldingProviders.js';
import { loadMonacoReact } from './loadMonaco.js';

/**
 * The Monaco React wrapper drags in the Monaco loader (and, once mounted, the editor itself) on
 * import. Most screens never open an editor, so it is fetched on first render instead --
 * through loadMonacoReact, which applies the runtime version pin before handing the module out.
 */
const Editor = lazy(() => loadMonacoReact().then(({ Editor: component }) => ({ default: component })));

export type Monaco = typeof monaco;

/**
 * Shared, body-level host for Monaco "overflow widgets" — the suggestion, hover, and
 * parameter-hint popups. With `fixedOverflowWidgets` enabled these are `position: fixed`; a CSS
 * `transform` on any ancestor (e.g. a modal centered with `translate(-50%, -50%)`) becomes their
 * containing block and drags the popups away from the cursor, sometimes off-screen. Hosting them in
 * an untransformed node appended to `document.body` keeps them anchored to the caret. The node
 * carries the `monaco-editor` class so Monaco's (global) theme styles apply, and a high z-index so
 * the popups render above modals/overlays. One shared node is reused by every editor instance.
 */
let overflowWidgetsNode: HTMLElement | undefined;
function getOverflowWidgetsNode(): HTMLElement | undefined {
    if (typeof document === 'undefined') return undefined;
    if (!overflowWidgetsNode) {
        const node = document.createElement('div');
        node.className = 'monaco-editor';
        // `absolute` + z-index establishes a stacking context above modals without creating a
        // containing block for the fixed-positioned popups (only transform/filter/etc. would).
        node.style.position = 'absolute';
        node.style.top = '0';
        node.style.left = '0';
        node.style.zIndex = '10000';
        document.body.appendChild(node);
        overflowWidgetsNode = node;
    }
    return overflowWidgetsNode;
}

export interface IEditorApi {
    getValue(): string;
    setValue(value?: string): void;
}

/**
 * Registry of JSON schemas keyed by model path. Monaco's JSON language service is configured
 * globally (per language, not per editor), so every mounted editor's schema must be re-applied
 * together — each entry is scoped to its own model via `fileMatch`, so editors never see each
 * other's schema.
 */
const jsonSchemaRegistry = new Map<string, object>();
let jsonSchemaModelCounter = 0;

/** The JSON language defaults API — present at runtime once monaco's JSON contribution is
 * loaded, but typed as a deprecated stub in the bundled monaco-editor typings. */
interface JsonLanguageDefaults {
    setDiagnosticsOptions(options: {
        validate?: boolean;
        enableSchemaRequest?: boolean;
        schemas?: { uri: string; fileMatch?: string[]; schema?: object }[];
    }): void;
}

function applyJsonSchemas(monacoInstance: typeof import('monaco-editor')) {
    const jsonDefaults = (monacoInstance.languages as unknown as { json?: { jsonDefaults?: JsonLanguageDefaults } })
        .json?.jsonDefaults;
    jsonDefaults?.setDiagnosticsOptions({
        validate: true,
        enableSchemaRequest: false,
        schemas: Array.from(jsonSchemaRegistry.entries()).map(([modelPath, schema]) => ({
            uri: `vertesia://schemas/${encodeURIComponent(modelPath)}`,
            fileMatch: [modelPath],
            schema,
        })),
    });
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
    constructor(
        private VgetValue: () => string,
        private VsetValue: (value: string) => void,
    ) {}

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
    path?: string;
    onChange?: (update: ViewUpdate) => void;
    debounceTimeout?: number;
    theme?: string;
    options?: monaco.editor.IStandaloneEditorConstructionOptions;
    beforeMount?: (monaco: typeof import('monaco-editor')) => void;
    onMount?: (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => void;
    defaultValue?: string;
    useCustomFolding?: boolean;
    /**
     * JSON Schema applied to this editor's content (language must be 'json'). Drives
     * completion, hover documentation, and validation squiggles. Scoped to this editor
     * instance only — other JSON editors keep their own (or no) schema.
     */
    jsonSchema?: object;
}

export function MonacoEditor({
    onChange,
    value,
    className,
    editorRef,
    language = 'javascript',
    path,
    debounceTimeout = 0,
    options = {},
    beforeMount,
    onMount,
    defaultValue,
    useCustomFolding = false,
    jsonSchema,
}: MonacoEditorProps) {
    const [editorValue, setEditorValue] = useState(value || defaultValue || '');
    const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoInstanceRef = useRef<typeof import('monaco-editor') | null>(null);
    // Stable per-instance model path: required to scope a jsonSchema to THIS editor's model.
    // Callers may pass an explicit `path`; otherwise one is generated when a schema is set.
    const [generatedPath] = useState(() =>
        jsonSchema ? `inmemory://vertesia/json/${++jsonSchemaModelCounter}.json` : undefined,
    );
    const modelPath = path ?? generatedPath;
    const { theme } = useTheme();
    const resolvedTheme =
        theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
    const effectiveValue = value || defaultValue || '';

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
                (value: string) => setValueRef.current(value),
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

    const foldAllCodeBlocks = useCallback(
        async (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof import('monaco-editor')) => {
            const model = editor.getModel();
            if (!model) return;
            const codeBlockRegExp = /```[\s\S]*?```/g;
            for (const match of model.getValue().matchAll(codeBlockRegExp)) {
                const startLine = model.getPositionAt(match.index).lineNumber;
                const endLine = model.getPositionAt(match.index + match[0].length).lineNumber;
                editor.setSelection(new monacoInstance.Selection(startLine, 1, endLine, 1));
                await editor.getAction('editor.createFoldingRangeFromSelection')?.run();
            }
        },
        [],
    );

    const handleEditorChange = useCallback(
        (newValue: string | undefined) => {
            const actualValue = newValue || '';
            setEditorValue(actualValue);

            if (debouncedOnChange) {
                const update: ViewUpdate = {
                    docChanged: true,
                    state: {
                        doc: {
                            toString: () => actualValue,
                            length: actualValue.length,
                        },
                    },
                };

                debouncedOnChange(update);
            }
        },
        [debouncedOnChange],
    );

    const handleEditorDidMount = useCallback(
        (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof import('monaco-editor')) => {
            editorInstanceRef.current = editor;
            monacoInstanceRef.current = monacoInstance;

            if (jsonSchema && modelPath && language === 'json') {
                jsonSchemaRegistry.set(modelPath, jsonSchema);
                applyJsonSchemas(monacoInstance);
            }

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
        },
        [onMount, resolvedTheme, useCustomFolding, foldAllCodeBlocks, jsonSchema, modelPath, language],
    );

    // Unregister this editor's schema on unmount so the global JSON diagnostics config
    // doesn't accumulate schemas for dead models.
    useEffect(() => {
        return () => {
            if (jsonSchema && modelPath && jsonSchemaRegistry.delete(modelPath) && monacoInstanceRef.current) {
                applyJsonSchemas(monacoInstanceRef.current);
            }
        };
    }, [jsonSchema, modelPath]);

    // Apply external `value`/`defaultValue` changes to the model — but NEVER while the user is
    // actively typing. If the editor has focus, an incoming value is almost always a stale echo of
    // this editor's own (possibly debounced or reformatted) onChange output flowing back in through
    // a controlled `value` prop. Re-applying it would jump the caret and drop the characters typed
    // during the round-trip. We skip while focused; genuine external updates land once the editor is
    // blurred. Explicit programmatic updates go through the editor ref (`setValue`) and are exempt.
    useEffect(() => {
        if (editorInstanceRef.current?.hasTextFocus()) {
            return;
        }
        setEditorValue((currentValue) => {
            if (effectiveValue === currentValue) {
                return currentValue;
            }
            if (editorInstanceRef.current) {
                editorInstanceRef.current.setValue(effectiveValue);
            }
            return effectiveValue;
        });
    }, [effectiveValue]);

    // Re-fold code blocks when the value changes externally — same focus guard, so folding never
    // moves the selection out from under an actively typing user.
    useEffect(() => {
        if (!effectiveValue || !useCustomFolding || !editorInstanceRef.current || !monacoInstanceRef.current) return;
        if (editorInstanceRef.current.hasTextFocus()) return;
        const editor = editorInstanceRef.current;
        const monacoInstance = monacoInstanceRef.current;
        const timer = setTimeout(() => foldAllCodeBlocks(editor, monacoInstance), 300);
        return () => clearTimeout(timer);
    }, [effectiveValue, useCustomFolding, foldAllCodeBlocks]);

    const defaultOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
        fontSize: 14,
        fontFamily: 'monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on' as const,
        lineNumbers: 'on' as const,
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        automaticLayout: true,
        formatOnPaste: true,
        formatOnType: true,
        tabSize: 2,
        insertSpaces: true,
        fixedOverflowWidgets: true, // Hover/diagnostic popovers float outside the editor bounds
        // Host the fixed popups in a body-level node so a modal's CSS transform doesn't offset them.
        overflowWidgetsDomNode: getOverflowWidgetsNode(),
        glyphMargin: true, // Enable better error reporting
        renderValidationDecorations: 'on', // Show error squiggles
        renderLineHighlight: 'line', // Highlight entire line for errors
        hover: {
            enabled: 'on',
            delay: 100,
        }, // Enable hover for error messages
        quickSuggestions: {
            other: true,
            comments: true,
            strings: true,
        }, // Show problems panel information
        ...options,
    };

    return (
        <div className={clsx(className, 'w-full h-full!')}>
            <Suspense fallback={<div className="h-full w-full" />}>
                <Editor
                    className="h-full w-full"
                    height="100%"
                    theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
                    language={language}
                    path={modelPath}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    beforeMount={beforeMount}
                    options={defaultOptions}
                    // Uncontrolled: seed the initial content once via `defaultValue` and never bind a
                    // reactive `value`. @monaco-editor/react re-applies a changed `value` prop through
                    // `executeEdits(..., forceMoveMarkers: true)` whenever it differs from the live
                    // model, snapping the caret to the END of the content — the cursor jump we are
                    // eliminating whenever a caller feeds its own onChange output back into `value`.
                    // All external updates instead flow through the focus-guarded sync effect above.
                    defaultValue={effectiveValue}
                />
            </Suspense>
        </div>
    );
}
