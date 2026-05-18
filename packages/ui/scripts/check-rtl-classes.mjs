#!/usr/bin/env node
/**
 * check-rtl-classes.mjs
 *
 * Inventory + drift-guard for directional Tailwind utilities that block RTL
 * support. Two modes:
 *
 *   --mode=baseline   Compares against .rtl-baseline.json. Passes if the
 *                     violation count has not increased. Run with --update
 *                     to (re)write the baseline file.
 *
 *   --mode=strict     Fails on any banned directional utility outside
 *                     `// rtl-ok:` exemptions. Use as the final CI gate
 *                     after the codemod sweep completes.
 *
 * Detection is regex-based over .tsx/.ts/.css source files in the
 * @vertesia/ui package and composableai/templates/plugin-template/src/ui.
 * That covers className literals, cn/clsx/classNames args, template
 * literals, string constants, arrays, object values, and arbitrary variants
 * (hover:ml-2, [&_th]:text-left, data-[state=open]:left-0, md:rounded-l-md,
 * etc).
 *
 * Two violation classes:
 *
 *   auto    Codemod-safe directional utilities (ml-, mr-, pl-, pr-, left-,
 *           right-, text-left, text-right, border-l, border-r,
 *           rounded-l / rounded-r, float-left/right, clear-left/right).
 *
 *   audit   Manual-review utilities where flipping is context-dependent
 *           (space-x-*, divide-x-*, translate-x-*, slide-in/out animations,
 *           absolute left-0/right-0 on fixed panels, etc).
 *
 * Exemption: add `// rtl-ok: <reason>` on the same line or the line above a
 * deliberate directional class.
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

const BASELINE_PATH = resolve(PKG_ROOT, '.rtl-baseline.json');

// Variant prefix matcher: peer-focus:, hover:, md:, lg:, dark:, data-[..]:,
// [&_th]:, etc. We allow 0+ variants, then capture the base utility.
const VARIANT = String.raw`(?:(?:[a-z][a-z0-9-]*|\[[^\]]+\]|peer-[a-z-]+|group-[a-z-]+|data-\[[^\]]+\]|aria-\[[^\]]+\]|has-\[[^\]]+\]|not-[a-z-]+):)*`;
const NEG = String.raw`-?`;

// Codemod-safe categories.
const AUTO_PATTERNS = [
    ['ml',         `${VARIANT}${NEG}ml-(?:\\d+|\\[.+?\\]|px|auto|full|\\d+\\.\\d+|[\\d./]+)`],
    ['mr',         `${VARIANT}${NEG}mr-(?:\\d+|\\[.+?\\]|px|auto|full|\\d+\\.\\d+|[\\d./]+)`],
    ['pl',         `${VARIANT}pl-(?:\\d+|\\[.+?\\]|px|\\d+\\.\\d+|[\\d./]+)`],
    ['pr',         `${VARIANT}pr-(?:\\d+|\\[.+?\\]|px|\\d+\\.\\d+|[\\d./]+)`],
    ['left',       `${VARIANT}${NEG}left-(?:\\d+|\\[.+?\\]|px|auto|full|\\d+\\.\\d+|[\\d./]+)`],
    ['right',      `${VARIANT}${NEG}right-(?:\\d+|\\[.+?\\]|px|auto|full|\\d+\\.\\d+|[\\d./]+)`],
    ['text-left',  `${VARIANT}text-left\\b`],
    ['text-right', `${VARIANT}text-right\\b`],
    ['border-l',   `${VARIANT}border-l(?:-(?:\\d+|\\[.+?\\]|none|px))?\\b`],
    ['border-r',   `${VARIANT}border-r(?:-(?:\\d+|\\[.+?\\]|none|px))?\\b`],
    ['rounded-l',  `${VARIANT}rounded-l(?:-(?:none|sm|md|lg|xl|\\d?xl|full|\\[.+?\\]))?\\b`],
    ['rounded-r',  `${VARIANT}rounded-r(?:-(?:none|sm|md|lg|xl|\\d?xl|full|\\[.+?\\]))?\\b`],
    ['rounded-tl', `${VARIANT}rounded-tl(?:-(?:none|sm|md|lg|xl|\\d?xl|full|\\[.+?\\]))?\\b`],
    ['rounded-tr', `${VARIANT}rounded-tr(?:-(?:none|sm|md|lg|xl|\\d?xl|full|\\[.+?\\]))?\\b`],
    ['rounded-bl', `${VARIANT}rounded-bl(?:-(?:none|sm|md|lg|xl|\\d?xl|full|\\[.+?\\]))?\\b`],
    ['rounded-br', `${VARIANT}rounded-br(?:-(?:none|sm|md|lg|xl|\\d?xl|full|\\[.+?\\]))?\\b`],
    ['float',      `${VARIANT}float-(?:left|right)\\b`],
    ['clear',      `${VARIANT}clear-(?:left|right)\\b`],
];

// Audit categories — context-dependent; codemod must NOT rewrite blindly.
const AUDIT_PATTERNS = [
    ['space-x',     `${VARIANT}space-x-(?:\\d+|\\[.+?\\]|px|reverse|\\d+\\.\\d+|[\\d./]+)`],
    ['divide-x',    `${VARIANT}divide-x(?:-(?:\\d+|\\[.+?\\]|reverse))?\\b`],
    ['translate-x', `${VARIANT}${NEG}translate-x-(?:\\d+|\\[.+?\\]|px|full|\\d+\\.\\d+|[\\d./]+)`],
    ['slide-in',    `${VARIANT}slide-in-from-(?:left|right)(?:-\\d+|\\[.+?\\])?\\b`],
    ['slide-out',   `${VARIANT}slide-out-to-(?:left|right)(?:-\\d+|\\[.+?\\])?\\b`],
    ['fixed-edge',  `${VARIANT}(?:left|right)-0\\b`],
];

const ALL_PATTERNS = [
    ...AUTO_PATTERNS.map(([cat, re]) => ({ category: cat, klass: 'auto', re: new RegExp(re, 'g') })),
    ...AUDIT_PATTERNS.map(([cat, re]) => ({ category: cat, klass: 'audit', re: new RegExp(re, 'g') })),
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

const RTL_OK = /\/\/\s*rtl-ok:/;

function scanFile(file) {
    const src = readFileSync(file, 'utf-8');
    const lines = src.split('\n');
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (RTL_OK.test(line)) continue;
        // Also skip if the line above marks an rtl-ok exemption.
        if (i > 0 && RTL_OK.test(lines[i - 1])) continue;
        for (const { category, klass, re } of ALL_PATTERNS) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(line)) !== null) {
                hits.push({ category, klass, match: m[0], line: i + 1 });
            }
        }
    }
    return hits;
}

function collect() {
    const violations = {};
    let total = 0;
    for (const root of SCAN_TARGETS) {
        if (!existsSync(root)) continue;
        for (const file of walk(root)) {
            const hits = scanFile(file);
            if (hits.length === 0) continue;
            const rel = relative(REPO_ROOT, file);
            violations[rel] = hits;
            total += hits.length;
        }
    }
    return { violations, total };
}

function summarize(violations) {
    const byCategory = {};
    for (const hits of Object.values(violations)) {
        for (const h of hits) {
            const key = `${h.klass}:${h.category}`;
            byCategory[key] = (byCategory[key] || 0) + 1;
        }
    }
    return byCategory;
}

function fileTotals(violations) {
    const out = {};
    for (const [file, hits] of Object.entries(violations)) {
        out[file] = hits.length;
    }
    return out;
}

function fmt(o) {
    return JSON.stringify(o, null, 2) + '\n';
}

function parseArgs(argv) {
    const args = { mode: 'baseline', update: false };
    for (const a of argv.slice(2)) {
        if (a.startsWith('--mode=')) args.mode = a.slice('--mode='.length);
        else if (a === '--update') args.update = true;
    }
    return args;
}

function printSummary(byCategory, total) {
    console.log(`Found ${total} directional-utility occurrences:`);
    const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const w = Math.max(...rows.map(([k]) => k.length), 12);
    for (const [k, n] of rows) console.log(`  ${k.padEnd(w)} ${n}`);
}

function main() {
    const args = parseArgs(process.argv);
    const { violations, total } = collect();
    const byCategory = summarize(violations);

    if (args.mode === 'baseline' && args.update) {
        const baseline = {
            totalViolations: total,
            byCategory,
            files: fileTotals(violations),
        };
        writeFileSync(BASELINE_PATH, fmt(baseline));
        console.log(`Wrote baseline: ${relative(REPO_ROOT, BASELINE_PATH)}`);
        printSummary(byCategory, total);
        process.exit(0);
    }

    if (args.mode === 'baseline') {
        if (!existsSync(BASELINE_PATH)) {
            console.error(`No baseline at ${relative(REPO_ROOT, BASELINE_PATH)}.`);
            console.error(`Run \`pnpm check:rtl-classes --update\` to create one.`);
            printSummary(byCategory, total);
            process.exit(1);
        }
        const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
        printSummary(byCategory, total);
        if (total > baseline.totalViolations) {
            console.error(`\n❌ Directional-utility count increased: ${baseline.totalViolations} → ${total}.`);
            console.error('Fix new violations (prefer logical equivalents: ms-/me-/ps-/pe-/start-/end-/text-start/text-end),');
            console.error('or — only if the direction is semantic — add `// rtl-ok: <reason>` on/above the line.');
            process.exit(1);
        }
        if (total < baseline.totalViolations) {
            console.log(`\nℹ️  Directional-utility count decreased: ${baseline.totalViolations} → ${total}.`);
            console.log(`Run \`pnpm check:rtl-classes --update\` to ratchet the baseline downward.`);
        } else {
            console.log(`\n✅ Directional-utility count unchanged from baseline (${total}).`);
        }
        process.exit(0);
    }

    if (args.mode === 'strict') {
        printSummary(byCategory, total);
        if (total > 0) {
            console.error(`\n❌ Strict mode: ${total} directional-utility violations remain.`);
            console.error('Convert to logical equivalents, or add `// rtl-ok: <reason>` for intentional directional classes.');
            process.exit(1);
        }
        console.log(`\n✅ No directional-utility violations.`);
        process.exit(0);
    }

    console.error(`Unknown mode: ${args.mode}`);
    process.exit(2);
}

main();
