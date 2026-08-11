import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the generated documentation shipped with this package.
 *
 * Keep this package external when bundling consumers so import.meta.url still
 * resolves relative to the installed package.
 */
export const appgenDocsRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'docs');
