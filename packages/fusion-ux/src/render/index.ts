/**
 * Render module exports
 *
 * NOTE: All image rendering (renderToBuffer, renderToBase64, renderToDataUrl, renderToImage)
 * has been moved to apps/tools/src/tools/fusion-ux/_shared/renderFragment.ts
 * because it requires Node.js-only modules (@napi-rs/canvas) or DOM APIs that
 * cannot be bundled for browser use.
 *
 * This module only exports text-based preview utilities that work in any environment.
 */

export {
  generateTextPreview,
  generateSampleData,
  generateCompactPreview,
} from './textPreview.js';
