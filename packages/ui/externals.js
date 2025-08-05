/**
 * This file is defining the external dependencies for the Rollup configuration.
 * And it checks if the external dependencies are covering the dependencies for package.json.
 */

import { readFileSync } from "fs";

export const EXTERNALS = [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "firebase",
    "firebase/app",
    "firebase/auth",
    "firebase/analytics",
    "jwt-decode",
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
    "lodash-es",
    "ts-md5",
    "react-markdown",
    "remark-gfm",
    "@monaco-editor/react",
    "monaco-editor",
    "motion",
    /^motion\/.*/,
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
    "ajv",
    "dayjs",
    /^dayjs\/.*/,
    "react-error-boundary",
    "react-date-picker",
    /^@vertesia\/ui\/.*/,
    "@floating-ui/dom",
    "@floating-ui/react",
    "json-schema",
    "react-calendar",
    "framer-motion"
];

// Put here exceptions - deps that shuld be inlined
const INLINED_DEPS = [];

function resolve(path) {
    return new URL(path, import.meta.url).pathname;
}

function validateExternals() {
    const pkgJson = resolve("./package.json");
    const content = readFileSync(pkgJson, "utf-8");
    const pkg = JSON.parse(content);
    const pkgDependencies = Object.keys(pkg.dependencies || {});

    const externals = new Set(
        EXTERNALS.filter((ext) => typeof ext === "string"),
    );
    const regexps = EXTERNALS.filter((ext) => ext instanceof RegExp);
    const unmatched = new Set();
    const inlinedDeps = new Set(INLINED_DEPS);
    for (const dependency of pkgDependencies) {
        if (externals.has(dependency)) {
            externals.delete(dependency);
            continue;
        } else if (regexps.some((regexp) => regexp.test(dependency))) {
            continue;
        } else if (!inlinedDeps.has(dependency)) {
            unmatched.add(dependency);
        }
    }
    if (externals.size > 0) {
        console.warn(
            `⚠️ Warning: The following externals are not used: ${Array.from(externals).join(", ")}`,
        );
    }
    if (unmatched.size > 0) {
        console.error(
            "❌ Error: The following dependencies form package.json are not declared as external:",
            Array.from(unmatched),
        );
        process.exit(1);
    }

    console.log(
        "✅ External dependencies are consistent with package.json dependencies.",
    );
}

validateExternals();
