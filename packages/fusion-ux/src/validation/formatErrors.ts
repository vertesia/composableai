/**
 * Error formatting utilities for model-friendly output
 */

import type { ValidationError } from '../types.js';

/**
 * Format validation errors as a model-friendly string
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'Template is valid.';
  }

  const header = `Template validation failed with ${errors.length} error${errors.length > 1 ? 's' : ''}:\n`;

  const formattedErrors = errors.map((error, index) => {
    let message = `${index + 1}. ${error.message}`;
    message += `\n   Path: ${error.path}`;
    if (error.suggestion) {
      message += `\n   \u2192 ${error.suggestion}`;
    }
    return message;
  });

  return header + '\n' + formattedErrors.join('\n\n');
}

/**
 * Format a successful validation with preview info
 * @param template - The validated template
 * @param dataKeys - Available data keys
 * @returns Success message with preview
 */
export function formatValidationSuccess(
  template: { title?: string; sections: Array<{ title: string; fields: Array<{ label: string; key: string; format?: string }> }> },
  dataKeys: string[]
): string {
  const lines: string[] = ['Template valid. Preview:'];
  lines.push('');

  if (template.title) {
    lines.push(`**${template.title}**`);
    lines.push('');
  }

  for (const section of template.sections) {
    const fieldCount = section.fields.length;
    lines.push(`[${section.title}] ${fieldCount} field${fieldCount > 1 ? 's' : ''}:`);

    for (const field of section.fields) {
      let fieldDesc = `- ${field.label} (${field.key}`;
      if (field.format && field.format !== 'text') {
        fieldDesc += `, ${field.format}`;
      }
      fieldDesc += ')';

      // Check if key exists in data
      if (!dataKeys.includes(field.key)) {
        fieldDesc += ' \u26a0\ufe0f key not in data';
      }

      lines.push(fieldDesc);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format a list of available keys for model reference
 * @param dataKeys - Available data keys
 * @param groupByPrefix - Whether to group keys by common prefix
 * @returns Formatted key list
 */
export function formatAvailableKeys(
  dataKeys: string[],
  groupByPrefix: boolean = true
): string {
  if (dataKeys.length === 0) {
    return 'No data keys available.';
  }

  if (!groupByPrefix || dataKeys.length <= 10) {
    return `Available keys: ${dataKeys.join(', ')}`;
  }

  // Group by prefix (e.g., fund.name, fund.type -> fund.*)
  const groups = new Map<string, string[]>();

  for (const key of dataKeys) {
    const dotIndex = key.indexOf('.');
    if (dotIndex > 0) {
      const prefix = key.substring(0, dotIndex);
      const rest = key.substring(dotIndex + 1);
      const group = groups.get(prefix) || [];
      group.push(rest);
      groups.set(prefix, group);
    } else {
      const group = groups.get('') || [];
      group.push(key);
      groups.set('', group);
    }
  }

  const lines: string[] = ['Available keys:'];

  // Top-level keys first
  const topLevel = groups.get('');
  if (topLevel && topLevel.length > 0) {
    lines.push(`  ${topLevel.join(', ')}`);
  }

  // Grouped keys
  for (const [prefix, keys] of groups) {
    if (prefix === '') continue;
    if (keys.length <= 3) {
      lines.push(`  ${prefix}: ${keys.join(', ')}`);
    } else {
      lines.push(`  ${prefix}: ${keys.slice(0, 3).join(', ')}, ... (${keys.length} total)`);
    }
  }

  return lines.join('\n');
}
