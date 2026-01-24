/**
 * Server-side exports for @vertesia/fusion-ux
 *
 * This module provides tool collections and utilities for server-side
 * integration with the Vertesia tools system.
 *
 * @example
 * ```typescript
 * import { fusionUxTools } from '@vertesia/fusion-ux/server';
 *
 * // Register tools with your server
 * server.registerCollection(fusionUxTools);
 * ```
 *
 * @packageDocumentation
 */

// Tool collection
export { fusionUxTools } from './server/index.js';

// Individual tools (for custom registration)
export { ValidateFusionFragmentTool } from './tools/index.js';

// Skills
export { FusionFragmentSkill } from './skills/index.js';
export { fusionUxSkills } from './server/index.js';

// Validation utilities (useful for server-side validation)
export {
  validateTemplate,
  parseAndValidateTemplate,
  formatValidationErrors,
  formatAvailableKeys,
  findClosestKey,
  findSimilarKeys,
} from './validation/index.js';

// Preview generation (server-side compatible)
export {
  generateTextPreview,
  generateSampleData,
  generateCompactPreview,
} from './render/textPreview.js';

// Serverless canvas rendering (requires @napi-rs/canvas)
export {
  renderToBuffer,
  renderToBufferAsync,
  renderToBase64,
  renderToDataUrl,
} from './render/serverlessRender.js';

// Types
export type {
  FragmentTemplate,
  SectionTemplate,
  FieldTemplate,
  ColumnTemplate,
  ChartTemplate,
  VegaLiteSpec,
  ValidationResult,
  ValidationError,
  ValidateFusionFragmentInput,
} from './types.js';
