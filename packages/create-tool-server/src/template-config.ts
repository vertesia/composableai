/**
 * Template configuration types and reading
 */
import fs from 'fs';
import path from 'path';
import { config } from './configuration.js';

/**
 * Template configuration loaded from template.config.json
 *
 * This configuration defines how the template installer should:
 * - Prompt users for configuration values
 * - Replace variables in template files
 * - Conditionally remove files based on user choices
 * - Clean up template-specific files after installation
 *
 * @see TEMPLATE_CONFIG.md for detailed documentation
 */
export interface TemplateConfig {
  /** Configuration format version (currently "1.0") */
  version: string;

  /** Optional human-readable description of the template */
  description?: string;

  /** Array of prompts to ask the user during installation */
  prompts: PromptConfig[];

  /** Array of file paths where {{VARIABLE}} replacement should occur */
  files: string[];

  /** Optional array of file paths to remove after installation (e.g., template.config.json) */
  removeAfterInstall?: string[];

  /**
   * Optional conditional file removal based on user answers
   * Format: { "VARIABLE_NAME": { "value": ["files", "to", "remove"] } }
   * Example: { "USE_TYPESCRIPT": { "false": ["tsconfig.json"] } }
   */
  conditionalRemove?: Record<string, Record<string, string[]>>;

  /**
   * Optional derived variables computed from user answers
   * Format: { "NEW_VAR": { "from": "SOURCE_VAR", "transform": "pascalCase" } }
   * Supported transforms: "pascalCase", "camelCase", "kebabCase", "snakeCase", "titleCase", "upperCase", "lowerCase"
   * Example: { "ComponentName": { "from": "PROJECT_NAME", "transform": "pascalCase" } }
   */
  derived?: Record<string, DerivedVariable>;
}

/**
 * Configuration for a derived variable computed from user input
 */
export interface DerivedVariable {
  /** Source variable name to derive from */
  from: string;

  /** Transformation to apply: "pascalCase", "camelCase", "kebabCase", "snakeCase", "titleCase", "upperCase", "lowerCase" */
  transform: string;
}

/**
 * Configuration for a single prompt shown to the user
 *
 * The user's answer is stored using the 'name' field and can be used
 * to replace {{name}} placeholders in template files.
 */
export interface PromptConfig {
  /** Prompt type: "text", "number", "confirm", "select", or "multiselect" */
  type: string;

  /** Variable name used for replacement (use {{name}} in template files) */
  name: string;

  /** Question text shown to the user */
  message: string;

  /**
   * Optional default value
   * Can include ${PROJECT_NAME} which will be replaced with the user's project name
   * Example: "initial": "@myorg/${PROJECT_NAME}"
   */
  initial?: string | number | boolean;

  /**
   * Optional validation function as string
   * Should return true if valid, or error message string if invalid
   * Example: "(value) => value.length > 0 || 'Required field'"
   */
  validate?: string;

  /**
   * Optional format function as string to transform the value before saving
   * Example: "(value) => value.toLowerCase()"
   */
  format?: string;

  /**
   * Optional skip condition as string
   * Should return true to skip this prompt based on previous answers
   * Example: "(prev) => !prev.USE_TYPESCRIPT"
   */
  skip?: string;
}

/**
 * Read template.config.json from the downloaded template
 */
export function readTemplateConfig(projectName: string): TemplateConfig {
  const configPath = path.join(projectName, config.templateConfigFile);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Template configuration file not found: ${config.templateConfigFile}`);
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse template configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
