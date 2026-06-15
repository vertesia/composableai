/**
 * Extract pasteable files from a clipboard event's `DataTransferItemList`.
 *
 * Used by both `MessageInput` (live chat) and `StartWorkflowView` (start screen)
 * to handle paste-to-attach. Callers diverge on what they do with the result —
 * the live chat uploads immediately via a parent callback; the start screen
 * stages files locally until the workflow starts — so this helper only covers
 * the shared extraction step.
 *
 * Pasted images often arrive without a meaningful filename (most browsers
 * surface them as `image.png`). Rename those to `pasted-image-<timestamp>.<ext>`
 * so they sort and display sensibly in the staged-file chip list.
 */
export function extractFilesFromClipboard(items: DataTransferItemList | undefined): File[] {
    if (!items) return [];

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;

        const file = item.getAsFile();
        if (!file) continue;

        if (item.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
            const extension = item.type.split('/')[1] || 'png';
            files.push(new File([file], `pasted-image-${Date.now()}.${extension}`, { type: file.type }));
        } else {
            files.push(file);
        }
    }
    return files;
}
