/**
 * Space characters, other than the plain space, that file names carry: macOS writes a narrow no-break space
 * (U+202F) before "AM"/"PM" in screenshot names, for example.
 */
const NON_ASCII_SPACES = /[   -   　]/g;

/**
 * The name an uploaded file is stored and announced under. An agent reads the name, then types it back as a
 * path, and a model writes these spaces as plain ones, so a name that kept them would not be found again.
 */
export function conversationFileName(name: string): string {
    return name.replace(NON_ASCII_SPACES, ' ');
}

/** The artifact path of a file the user uploaded to a conversation. */
export function conversationFileArtifactPath(name: string): string {
    return `files/${conversationFileName(name)}`;
}
