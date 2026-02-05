/**
 * Widget compilation utility using Rollup
 */
import type { WidgetConfig } from '../types.js';
import type { WidgetMetadata } from './asset-discovery.js';
/**
 * Compile widgets using Rollup
 *
 * @param widgets - Array of widget metadata to compile
 * @param outputDir - Directory to write compiled widgets
 * @param config - Widget compilation configuration
 * @returns Number of widgets compiled
 */
export declare function compileWidgets(widgets: WidgetMetadata[], outputDir: string, config?: WidgetConfig): Promise<number>;
//# sourceMappingURL=widget-compiler.d.ts.map