/**
 * Core template validation logic
 * Two-stage validation: Schema (AJV) + Semantic (custom)
 */
import type { FragmentTemplate, ValidationResult } from '../types.js';
/**
 * Validate a template against schema and data keys
 * @param template - The template to validate (unknown for parsing)
 * @param dataKeys - Available keys in the data
 * @returns Validation result with errors
 */
export declare function validateTemplate(template: unknown, dataKeys: string[]): ValidationResult;
/**
 * Parse and validate a JSON string as a template
 * @param jsonString - JSON string to parse
 * @param dataKeys - Available data keys
 * @returns Validation result with parsed template if valid
 */
export declare function parseAndValidateTemplate(jsonString: string, dataKeys: string[]): ValidationResult & {
    template?: FragmentTemplate;
};
//# sourceMappingURL=validateTemplate.d.ts.map