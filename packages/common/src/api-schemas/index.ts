/**
 * Runtime API schema entry point — `@vertesia/common/api-schemas`.
 *
 * Kept OUT of the package root on purpose. `lib/index.js` is bundled wholesale into
 * `lib/vertesia-common.js` (see `rolldown.config.js`) and served to browsers as a single shared
 * library (see `apps/composable-ui/build/shared-libs.ts`), with no per-consumer tree-shaking. A
 * runtime `export *` from the root would therefore ship zod to every UI user. The root re-exports
 * only the derived TYPES, via `export type`, which tsc erases.
 *
 * Servers and the OpenAPI scanner import from this subpath explicitly.
 */
export * from './account.js';
export * from './adapter.js';
export * from './analytics.js';
export * from './apikey.js';
export * from './embeddings.js';
export * from './environment.js';
export * from './parameters.js';
export * from './quota.js';
export * from './registry.js';
