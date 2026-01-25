/**
 * Render module exports
 *
 * NOTE: Serverless rendering (renderToBuffer, renderToBase64, renderToDataUrl) has been
 * moved to @vertesiahq/tools (apps/tools/src/tools/fusion-ux/_shared/renderFragment.ts)
 * because it uses @napi-rs/canvas which is a Node.js-only native module that cannot
 * be bundled for browser use.
 */

export {
  renderToImage,
  extractBase64FromDataUrl,
  createImageContentBlock,
} from './headlessRender.js';

export {
  generateTextPreview,
  generateSampleData,
  generateCompactPreview,
} from './textPreview.js';
