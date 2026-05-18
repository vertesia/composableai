#!/usr/bin/env node
/**
 * migrate-to-logical.mjs
 *
 * Rewrites directional Tailwind utilities to logical equivalents so the UI
 * mirrors correctly under `dir="rtl"`. Scope:
 *   - composableai/packages/ui/src
 *   - composableai/templates/plugin-template/src/ui
 *
 *   ml-/-ml-    -> ms-/-ms-      (margin-inline-start)
 *   mr-/-mr-    -> me-/-me-      (margin-inline-end)
 *   pl-         -> ps-           (padding-inline-start)
 *   pr-         -> pe-           (padding-inline-end)
 *   left-/-left-   -> start-/-start-   (inset-inline-start)
 *   right-/-right- -> end-/-end-       (inset-inline-end)
 *   text-left   -> text-start
 *   text-right  -> text-end
 *   border-l(-*) -> border-s(-*)
 *   border-r(-*) -> border-e(-*)
 *   rounded-l(-*) -> rounded-s(-*)
 *   rounded-r(-*) -> rounded-e(-*)
 *   rounded-tl-*  -> rounded-ss-*
 *   rounded-tr-*  -> rounded-se-*
 *   rounded-bl-*  -> rounded-es-*
 *   rounded-br-*  -> rounded-ee-*
 *   float-left/right  -> float-start/end
 *   clear-left/right  -> clear-start/end
 *
 * Audit categories (space-x, divide-x, translate-x, slide-in/out, fixed-edge)
 * are NOT rewritten — they require human judgment. The check-rtl-classes
 * inventory still flags them after this script runs.
 *
 * Honors `// rtl-ok:` exemption markers (on the line or the line above).
 *
 * Flags:
 *   --dry-run  print proposed changes, do not write
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(PKG_ROOT, '..', '..');

const SCAN_TARGETS = [
    resolve(PKG_ROOT, 'src'),
    resolve(REPO_ROOT, 'templates', 'plugin-template', 'src', 'ui'),
];

const SOURCE_EXT = /\.(tsx?|css)$/;
const SKIP_DIRS = new Set(['node_modules', 'lib', 'dist', '.turbo']);
const RTL_OK = /\/\/\s*rtl-ok:/;

// The variant prefix matcher we need to preserve in front of the base utility:
//   hover:, md:, dark:, peer-focus:, data-[state=open]:, [&_th]:, etc.
// We capture this whole run and leave it intact in the replacement.
const VARIANT = String.raw`(?:(?:[a-z][a-z0-9-]*|\[[^\]]+\]|peer-[a-z-]+|group-[a-z-]+|data-\[[^\]]+\]|aria-\[[^\]]+\]|has-\[[^\]]+\]|not-[a-z-]+):)*`;

// Each match must START at a class boundary, otherwise we'd rewrite the
// `left-2` inside `slide-in-from-left-2` (animation class) into something
// nonsensical. A class boundary is: start of line, whitespace, opening quote
// / brace / paren / bracket, or a comma.
const BOUNDARY_BEFORE = String.raw`(?<=^|[\s"'\`{(\[,>])`;

// Trailing modifiers — kept narrow on purpose so we don't match `border-left`
// in a CSS file or `right-panel-width` in a custom-property string. These
// mirror the inventory regexes in check-rtl-classes.mjs.
const MOD_SPACING = String.raw`(?:\d+|\[.+?\]|px|auto|full|\d+\.\d+|[\d./]+)`;
const MOD_BORDER  = String.raw`(?:\d+|\[.+?\]|none|px)`;
const MOD_ROUNDED = String.raw`(?:none|sm|md|lg|xl|\d?xl|full|\[.+?\])`;

// Each rule: name, regex (capturing variant prefix as group 1 and optional
// `-` negative as group 2), and the new base. The base is sandwiched between
// the captured prefix and a `-` plus the trailing modifier (or end of token
// for `text-left` etc).
const RULES = [
    // Spacing: ml/mr/pl/pr  (margin/padding inline)
    { name: 'ml',         re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})(-?)ml-(${MOD_SPACING})`, 'g'), to: '$1$2ms-$3' },
    { name: 'mr',         re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})(-?)mr-(${MOD_SPACING})`, 'g'), to: '$1$2me-$3' },
    { name: 'pl',         re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})pl-(${MOD_SPACING})`, 'g'),     to: '$1ps-$2' },
    { name: 'pr',         re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})pr-(${MOD_SPACING})`, 'g'),     to: '$1pe-$2' },

    // Positioning: left/right
    { name: 'left',       re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})(-?)left-(${MOD_SPACING})`, 'g'),  to: '$1$2start-$3' },
    { name: 'right',      re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})(-?)right-(${MOD_SPACING})`, 'g'), to: '$1$2end-$3' },

    // Text alignment
    { name: 'text-left',  re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})text-left\\b`, 'g'),  to: '$1text-start' },
    { name: 'text-right', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})text-right\\b`, 'g'), to: '$1text-end' },

    // Corner radii (do four-corner rules BEFORE the two-side ones so the
    // longer prefixes win):
    { name: 'rounded-tl', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-tl-(${MOD_ROUNDED})`, 'g'), to: '$1rounded-ss-$2' },
    { name: 'rounded-tr', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-tr-(${MOD_ROUNDED})`, 'g'), to: '$1rounded-se-$2' },
    { name: 'rounded-bl', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-bl-(${MOD_ROUNDED})`, 'g'), to: '$1rounded-es-$2' },
    { name: 'rounded-br', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-br-(${MOD_ROUNDED})`, 'g'), to: '$1rounded-ee-$2' },

    // Two-side radii (with optional modifier)
    { name: 'rounded-l-N', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-l-(${MOD_ROUNDED})`, 'g'), to: '$1rounded-s-$2' },
    { name: 'rounded-r-N', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-r-(${MOD_ROUNDED})`, 'g'), to: '$1rounded-e-$2' },
    { name: 'rounded-l',  re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-l\\b`, 'g'), to: '$1rounded-s' },
    { name: 'rounded-r',  re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})rounded-r\\b`, 'g'), to: '$1rounded-e' },

    // Border sides (with optional modifier — width or arbitrary)
    { name: 'border-l-N', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})border-l-(${MOD_BORDER})`, 'g'), to: '$1border-s-$2' },
    { name: 'border-r-N', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})border-r-(${MOD_BORDER})`, 'g'), to: '$1border-e-$2' },
    { name: 'border-l',   re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})border-l\\b`, 'g'), to: '$1border-s' },
    { name: 'border-r',   re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})border-r\\b`, 'g'), to: '$1border-e' },

    // Float / clear
    { name: 'float-left',  re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})float-left\\b`, 'g'),  to: '$1float-start' },
    { name: 'float-right', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})float-right\\b`, 'g'), to: '$1float-end' },
    { name: 'clear-left',  re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})clear-left\\b`, 'g'),  to: '$1clear-start' },
    { name: 'clear-right', re: new RegExp(`${BOUNDARY_BEFORE}(${VARIANT})clear-right\\b`, 'g'), to: '$1clear-end' },
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const full = join(dir, name);
        const s = statSync(full);
        if (s.isDirectory()) walk(full, out);
        else if (s.isFile() && SOURCE_EXT.test(name)) out.push(full);
    }
    return out;
}

function transformFile(file, dryRun) {
    const original = readFileSync(file, 'utf-8');
    const lines = original.split('\n');
    const stats = {};

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (RTL_OK.test(line)) continue;
        if (i > 0 && RTL_OK.test(lines[i - 1])) continue;

        let next = line;
        for (const { name, re, to } of RULES) {
            re.lastIndex = 0;
            const before = next;
            next = next.replace(re, to);
            if (next !== before) {
                const count = (before.match(re) || []).length;
                stats[name] = (stats[name] || 0) + count;
            }
        }
        lines[i] = next;
    }

    const updated = lines.join('\n');
    const changed = updated !== original;
    if (changed && !dryRun) writeFileSync(file, updated);
    return { changed, stats };
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const totals = {};
    let filesChanged = 0;

    for (const root of SCAN_TARGETS) {
        if (!existsSync(root)) continue;
        for (const file of walk(root)) {
            const { changed, stats } = transformFile(file, dryRun);
            if (!changed) continue;
            filesChanged++;
            const rel = relative(REPO_ROOT, file);
            const summary = Object.entries(stats)
                .map(([k, n]) => `${k}=${n}`)
                .join(' ');
            console.log(`  ${rel}  (${summary})`);
            for (const [k, n] of Object.entries(stats)) {
                totals[k] = (totals[k] || 0) + n;
            }
        }
    }

    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
    console.log(`\n${dryRun ? '[dry-run] would rewrite' : 'rewrote'} ${grandTotal} occurrences across ${filesChanged} files:`);
    for (const [k, n] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k.padEnd(14)} ${n}`);
    }
}

main();
