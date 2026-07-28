import { type CssStylesheetAST, parse, stringify } from '@adobe/css-tools';

/**
 * Extract the CSS a css-isolation plugin must inject into the host document.
 *
 * Purely subtractive: drop the `base` layer blocks — they hold the Tailwind preflight,
 * which the host document already provides — and keep everything else untouched, in
 * source order. Theme variables, components and utilities stay inside their original
 * `@layer` wrappers (so they merge into the host cascade instead of overriding it), and
 * `@property` registrations, keyframes and the `@layer properties` fallback pass through.
 * Cascade layer priorities are established by the kept blocks' own first occurrences,
 * exactly as in the source stylesheet.
 */
export function extractPluginCss(content: string): string {
    const obj = parse(content, {});
    const rules = obj.stylesheet.rules.filter(
        (rule) => !(rule.type === 'layer' && rule.layer === 'base' && rule.rules),
    );
    if (rules.length === 0) {
        return '';
    }
    const output = {
        type: 'stylesheet',
        stylesheet: {
            rules,
        },
    } as CssStylesheetAST;
    return stringify(output, {});
}
