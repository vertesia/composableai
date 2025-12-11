/**
 * Configuration for @vertesia/create-tools
 *
 * This file centralizes all configuration values for the installer.
 * Update these values to point to your template repository and customize behavior.
 */

export const config = {
  /**
   * GitHub repository for the template
   * Format: 'owner/repo' or 'owner/repo#branch' or 'owner/repo#tag'
   *
   * Examples:
   * - 'vertesiahq/tool-server-template'
   * - 'vertesiahq/tool-server-template#main'
   * - 'vertesiahq/tool-server-template#v1.0.0'
   */
  templateRepo: 'vertesiahq/tool-server-template',

  /**
   * Name of the template configuration file in the template repo
   * This file should contain prompts and installation instructions
   */
  templateConfigFile: 'template.config.json',

  /**
   * Default branch to use if not specified in templateRepo
   */
  defaultBranch: 'main',

  /**
   * Package manager to use for installing dependencies
   * Options: 'npm' | 'pnpm' | 'yarn'
   */
  packageManager: 'pnpm',

  /**
   * Whether to use cache for degit downloads
   * Set to true for faster repeated installs (dev mode)
   * Set to false to always get latest template (production)
   */
  useCache: false,

  /**
   * Timeout for downloading template (milliseconds)
   */
  downloadTimeout: 30000,

  /**
   * Display name for the tool (used in console output)
   */
  toolName: 'Vertesia Tool Server',

  /**
   * Documentation URL to show in help messages
   */
  docsUrl: 'https://docs.vertesia.com/tools',

  /**
   * GitHub URL for the template (for display purposes)
   */
  templateUrl: 'https://github.com/vertesiahq/tool-server-template',
} as const;

/**
 * Validation rules for project names
 */
export const validation = {
  /**
   * Regex for valid project names
   * Allows: lowercase letters, numbers, hyphens
   */
  projectNamePattern: /^[a-z0-9-]+$/,

  /**
   * Error message for invalid project names
   */
  projectNameError: 'Project name can only contain lowercase letters, numbers, and hyphens',

  /**
   * Reserved project names that cannot be used
   */
  reservedNames: [
    'test',
    'node_modules',
    'dist',
    'build',
  ] as string[],
} as const;
