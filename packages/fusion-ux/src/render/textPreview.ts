/**
 * Text preview generation for non-vision models
 * Generates a text description of what the fragment will look like
 */

import type { FragmentTemplate, FieldTemplate } from '../types.js';

/**
 * Generate sample data for preview rendering
 * Creates placeholder values based on field definitions
 */
export function generateSampleData(
  template: FragmentTemplate,
  dataKeys: string[]
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  // Add provided data keys with placeholder values
  for (const key of dataKeys) {
    data[key] = `<${key}>`;
  }

  // Override with more specific placeholders based on field format
  for (const section of template.sections) {
    if (section.fields) {
      for (const field of section.fields) {
        if (field.key in data) {
          data[field.key] = getSampleValue(field);
        }
      }
    }
  }

  return data;
}

/**
 * Get a sample value for a field based on its format
 */
function getSampleValue(field: FieldTemplate): unknown {
  switch (field.format) {
    case 'number':
      return 1234;
    case 'currency':
      return 1000000;
    case 'percent':
      return 25;
    case 'date':
      return new Date().toISOString().split('T')[0];
    case 'boolean':
      return true;
    case 'text':
    default:
      return `Sample ${field.label}`;
  }
}

/**
 * Generate a text description of the template for preview
 * Used for non-vision models
 */
export function generateTextPreview(
  template: FragmentTemplate,
  dataKeys: string[]
): string {
  const lines: string[] = [];

  lines.push('Template structure preview:');
  lines.push('');

  if (template.title) {
    lines.push(`## ${template.title}`);
    lines.push('');
  }

  for (const section of template.sections) {
    const layout = section.layout || 'grid-3';

    lines.push(`### ${section.title}`);

    if (layout === 'table') {
      lines.push(`Layout: table`);
      if (section.dataKey) {
        lines.push(`Data key: \`${section.dataKey}\``);
      }
      lines.push('');

      if (section.columns) {
        lines.push('Columns:');
        for (const col of section.columns) {
          let colLine = `- **${col.header}** \u2192 \`${col.key}\``;
          if (col.format && col.format !== 'text') {
            colLine += ` (${col.format})`;
          }
          lines.push(colLine);
        }
      }
    } else {
      const layoutDesc = layout === 'list' ? 'vertical list' : `${layout.split('-')[1]}-column grid`;
      lines.push(`Layout: ${layoutDesc}${section.collapsed ? ' (collapsed by default)' : ''}`);
      lines.push('');

      if (section.fields) {
        for (const field of section.fields) {
          let fieldLine = `- **${field.label}** \u2192 \`${field.key}\``;

          const attributes: string[] = [];
          if (field.format && field.format !== 'text') {
            attributes.push(field.format);
          }
          if (field.unit) {
            attributes.push(`unit: "${field.unit}"`);
          }
          if (field.editable) {
            attributes.push('editable');
          }
          if (field.highlight) {
            attributes.push(`highlight: ${field.highlight}`);
          }

          if (attributes.length > 0) {
            fieldLine += ` (${attributes.join(', ')})`;
          }

          // Check if key exists in data
          if (!dataKeys.includes(field.key)) {
            fieldLine += ' \u26a0\ufe0f **key not found in data**';
          }

          lines.push(fieldLine);
        }
      }
    }

    lines.push('');
  }

  if (template.footer) {
    lines.push('---');
    lines.push(`Footer: ${template.footer}`);
    lines.push('');
  }

  // Summary
  const totalFields = template.sections.reduce(
    (sum, s) => sum + (s.fields?.length || 0) + (s.columns?.length || 0),
    0
  );
  const missingKeys = template.sections
    .flatMap(s => s.fields || [])
    .filter(f => !dataKeys.includes(f.key))
    .map(f => f.key);

  lines.push('---');
  lines.push(`Summary: ${template.sections.length} section(s), ${totalFields} field(s)/column(s)`);

  if (missingKeys.length > 0) {
    lines.push(`\u26a0\ufe0f Missing keys: ${missingKeys.join(', ')}`);
  } else {
    lines.push('\u2705 All field keys found in data');
  }

  return lines.join('\n');
}

/**
 * Generate a compact description for tool responses
 */
export function generateCompactPreview(template: FragmentTemplate): string {
  const sections = template.sections.map(s => {
    if (s.layout === 'table' && s.columns) {
      const colList = s.columns
        .slice(0, 3)
        .map(c => c.header)
        .join(', ');
      const more = s.columns.length > 3 ? `, +${s.columns.length - 3} more` : '';
      return `${s.title} (table): ${colList}${more}`;
    }

    if (s.fields) {
      const fieldList = s.fields
        .slice(0, 3)
        .map(f => f.label)
        .join(', ');
      const more = s.fields.length > 3 ? `, +${s.fields.length - 3} more` : '';
      return `${s.title}: ${fieldList}${more}`;
    }

    return s.title;
  });

  const title = template.title ? `"${template.title}" - ` : '';
  return `${title}${sections.join(' | ')}`;
}
