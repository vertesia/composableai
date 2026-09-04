#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(__dirname, '..', 'src', 'i18n', 'locales');

function collectLeafValues(value, path, out) {
    if (typeof value === 'string') {
        out.set(path.join('.'), value);
        return;
    }

    if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) {
            collectLeafValues(item, [...path, String(index)], out);
        }
        return;
    }

    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            collectLeafValues(child, [...path, key], out);
        }
    }
}

const localeFiles = readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
const englishFile = 'en.json';

if (!localeFiles.includes(englishFile)) {
    console.error(`Missing source locale: ${englishFile}`);
    process.exit(1);
}

const englishValues = new Map();
collectLeafValues(JSON.parse(readFileSync(resolve(LOCALES_DIR, englishFile), 'utf8')), [], englishValues);
const failures = [];

for (const file of localeFiles) {
    const data = JSON.parse(readFileSync(resolve(LOCALES_DIR, file), 'utf8'));
    const localeValues = new Map();
    collectLeafValues(data, [], localeValues);

    for (const [key, value] of localeValues) {
        if (value.trim() === '') {
            failures.push({ file, key, reason: 'empty value' });
        }
    }

    if (file !== englishFile) {
        for (const key of englishValues.keys()) {
            if (!localeValues.has(key)) {
                failures.push({ file, key, reason: `missing key from ${englishFile}` });
            }
        }
    }
}

if (failures.length > 0) {
    console.error(`Found ${failures.length} locale synchronization error${failures.length === 1 ? '' : 's'}:`);
    const failuresByFile = new Map();
    for (const failure of failures) {
        const fileFailures = failuresByFile.get(failure.file) ?? [];
        fileFailures.push(failure);
        failuresByFile.set(failure.file, fileFailures);
    }
    for (const [file, fileFailures] of failuresByFile) {
        console.error(`  ${file}: ${fileFailures.length} error${fileFailures.length === 1 ? '' : 's'}`);
        for (const failure of fileFailures.slice(0, 10)) {
            console.error(`    ${failure.key}: ${failure.reason}`);
        }
        if (fileFailures.length > 10) {
            console.error(`    ...and ${fileFailures.length - 10} more`);
        }
    }
    process.exit(1);
}

console.log(`Locale files contain every ${englishFile} key and no empty values.`);
