import { Parser } from 'htmlparser2';

const VOID_ELEMENTS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);

const ALWAYS_HIDDEN_ELEMENTS = new Set(['script', 'style', 'template', 'ix:hidden']);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

function displayValues(style: string | undefined): string[] {
    if (!style) return [];
    return style
        .split(';')
        .map((declaration) => {
            const separator = declaration.indexOf(':');
            if (separator < 0 || declaration.slice(0, separator).trim().toLowerCase() !== 'display') return undefined;
            return declaration.slice(separator + 1).trim();
        })
        .filter((value): value is string => value !== undefined);
}

function hasDisplayNone(values: string[]): boolean {
    // Do not try to implement CSS cascade/importance rules here. Conflicting declarations may make
    // the element visible, so remove it only when every explicit display value is exactly `none`.
    return values.length > 0 && values.every((value) => /^none(?:\s*!important)?\s*$/i.test(value));
}

function escapeAttribute(value: string): string {
    // htmlparser2 preserves existing entity references when decodeEntities is false.
    // Escape only the delimiter introduced by our normalized double-quoted serialization.
    return value.replaceAll('"', '&quot;');
}

/**
 * Remove markup that is unambiguously invisible before Pandoc builds its memory-heavy HTML AST.
 * The streaming parser keeps visible text in document order and retains semantic attributes, while
 * presentation-only style/class attributes are discarded after they have been checked for hiding.
 */
export function compactHtmlBeforePandoc(buffer: Buffer): Buffer {
    const result: string[] = [];
    const suppressed: boolean[] = [];

    const parser = new Parser(
        {
            onopentag(name, attributes) {
                const parentSuppressed = suppressed.at(-1) ?? false;
                const displays = displayValues(attributes.style);
                const inlineStyleMayShow = displays.some((value) => !/^none(?:\s*!important)?\s*$/i.test(value));
                const hidden =
                    parentSuppressed ||
                    ALWAYS_HIDDEN_ELEMENTS.has(name) ||
                    (Object.hasOwn(attributes, 'hidden') && !inlineStyleMayShow) ||
                    hasDisplayNone(displays);
                suppressed.push(hidden);
                if (hidden) return;

                const serializedAttributes = Object.entries(attributes)
                    .filter(([attribute]) => attribute !== 'class' && attribute !== 'style' && attribute !== 'hidden')
                    .map(([attribute, value]) => ` ${attribute}="${escapeAttribute(value)}"`)
                    .join('');
                result.push(`<${name}${serializedAttributes}>`);
            },
            ontext(text) {
                if (!(suppressed.at(-1) ?? false)) result.push(text);
            },
            onclosetag(name) {
                const hidden = suppressed.pop() ?? false;
                if (!hidden && !VOID_ELEMENTS.has(name)) result.push(`</${name}>`);
            },
            onprocessinginstruction(name, data) {
                if (!(suppressed.at(-1) ?? false) && name.toLowerCase() === '!doctype') result.push(`<${data}>`);
            },
        },
        { decodeEntities: false },
    );

    parser.end(UTF8_DECODER.decode(buffer));
    return Buffer.from(result.join(''));
}
