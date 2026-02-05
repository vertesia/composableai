/**
 * Text preview generation for non-vision models
 * Generates a text description of what the fragment will look like
 */
import type { FragmentTemplate } from '../types.js';
/**
 * Generate sample data for preview rendering
 * Creates placeholder values based on field definitions
 */
export declare function generateSampleData(template: FragmentTemplate, dataKeys: string[]): Record<string, unknown>;
/**
 * Generate a text description of the template for preview
 * Used for non-vision models
 */
export declare function generateTextPreview(template: FragmentTemplate, dataKeys: string[]): string;
/**
 * Generate a compact description for tool responses
 */
export declare function generateCompactPreview(template: FragmentTemplate): string;
//# sourceMappingURL=textPreview.d.ts.map