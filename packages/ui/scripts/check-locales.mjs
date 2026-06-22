#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(__dirname, '..', 'src', 'i18n', 'locales');

function collectEmptyValues(value, path, out) {
    if (typeof value === 'string') {
        if (value.trim() === '') {
            out.push(path.join('.'));
        }
        return;
    }

    if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) {
            collectEmptyValues(item, [...path, String(index)], out);
        }
        return;
    }

    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            collectEmptyValues(child, [...path, key], out);
        }
    }
}

const failures = [];

for (const file of readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const data = JSON.parse(readFileSync(resolve(LOCALES_DIR, file), 'utf8'));
    const emptyKeys = [];
    collectEmptyValues(data, [], emptyKeys);

    for (const key of emptyKeys) {
        failures.push(`${file}:${key}`);
    }
}

if (failures.length > 0) {
    console.error(`Found ${failures.length} empty locale value${failures.length === 1 ? '' : 's'}:`);
    for (const failure of failures) {
        console.error(`  ${failure}`);
    }
    process.exit(1);
}

console.log('Locale files contain no empty values.');
