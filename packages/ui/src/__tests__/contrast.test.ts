import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, formatRgb, type Color } from 'culori';
import { rgb as wcagRgb } from 'wcag-contrast';

/**
 * Regression gate on the OKLCH color tokens in `src/css/color.css`.
 *
 * This test only validates *token pair* contrast — i.e., the canonical
 * foreground/background pairs the design system declares. It is NOT a
 * full audit. Rendered states (hover, focus rings, disabled, text over
 * gradients/images, etc.) still require manual or visual-regression
 * checks. See the WCAG 2.1 AA criteria checklist in the PR description.
 *
 * Threshold policy (WCAG 1.4.3 / 1.4.11):
 * - >= 4.5:1 for normal text (default)
 * - >= 3:1 for large text or non-text UI (pass `large: true` in PAIRS)
 *
 * Alpha compositing: several dark-mode tokens are declared with /0.2
 * alpha (e.g. --destructive-background). Comparing the raw transparent
 * color against text produces a misleading ratio. We composite the
 * transparent color against the block's --background before measuring.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = join(__dirname, '..', 'css', 'color.css');

type Block = 'root' | 'dark';
type Pair = { fg: string; bg: string; surface?: string; large?: boolean };

// Canonical pairs declared by the design system. Keep this list in sync with
// the README "Accessibility" section so anything not listed here is treated
// as out-of-scope for the regression gate (rather than silently unchecked).
const PAIRS: Pair[] = [
    { fg: '--foreground', bg: '--background' },
    { fg: '--muted', bg: '--muted-background' },
    { fg: '--primary', bg: '--primary-background' },
    { fg: '--destructive', bg: '--destructive-background' },
    { fg: '--success', bg: '--success-background' },
    { fg: '--attention', bg: '--attention-background' },
    { fg: '--info', bg: '--info-background' },
    { fg: '--done', bg: '--done-background' },
    { fg: '--popover-foreground', bg: '--popover' },
    { fg: '--card-foreground', bg: '--card' },
    { fg: '--sidebar-foreground', bg: '--sidebar' },
    { fg: '--topnav-foreground', bg: '--topnav-background' },
];

let TOKENS: Record<Block, Record<string, string>>;

beforeAll(() => {
    const css = readFileSync(CSS_PATH, 'utf-8');
    TOKENS = {
        root: parseBlock(css, ':root'),
        dark: parseBlock(css, '.dark'),
    };
});

function parseBlock(css: string, selector: string): Record<string, string> {
    const escaped = selector.replace(/[.]/g, '\\.');
    const blockRe = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
    const m = blockRe.exec(css);
    if (!m) throw new Error(`Could not find selector ${selector} in color.css`);
    const body = m[1];
    const tokens: Record<string, string> = {};
    const declRe = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(body)) !== null) {
        tokens[d[1]] = d[2].trim();
    }
    return tokens;
}

interface Srgba { r: number; g: number; b: number; a: number }

function toSrgba(cssColor: string): Srgba {
    const parsed = parse(cssColor) as Color | undefined;
    if (!parsed) throw new Error(`culori failed to parse: ${cssColor}`);
    // Convert through culori's formatRgb to get a normalized sRGB representation,
    // then read components from the parsed object after coercing to rgb via formatRgb.
    // Simpler: use culori's parse + rgb conversion directly.
    // We re-import the conversion lazily to keep the top imports minimal.
    return colorToSrgba(parsed);
}

function colorToSrgba(c: Color): Srgba {
    // Use culori to format the color into an `rgb(r g b / a)` string, then parse it.
    // formatRgb produces e.g. "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.2)".
    const s = formatRgb(c);
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(s);
    if (!m) throw new Error(`Could not extract rgba from ${s}`);
    return {
        r: Number(m[1]),
        g: Number(m[2]),
        b: Number(m[3]),
        a: m[4] !== undefined ? Number(m[4]) : 1,
    };
}

function composite(fg: Srgba, bg: Srgba): Srgba {
    // Standard over-operator alpha compositing (Porter-Duff "over"). Assumes
    // an opaque backdrop, which is what we always pass for `bg` (since the
    // surface is itself sourced from an opaque token).
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
        r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
        g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
        b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
        a,
    };
}

function resolve(block: Block, token: string, surface?: string): Srgba {
    const tokens = TOKENS[block];
    const raw = tokens[token];
    if (raw === undefined) throw new Error(`Token ${token} missing in ${block} block`);
    const c = toSrgba(raw);
    if (c.a >= 1) return c;
    // Composite transparent colors against the block's surface. Default is
    // --background; tokens that live on --card / --popover etc. should pass
    // an explicit `surface` in their pair definition.
    const surfaceToken = surface ?? '--background';
    const surfaceRaw = tokens[surfaceToken];
    if (surfaceRaw === undefined) {
        throw new Error(`Surface ${surfaceToken} missing in ${block} block (needed to composite ${token})`);
    }
    return composite(c, toSrgba(surfaceRaw));
}

function contrast(fg: Srgba, bg: Srgba): number {
    // wcag-contrast accepts a 3-tuple of 0-255 numbers.
    return wcagRgb(
        [Math.round(fg.r), Math.round(fg.g), Math.round(fg.b)],
        [Math.round(bg.r), Math.round(bg.g), Math.round(bg.b)],
    );
}

describe('color token contrast (regression gate, not a full audit)', () => {
    for (const block of ['root', 'dark'] as Block[]) {
        describe(block === 'root' ? ':root (light theme)' : '.dark (dark theme)', () => {
            for (const pair of PAIRS) {
                const threshold = pair.large ? 3 : 4.5;
                it(`${pair.fg} on ${pair.bg} (>= ${threshold}:1)`, () => {
                    const fg = resolve(block, pair.fg, pair.surface);
                    const bg = resolve(block, pair.bg, pair.surface);
                    const ratio = contrast(fg, bg);
                    expect(ratio, `${pair.fg} on ${pair.bg} measured ${ratio.toFixed(2)}:1 in ${block}`).toBeGreaterThanOrEqual(threshold);
                });
            }
        });
    }
});
