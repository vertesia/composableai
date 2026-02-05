/**
 * FusionFragmentRenderer - Main component
 * Renders a model-generated template with actual data values
 */
import { type ReactElement } from 'react';
import type { FusionFragmentRendererProps } from '../types.js';
/**
 * FusionFragmentRenderer - Main renderer component
 *
 * Takes a model-generated template and actual data, validates the template,
 * and renders the UI with proper formatting and layout.
 *
 * @example
 * ```tsx
 * <FusionFragmentRenderer
 *   template={{
 *     title: "Fund Parameters",
 *     sections: [{
 *       title: "Identity",
 *       layout: "grid-3",
 *       fields: [
 *         { label: "Firm Name", key: "firmName" },
 *         { label: "Vintage", key: "vintageYear", format: "number" }
 *       ]
 *     }]
 *   }}
 *   data={{ firmName: "Acme Capital", vintageYear: 2024 }}
 * />
 * ```
 */
export declare function FusionFragmentRenderer({ template, data, onUpdate, agentMode, className, }: FusionFragmentRendererProps): ReactElement;
//# sourceMappingURL=FusionFragmentRenderer.d.ts.map