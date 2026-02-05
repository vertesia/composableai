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
export type { FragmentTemplate, SectionTemplate, FieldTemplate, ColumnTemplate, ChartTemplate, VegaLiteSpec, ValidationResult, ValidationError, FusionFragmentRendererProps, SectionRendererProps, FieldRendererProps, FusionFragmentContextValue, ValidateFusionFragmentInput, } from './types.js';
export { FusionFragmentRenderer, SectionRenderer, FieldRenderer, FusionFragmentProvider, FusionFragmentHandler, useFusionFragmentContext, useFusionFragmentContextSafe, createFusionFragmentCodeBlockRenderer, type FusionFragmentProviderProps, type FusionFragmentHandlerProps, } from './fusion-fragment/index.js';
export { validateTemplate, parseAndValidateTemplate, FragmentTemplateSchema, SectionTemplateSchema, FieldTemplateSchema, findClosestKey, findSimilarKeys, formatValidationErrors, formatValidationSuccess, formatAvailableKeys, } from './validation/index.js';
export { generateTextPreview, generateSampleData, generateCompactPreview, } from './render/index.js';
//# sourceMappingURL=index.d.ts.map