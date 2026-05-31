#!/usr/bin/env node
/**
 * Overlay the working reference implementations in examples/ onto src/, turning
 * the minimal default scaffold (Home + assistant chat, empty tool-server) into
 * the FULL scaffold (Store-object list/detail, conversations, settings, and the
 * populated tool-server collections).
 *
 * The examples were authored relative to their src/ locations, so copying them
 * back into src/ makes every relative import resolve. This runs at create time
 * for `create-plugin --full`, and the smoke test uses it to build-test the full
 * surface so the examples can't silently rot.
 *
 * Idempotent: re-running overwrites the same files.
 */
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const examples = join(root, 'examples');

if (!existsSync(examples)) {
    console.error('apply-examples: examples/ directory not found — nothing to apply.');
    process.exit(1);
}

const copy = (from, to) => {
    const src = join(examples, from);
    if (!existsSync(src)) return;
    cpSync(src, join(root, to), { recursive: true });
    console.log(`  ${from} -> ${to}`);
};

console.log('Applying full example scaffold into src/...');

// UI: overlay feature folders and route-level pages, then swap in the full router.
copy('ui/features', 'src/ui/app/features');
copy('ui/pages', 'src/ui/app/pages');
copy('ui/routes.tsx', 'src/ui/app/routes.tsx');

// Tool server: each kind ships a populated index.ts that config.ts already imports.
for (const kind of ['tools', 'types', 'interactions', 'skills', 'templates', 'activities']) {
    copy(`tool-server/${kind}`, `src/tool-server/${kind}`);
}

console.log('Done. Full scaffold applied.');
