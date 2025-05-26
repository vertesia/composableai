import debounce from 'debounce';
import { RefObject, useEffect, useMemo, useRef } from 'react';

import { Extension, Text } from '@codemirror/state';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { useSafeLayoutEffect } from '@vertesia/ui/core';

import { getSharedEditorState } from './CodemirrorStateSingleton';

export class EditorApi {
    constructor(public editor: EditorView) { }
    setValue(value?: string) {
        this.editor.dispatch({
            changes: {
                from: 0,
                to: this.editor.state.doc.length,
                insert: value || "",
            },
        });
    }
    getValue() {
        return this.editor.state.doc.toString();
    }
}

const customTheme = EditorView.theme({
    "&": { fontSize: "14px", fontFamily: "monospace" },
    ".cm-content": { fontFamily: "inherit" },
    ".cm-scroller": { fontFamily: "inherit" },
    ".cm-gutters": { backgroundColor: "transparent", color: "#ddd" },
    ".cm-focused": { outline: "none" },
    ".cm-cursor": {
        borderLeft: "2px solid #000",
        borderLeftColor: "#000",
        animation: "blink 1.2s step-start infinite"
    },
    "@keyframes blink": { "50%": { opacity: 0 } }
});

const baseExtensions = [
    customTheme,
    EditorView.lineWrapping,
];

function updateListenerExtension(cb: (update: ViewUpdate) => void) {
    return EditorView.updateListener.of((update) => {
        if (update.docChanged) {
            cb(update);
        }
    });
};

interface CodeMirrorEditorProps {
    value?: string | Text;
    className?: string;
    editorRef?: RefObject<EditorApi | undefined>;
    extensions: Extension;
    onChange?: (update: ViewUpdate) => void;
    debounceTimeout?: number; // use a value > 0 to debounce on change events
}

/**
 * The className is only used on the first rendering - the editor class will not be updated if the property changes
**/
export function CodeMirrorEditor({ onChange, value, className, editorRef, extensions, debounceTimeout = 0 }: CodeMirrorEditorProps) {
    const ref = useRef<HTMLDivElement | null>(null);

    // the onChange property may change so we need to store it in a
    // reference to be able to update it when it changes without
    // re-registering the listener on codemirror since codemirror can only register
    // listeners at creation
    const onChangeRef = useRef<(update: ViewUpdate) => void | undefined>(undefined);
    useEffect(() => {
        if (onChange) {
            onChangeRef.current = debounceTimeout > 0
                ? debounce(onChange, debounceTimeout)
                : onChange;
            return () => {
                // WE MUST NOT CANCEL THE DEBOUNCE even if we unset the onChange impl
                // otherwise some updates will never happens
                onChangeRef.current = undefined;
            };
        }
    }, [onChange, debounceTimeout]);

    const component = useMemo(() => <div ref={ref} className={className} />, [className]);

    useSafeLayoutEffect(() => {
        if (ref.current) {
            let actualExtensions = [...baseExtensions, updateListenerExtension((update) => {
                onChangeRef.current?.(update);
            })];
            if (Array.isArray(extensions)) {
                actualExtensions = actualExtensions.concat(extensions);
            } else if (extensions) {
                actualExtensions.push(extensions);
            }

            const sharedState = getSharedEditorState(value, actualExtensions);

            const editor = new EditorView({
                state: sharedState,
                parent: ref.current,
            });

            const api = new EditorApi(editor);
            if (editorRef) {
                editorRef.current = api;
            }

            return () => {
                editor.destroy();
                if (editorRef) {
                    editorRef.current = undefined;
                }
            };
        }
    }, [component, extensions]);

    return component;
}
