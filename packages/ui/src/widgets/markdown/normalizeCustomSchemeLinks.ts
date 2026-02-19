const CUSTOM_SCHEME_PREFIXES = [
    'artifact:',
    'image:',
    'store:',
    'document://',
    'collection:',
];

const CUSTOM_LINK_REGEX = /(!?\[[^\]\n]*\]\()((?:artifact:|image:|store:|document:\/\/|collection:)[^)]+)(\))/g;
const INLINE_CODE_REGEX = /`[^`\n]*`/g;
const FENCED_CODE_BLOCK_REGEX = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g;
const LINK_TITLE_SUFFIX_REGEX = /\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\([^)]*\))\s*$/;

function hasCustomScheme(destination: string): boolean {
    return CUSTOM_SCHEME_PREFIXES.some(prefix => destination.startsWith(prefix));
}

function wrapCustomDestination(destinationWithOptionalTitle: string): string {
    const trimmed = destinationWithOptionalTitle.trim();

    // Preserve already angle-bracketed custom destinations.
    if (trimmed.startsWith('<')) {
        const closeIdx = trimmed.indexOf('>');
        if (closeIdx > 0) {
            const bracketedDestination = trimmed.slice(1, closeIdx).trim();
            if (hasCustomScheme(bracketedDestination)) {
                return destinationWithOptionalTitle;
            }
        }
    }

    const titleMatch = trimmed.match(LINK_TITLE_SUFFIX_REGEX);
    const titleStart = titleMatch?.index ?? -1;
    const destination = (titleStart >= 0 ? trimmed.slice(0, titleStart) : trimmed).trim();
    const title = titleStart >= 0 ? trimmed.slice(titleStart) : '';

    if (!hasCustomScheme(destination)) {
        return destinationWithOptionalTitle;
    }

    return `<${destination}>${title}`;
}

function normalizeCustomLinksInText(text: string): string {
    return text.replace(CUSTOM_LINK_REGEX, (_fullMatch, open, destination, close) => {
        return `${open}${wrapCustomDestination(destination)}${close}`;
    });
}

function normalizeOutsideInlineCode(text: string): string {
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    INLINE_CODE_REGEX.lastIndex = 0;
    while ((match = INLINE_CODE_REGEX.exec(text)) !== null) {
        result += normalizeCustomLinksInText(text.slice(lastIndex, match.index));
        result += match[0];
        lastIndex = match.index + match[0].length;
    }

    result += normalizeCustomLinksInText(text.slice(lastIndex));
    return result;
}

/**
 * Normalizes inline markdown links/images with custom URL schemes so they parse
 * correctly even when paths contain spaces (e.g. artifact:out/INVOICE 2025-001.pdf).
 *
 * CommonMark requires destinations with spaces to be wrapped in <...>.
 * We apply this only outside fenced/inline code spans.
 */
export function normalizeCustomSchemeLinks(markdown: string): string {
    if (!markdown || !CUSTOM_SCHEME_PREFIXES.some(prefix => markdown.includes(prefix))) {
        return markdown;
    }

    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    FENCED_CODE_BLOCK_REGEX.lastIndex = 0;
    while ((match = FENCED_CODE_BLOCK_REGEX.exec(markdown)) !== null) {
        result += normalizeOutsideInlineCode(markdown.slice(lastIndex, match.index));
        result += match[0];
        lastIndex = match.index + match[0].length;
    }

    result += normalizeOutsideInlineCode(markdown.slice(lastIndex));
    return result;
}
