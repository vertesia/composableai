/**
 * Error formatting utilities for model-friendly output
 */
import type { ValidationError } from '../types.js';
/**
 * Format validation errors as a model-friendly string
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export declare function formatValidationErrors(errors: ValidationError[]): string;
/**
 * Format a successful validation with preview info
 * @param template - The validated template
 * @param dataKeys - Available data keys
 * @returns Success message with preview
 */
export declare function formatValidationSuccess(template: {
    title?: string;
    sections: Array<{
        title: string;
        fields: Array<{
            label: string;
            key: string;
            format?: string;
        }>;
    }>;
}, dataKeys: string[]): string;
/**
 * Format a list of available keys for model reference
 * @param dataKeys - Available data keys
 * @param groupByPrefix - Whether to group keys by common prefix
 * @returns Formatted key list
 */
export declare function formatAvailableKeys(dataKeys: string[], groupByPrefix?: boolean): string;
//# sourceMappingURL=formatErrors.d.ts.map