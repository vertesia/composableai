/**
 * Splice "\n" at the caret in a controlled textarea, then restore the caret
 * position after React re-renders with the new value. Used for the modifier+Enter
 * combos (Cmd/Ctrl/Alt+Enter) that browsers don't natively turn into a newline.
 */
export function insertNewlineAtCursor(textarea: HTMLTextAreaElement, onChange?: (text: string) => void): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const next = `${value.slice(0, start)}\n${value.slice(end)}`;
    onChange?.(next);
    requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
    });
}
