/**
 * @vertesia/fusion-ux
 *
 * Dynamic model-generated UI components for Vertesia.
 *
 * This package provides components that render model-generated templates
 * with actual data. The model generates structure (template), the system
 * provides values (data).
 *
 * @example
 * ```tsx
 * import {
 *   FusionFragmentRenderer,
 *   FusionFragmentProvider,
 *   FusionFragmentHandler,
 * } from '@vertesia/fusion-ux';
 *
 * // Option 1: Direct rendering with template and data
 * <FusionFragmentRenderer
 *   template={templateFromModel}
 *   data={actualData}
 *   onUpdate={handleUpdate}
 * />
 *
 * // Option 2: Context-based rendering (for markdown code blocks)
 * <FusionFragmentProvider data={fund.parameters} onUpdate={handleUpdate}>
 *   <MarkdownRenderer content={agentResponse} />
 * </FusionFragmentProvider>
 *
 * // Option 3: Code block handler for markdown renderers
 * const codeBlockRenderers = {
 *   'fusion-fragment': ({ code }) => <FusionFragmentHandler code={code} />
 * };
 * ```
 *
 * @packageDocumentation
 */

// Components
export {
    createFusionFragmentCodeBlockRenderer,
    FieldRenderer,
    FusionFragmentHandler,
    type FusionFragmentHandlerProps,
    FusionFragmentProvider,
    type FusionFragmentProviderProps,
    FusionFragmentRenderer,
    SectionRenderer,
    useFusionFragmentContext,
    useFusionFragmentContextSafe,
} from './fusion-fragment/index.js';
// Render utilities (text preview only - image rendering is in apps/tools)
export {
    generateCompactPreview,
    generateSampleData,
    generateTextPreview,
} from './render/index.js';
// Types
export type {
    ChartTemplate,
    ColumnTemplate,
    FieldRendererProps,
    FieldTemplate,
    FragmentTemplate,
    FusionFragmentContextValue,
    FusionFragmentRendererProps,
    SectionRendererProps,
    SectionTemplate,
    ValidateFusionFragmentInput,
    ValidationError,
    ValidationResult,
    VegaLiteSpec,
} from './types.js';
// Validation utilities
export {
    FieldTemplateSchema,
    FragmentTemplateSchema,
    findClosestKey,
    findSimilarKeys,
    formatAvailableKeys,
    formatValidationErrors,
    formatValidationSuccess,
    parseAndValidateTemplate,
    SectionTemplateSchema,
    validateTemplate,
} from './validation/index.js';
