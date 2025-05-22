import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'rollup';
import { terser } from 'rollup-plugin-terser';

const outputDir = path.resolve('lib');
const esmOutputDir = path.join(outputDir, 'esm');


// Get all directories with index.ts or index.tsx
const entries = fs.readdirSync(esmOutputDir).filter((name) => {
    const dir = path.join(esmOutputDir, name);
    try {
        if (fs.statSync(dir).isDirectory()) {
            return fs.existsSync(path.join(dir, 'index.js'));
        }
    } catch (e) {
        // ignore
    }
    return false;
});


const jsEntries = entries.map((name) => ({
    input: path.join(outputDir, 'esm', name, 'index.js'),
    output: {
        file: path.join(outputDir, `vertesia-ui-${name}.js`),
        format: 'es',
        sourcemap: true,
    },
    external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'firebase',
        'firebase/app',
        'firebase/auth',
        'firebase/analytics',
        'jwt-decode',
        "@headlessui/react",
        "lucide-react",
        "clsx",
        "@radix-ui/react-checkbox",
        "@radix-ui/react-dialog",
        "@radix-ui/react-label",
        "@radix-ui/react-popover",
        "@radix-ui/react-separator",
        "@radix-ui/react-slot",
        "@radix-ui/react-tabs",
        "@radix-ui/react-tooltip",
        "class-variance-authority",
        "cmdk",
        "date-fns",
        "lodash-es",
        "motion",
        /^motion\/.*/,
        "react-day-picker",
        "tailwind-merge",
        "debounce",
        "fast-xml-parser",
        // codemirror
        "codemirror",
        "@codemirror/state",
        "@codemirror/view",
        "@codemirror/lang-json",
        // verteisa deps
        "@llumiverse/common",
        "@vertesia/client",
        "@vertesia/common",
        "@vertesia/json",

        /^ @vertesia\/ui\/.*/
    ],
    plugins: [
        nodeResolve({
            browser: true,
            exportConditions: ['browser', 'module', 'import'],
        }),
        commonjs(),
        //terser(),
    ],
}));

export default defineConfig([...jsEntries]);
