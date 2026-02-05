/**
 * FusionFragmentHandler - Code block handler component
 * Parses fusion-fragment code blocks and renders them
 */
import { type ReactElement } from 'react';
export interface FusionFragmentHandlerProps {
    /** The JSON code from the fusion-fragment code block */
    code: string;
    /** Optional data to use instead of context */
    data?: Record<string, unknown>;
    /** Optional update handler */
    onUpdate?: (key: string, value: unknown) => Promise<void>;
}
/**
 * FusionFragmentHandler - Handles fusion-fragment code blocks
 *
 * This component is designed to be used as a code block renderer.
 * It parses the JSON template from the code block and renders it
 * using data from the FusionFragmentContext.
 *
 * @example
 * ```tsx
 * // In your markdown renderer:
 * const codeBlockRenderers = {
 *   'fusion-fragment': ({ code }) => <FusionFragmentHandler code={code} />
 * };
 * ```
 */
export declare function FusionFragmentHandler({ code, data: propData, onUpdate: propOnUpdate, }: FusionFragmentHandlerProps): ReactElement;
/**
 * Factory function to create a code block renderer configuration
 * for use with markdown renderers that support custom code blocks
 */
export declare function createFusionFragmentCodeBlockRenderer(): {
    language: string;
    component: typeof FusionFragmentHandler;
};
//# sourceMappingURL=FusionFragmentHandler.d.ts.map