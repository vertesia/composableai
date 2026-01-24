/**
 * ValidateFusionFragmentTool
 * Validation tool for fusion-fragment templates
 *
 * Models call this tool to validate a template before rendering.
 * Returns errors OR a visual preview (text description for server-side).
 */

import type {
  Tool,
  ToolExecutionPayload,
  ToolExecutionContext,
  ToolExecutionResult,
} from '@vertesia/tools-sdk';
import type { ValidateFusionFragmentInput, FragmentTemplate } from '../types.js';
import { validateTemplate } from '../validation/validateTemplate.js';
import { formatValidationErrors, formatAvailableKeys } from '../validation/formatErrors.js';
import { generateTextPreview } from '../render/textPreview.js';

/**
 * Input schema for the validate_fusion_fragment tool
 */
const inputSchema = {
  type: 'object' as const,
  properties: {
    template: {
      type: 'object' as const,
      description: 'The fusion-fragment template to validate. Must have a "sections" array with field definitions.',
    },
    dataKeys: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'List of available data keys that can be used in field.key (e.g., ["firmName", "fundName", "vintageYear"])',
    },
    sampleData: {
      type: 'object' as const,
      description: 'Optional sample data for preview rendering. If not provided, placeholder values will be generated.',
    },
    preview: {
      type: 'string' as const,
      enum: ['text', 'none'] as const,
      description: 'Preview mode: "text" returns a text description, "none" validates only (default: "text")',
    },
  },
  required: ['template', 'dataKeys'] as const,
};

/**
 * Run the validation tool
 */
async function run(
  payload: ToolExecutionPayload<ValidateFusionFragmentInput>,
  _context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const input = payload.tool_use.tool_input;

  if (!input) {
    return {
      is_error: true,
      content: 'Missing required input. Please provide template and dataKeys.',
    };
  }

  const { template, dataKeys, preview = 'text' } = input;

  // Validate the template
  const result = validateTemplate(template, dataKeys);

  // Return errors if validation failed
  if (!result.valid) {
    const errorMessage = formatValidationErrors(result.errors);
    const keysInfo = formatAvailableKeys(dataKeys);

    return {
      is_error: true,
      content: `${errorMessage}\n\n${keysInfo}`,
    };
  }

  // Validation passed
  const typedTemplate = template as FragmentTemplate;

  // No preview requested
  if (preview === 'none') {
    const fieldCount = typedTemplate.sections.reduce(
      (sum, s) => sum + (s.fields?.length || 0) + (s.columns?.length || 0),
      0
    );
    return {
      is_error: false,
      content: `Template valid. ${typedTemplate.sections.length} section(s), ${fieldCount} field(s)/column(s).`,
    };
  }

  // Text preview (server-side compatible)
  const previewText = generateTextPreview(typedTemplate, dataKeys);

  return {
    is_error: false,
    content: `Template validated successfully.\n\n${previewText}`,
  };
}

/**
 * ValidateFusionFragmentTool
 *
 * A tool for validating fusion-fragment templates before rendering.
 * Models should call this tool to check their template for errors
 * and get a preview of what it will look like.
 *
 * @example Tool call:
 * ```json
 * {
 *   "template": {
 *     "title": "Fund Parameters",
 *     "sections": [{
 *       "title": "Identity",
 *       "layout": "grid-3",
 *       "fields": [
 *         { "label": "Firm Name", "key": "firmName" },
 *         { "label": "Vintage", "key": "vintageYear", "format": "number" }
 *       ]
 *     }]
 *   },
 *   "dataKeys": ["firmName", "fundName", "vintageYear", "targetSize"],
 *   "preview": "text"
 * }
 * ```
 */
export const ValidateFusionFragmentTool: Tool<ValidateFusionFragmentInput> = {
  name: 'validate_fusion_fragment',
  description: `Validates a fusion-fragment template and returns errors or a preview.

Use this tool to check your fusion-fragment template before outputting it. The tool will:
1. Validate the template structure (required fields, valid property values)
2. Check that all field.key values exist in the provided dataKeys
3. Suggest corrections for typos (fuzzy matching)
4. Return a text preview of the template structure

Template structure:
- sections: Array of section objects (required)
- title: Optional string title
- footer: Optional footer text

Section structure:
- title: Section header (required)
- layout: "grid-2", "grid-3", "grid-4", or "list" (default: "grid-3")
- collapsed: Boolean for initial state
- fields: Array of field objects (required)

Field structure:
- label: Display label (required)
- key: Data key to look up (required, must exist in dataKeys)
- format: "text", "number", "currency", "percent", "date", "boolean"
- unit: Unit string to display after value
- editable: Boolean to allow editing
- highlight: "success", "warning", "error", "info"
- tooltip: Hover tooltip text
- decimals: Number of decimal places (for number/currency/percent)
- currency: Currency code (for currency format)`,
  input_schema: inputSchema,
  run,
  default: true, // Available by default
};
