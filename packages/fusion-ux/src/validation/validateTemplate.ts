/**
 * Core template validation logic
 * Two-stage validation: Schema (AJV) + Semantic (custom)
 */

import Ajv from 'ajv';
import type { FragmentTemplate, ValidationResult, ValidationError } from '../types.js';
import { FragmentTemplateSchema } from './schemas.js';
import { findClosestKey } from './fuzzyMatch.js';

// Create AJV instance with all errors enabled
const ajv = new Ajv({ allErrors: true, verbose: true });

// Compile the schema
const validateSchema = ajv.compile(FragmentTemplateSchema);

/**
 * Validate a template against schema and data keys
 * @param template - The template to validate (unknown for parsing)
 * @param dataKeys - Available keys in the data
 * @returns Validation result with errors
 */
export function validateTemplate(
  template: unknown,
  dataKeys: string[]
): ValidationResult {
  const errors: ValidationError[] = [];

  // Stage 1: Schema validation
  const valid = validateSchema(template);

  if (!valid && validateSchema.errors) {
    for (const error of validateSchema.errors) {
      const path = error.instancePath.replace(/^\//, '').replace(/\//g, '.') || 'root';

      let message = error.message || 'Invalid value';
      let suggestion: string | undefined;

      // Enhance error messages
      if (error.keyword === 'enum') {
        const allowedValues = error.params.allowedValues as string[];
        suggestion = `Valid values: ${allowedValues.join(', ')}`;
      } else if (error.keyword === 'required') {
        const missingProp = error.params.missingProperty as string;
        message = `Missing required property: ${missingProp}`;
      } else if (error.keyword === 'additionalProperties') {
        const extraProp = error.params.additionalProperty as string;
        message = `Unknown property: ${extraProp}`;
        suggestion = 'Remove this property or check spelling';
      }

      errors.push({ path, message, suggestion });
    }

    return { valid: false, errors };
  }

  // Stage 2: Semantic validation (key existence)
  const typedTemplate = template as FragmentTemplate;

  for (let sectionIndex = 0; sectionIndex < typedTemplate.sections.length; sectionIndex++) {
    const section = typedTemplate.sections[sectionIndex];
    const sectionPath = `sections[${sectionIndex}]`;

    // Validate table sections
    if (section.layout === 'table') {
      if (!section.columns || section.columns.length === 0) {
        errors.push({
          path: `${sectionPath}.columns`,
          message: 'Table layout requires columns array',
          suggestion: 'Add columns: [{ header: "...", key: "..." }]'
        });
      }
      if (!section.dataKey) {
        errors.push({
          path: `${sectionPath}.dataKey`,
          message: 'Table layout requires dataKey to reference the data array',
          suggestion: 'Add dataKey: "yourArrayKey"'
        });
      } else if (!dataKeys.includes(section.dataKey)) {
        const closest = findClosestKey(section.dataKey, dataKeys);
        errors.push({
          path: `${sectionPath}.dataKey`,
          message: `Unknown dataKey '${section.dataKey}'`,
          suggestion: closest ? `Did you mean '${closest}'?` : undefined
        });
      }
      // Skip field validation for table sections
      continue;
    }

    // Validate non-table sections have fields
    if (!section.fields || section.fields.length === 0) {
      errors.push({
        path: `${sectionPath}.fields`,
        message: 'Non-table sections require fields array',
        suggestion: 'Add fields: [{ label: "...", key: "..." }]'
      });
      continue;
    }

    for (let fieldIndex = 0; fieldIndex < section.fields.length; fieldIndex++) {
      const field = section.fields[fieldIndex];
      const path = `${sectionPath}.fields[${fieldIndex}]`;

      // Check if key exists in data
      if (!dataKeys.includes(field.key)) {
        const closest = findClosestKey(field.key, dataKeys);
        errors.push({
          path: `${path}.key`,
          message: `Unknown key '${field.key}'`,
          suggestion: closest ? `Did you mean '${closest}'?` : undefined
        });
      }

      // Check format compatibility (basic type checking)
      if (field.format) {
        const formatErrors = validateFormatCompatibility(field, path);
        errors.push(...formatErrors);
      }

      // Check select options
      if (field.inputType === 'select' && (!field.options || field.options.length === 0)) {
        errors.push({
          path: `${path}.options`,
          message: 'Select input type requires options array',
          suggestion: 'Add options: [{ label: "...", value: "..." }]'
        });
      }

      // Check min/max for number inputs
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        errors.push({
          path: `${path}.min`,
          message: `min (${field.min}) cannot be greater than max (${field.max})`,
          suggestion: 'Swap min and max values'
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate format compatibility
 */
function validateFormatCompatibility(
  field: { format?: string; inputType?: string; decimals?: number; currency?: string },
  path: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check decimals is only used with number/currency/percent
  if (field.decimals !== undefined) {
    const validFormats = ['number', 'currency', 'percent'];
    if (field.format && !validFormats.includes(field.format)) {
      errors.push({
        path: `${path}.decimals`,
        message: `'decimals' only applies to number, currency, or percent formats`,
        suggestion: `Remove 'decimals' or change format to one of: ${validFormats.join(', ')}`
      });
    }
  }

  // Check currency is only used with currency format
  if (field.currency !== undefined && field.format !== 'currency') {
    errors.push({
      path: `${path}.currency`,
      message: `'currency' only applies to currency format`,
      suggestion: `Set format: 'currency' or remove 'currency' property`
    });
  }

  // Check inputType compatibility with format
  if (field.inputType && field.format) {
    const compatMap: Record<string, string[]> = {
      text: ['text'],
      number: ['number', 'text'],
      currency: ['number', 'text'],
      percent: ['number', 'text'],
      date: ['date', 'text'],
      boolean: ['checkbox']
    };

    const validInputs = compatMap[field.format];
    if (validInputs && !validInputs.includes(field.inputType)) {
      errors.push({
        path: `${path}.inputType`,
        message: `inputType '${field.inputType}' is not compatible with format '${field.format}'`,
        suggestion: `Use one of: ${validInputs.join(', ')}`
      });
    }
  }

  return errors;
}

/**
 * Parse and validate a JSON string as a template
 * @param jsonString - JSON string to parse
 * @param dataKeys - Available data keys
 * @returns Validation result with parsed template if valid
 */
export function parseAndValidateTemplate(
  jsonString: string,
  dataKeys: string[]
): ValidationResult & { template?: FragmentTemplate } {
  // Try to parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return {
      valid: false,
      errors: [{
        path: 'root',
        message: `JSON parse error: ${message}`,
        suggestion: 'Check JSON syntax (missing quotes, commas, brackets)'
      }]
    };
  }

  // Validate the parsed template
  const result = validateTemplate(parsed, dataKeys);

  if (result.valid) {
    return {
      ...result,
      template: parsed as FragmentTemplate
    };
  }

  return result;
}
