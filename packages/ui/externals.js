/**
 * This file is defining the external dependencies for the Rollup configuration.
 * And it checks if the external dependencies are covering the dependencies for package.json.
 */

import { readFileSync } from 'node:fs';

export const EXTERNALS = [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'firebase',
    'firebase/app',
    'firebase/auth',
    'firebase/analytics',
    'jwt-decode',
    'clsx',
    // Must stay external (single shared copy via the import map): react-direction's context is
    // provided by the i18n bundle and read by radix primitives inside core/features — a bundled
    // copy per lib would be a different React context and RTL would silently stop propagating.
    '@radix-ui/react-direction',
    // These radix internals hold module-level state (dismissable layer stack, focus-scope stack,
    // focus-guard counter). Several subpath bundles embed Dialog/Popover, so a bundled copy per
    // lib would give each its own stack: nested overlays across bundles would fight over Escape
    // handling, focus trapping, and body pointer-events restoration. One shared copy via the
    // import map keeps them coordinated.
    '@radix-ui/react-dismissable-layer',
    '@radix-ui/react-focus-guards',
    '@radix-ui/react-focus-scope',
    // The scroll-lock family coordinates through module-level singletons; per-lib copies would
    // not see each other and nested overlays across libs could restore body scroll early.
    'aria-hidden',
    'react-remove-scroll',
    'react-remove-scroll-bar',
    'react-style-singleton',
    'class-variance-authority',
    'lodash-es',
    'papaparse',
    'ts-md5',
    // rehype-katex is dynamically imported by the markdown renderer so math support stays lazy;
    // it (and katex, which it drags in) must remain external or the single-file widgets bundle
    // would inline the dynamic import and make katex a static startup dependency.
    'rehype-katex',
    'katex',
    '@monaco-editor/react',
    'monaco-editor',
    'tailwind-merge',
    'debounce',
    'fast-xml-parser',
    // verteisa deps
    '@llumiverse/common',
    '@vertesia/client',
    '@vertesia/common',
    '@vertesia/fusion-ux',
    '@vertesia/json',
    '@vertesia/rich-text',
    'ajv',
    'ajv-formats',
    'dayjs',
    /^dayjs\/.*/,
    'react-error-boundary',
    'react-date-picker',
    /^@vertesia\/ui\/.*/,
    '@floating-ui/dom',
    '@floating-ui/react',
    'json-schema',
    'react-resizable-panels',
    'react-vega',
    'vega',
    'vega-embed',
    'vega-lite',
    /^vega\/.*/,
    /^vega-lite\/.*/,
    'dompurify',
    'i18next',
    'react-i18next',
    'mermaid',
    'react-pdf',
    /^react-pdf\/.*/,
    'pdfjs-dist',
    /^pdfjs-dist\/.*/,
];

// Deps deliberately bundled into the consuming subpath bundles instead of loaded via the import
// map: tree-shaking keeps only what is used (lucide-react's full icon set alone is ~900 KB as an
// external file), and each bundled package removes a request from the app's startup waterfall.
// Only safe for packages with no cross-bundle module state — see the react-direction and
// scroll-lock notes in EXTERNALS above. katex stays external: it is large, shared, and cacheable.
const INLINED_DEPS = [
    'lucide-react',
    '@radix-ui/react-checkbox',
    '@radix-ui/react-collapsible',
    '@radix-ui/react-dialog',
    '@radix-ui/react-label',
    '@radix-ui/react-popover',
    '@radix-ui/react-separator',
    '@radix-ui/react-slider',
    '@radix-ui/react-slot',
    '@radix-ui/react-tabs',
    '@radix-ui/react-radio-group',
    '@radix-ui/react-switch',
    '@radix-ui/react-tooltip',
    '@radix-ui/react-portal',
    '@radix-ui/react-dropdown-menu',
    'cmdk',
    'react-markdown',
    'remark-gfm',
    'remark-math',
    'remark-definition-list',
    'remark-directive',
    'remark-github-blockquote-alert',
    'remark-supersub',
    'unist-util-visit',
    'react-calendar',
    'motion',
    'framer-motion',
];

function resolve(path) {
    return new URL(path, import.meta.url).pathname;
}

function validateExternals() {
    const pkgJson = resolve('./package.json');
    const content = readFileSync(pkgJson, 'utf-8');
    const pkg = JSON.parse(content);
    const pkgDependencies = Object.keys(pkg.dependencies || {});

    const externals = new Set(EXTERNALS.filter((ext) => typeof ext === 'string'));
    const regexps = EXTERNALS.filter((ext) => ext instanceof RegExp);
    const unmatched = new Set();
    const inlinedDeps = new Set(INLINED_DEPS);
    for (const dependency of pkgDependencies) {
        if (externals.has(dependency)) {
            externals.delete(dependency);
        } else if (regexps.some((regexp) => regexp.test(dependency))) {
        } else if (!inlinedDeps.has(dependency)) {
            unmatched.add(dependency);
        }
    }
    if (externals.size > 0) {
        console.warn(`⚠️ Warning: The following externals are not used: ${Array.from(externals).join(', ')}`);
    }
    if (unmatched.size > 0) {
        console.error(
            '❌ Error: The following dependencies form package.json are not declared as external:',
            Array.from(unmatched),
        );
        process.exit(1);
    }

    console.log('✅ External dependencies are consistent with package.json dependencies.');
}

validateExternals();
