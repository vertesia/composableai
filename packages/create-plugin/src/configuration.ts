/**
 * Configuration for @vertesia/create-tools
 *
 * This file centralizes all configuration values for the installer.
 * Update these values to point to your template repository and customize behavior.
 */

/**
 * Template definition
 */
export interface TemplateDefinition {
  /** Display name for the template (shown to user) */
  name: string;
  /** GitHub repository path */
  repository: string;
}

export const config = {
  /**
   * Available templates
   * Array of template definitions with display names and repository paths
   *
   * Format for repository: 'owner/repo/subdirectory' (without branch/tag suffix)
   * The branch or tag is resolved at runtime based on CLI version and --branch flag.
   */
  templates: [
    {
      name: 'Vertesia Plugin',
      repository: 'vertesia/composableai/templates/plugin-template'
    },
    {
      name: 'Vertesia Tool Server (deprecated)',
      repository: 'vertesia/composableai/templates/tool-server-template'
    },
    {
      name: 'Vertesia UI Plugin (deprecated)',
      repository: 'vertesia/composableai/templates/ui-plugin-template'
    },
    {
      name: 'Vertesia Workflow Worker',
      repository: 'vertesia/composableai/templates/worker-template'
    }
  ] as TemplateDefinition[],

  /**
   * Name of the template configuration file in the template repo
   * This file should contain prompts and installation instructions
   */
  templateConfigFile: 'template.config.json',

  /**
   * Whether to use cache for degit downloads
   * Set to true for faster repeated installs (dev mode)
   * Set to false to always get latest template (production)
   */
  useCache: false,

  /**
   * Documentation URL to show in help messages
   */
  docsUrl: 'https://docs.vertesia.com',
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
