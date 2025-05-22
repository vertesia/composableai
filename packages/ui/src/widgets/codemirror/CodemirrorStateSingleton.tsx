import { EditorState, Text } from '@codemirror/state';

let stateInstance: EditorState | null = null;

/**
 * Returns a shared instance of CodeMirror's EditorState.
 * If the instance doesn't exist, it creates one with the given initial content.
 *
 * @param initialDoc - The initial content for the editor, either as a `string` or `Text`.
 * @param extensions - Optional extensions to be applied to the editor.
 * @returns The shared EditorState instance.
**/
export const getSharedEditorState = (
    initialDoc: string | Text = "",
    extensions: any[] = []
): EditorState => {
    const doc = typeof initialDoc === "string" ? Text.of(initialDoc.split("\n")) : initialDoc;

    if (!stateInstance) {
        stateInstance = EditorState.create({
            doc,
            extensions,
        });
    } else if (stateInstance.doc.toString() !== doc.toString()) {
        stateInstance = EditorState.create({
            doc,
            extensions,
        });
    }

    return stateInstance;
};

/**
 * Resets the singleton instance (useful for testing or reinitializing).
**/
export const resetSharedEditorState = () => {
    stateInstance = null;
};
