/**
 * Template selection when multiple templates are available
 */
import chalk from 'chalk';
import prompts from 'prompts';
import { config, TemplateDefinition } from './configuration.js';
import { getCliVersion } from './version.js';

/**
 * Resolve the git ref (branch or tag) for template fetching.
 *
 * Priority:
 * 1. Explicit --branch flag from user (override for testing)
 * 2. Release CLI version (no -dev. suffix) → templates@{version} tag
 * 3. Dev/snapshot CLI version → main branch
 */
function resolveTemplateRef(branchOverride?: string): string {
  if (branchOverride) {
    return branchOverride;
  }

  const version = getCliVersion();
  if (!version.includes('-dev.')) {
    return `v${version}`;
  }

  return 'main';
}

/**
 * Select a template (only prompts if multiple templates are available)
 * Returns the selected template definition with the resolved git ref applied
 * @param branchOverride - Optional branch to use instead of the auto-resolved ref
 * @param templateName - Optional template name for non-interactive selection
 */
export async function selectTemplate(branchOverride?: string, templateName?: string): Promise<TemplateDefinition> {
  const templates = config.templates;

  let selectedTemplate: TemplateDefinition;

  if (templateName) {
    // Non-interactive: find template by name (case-insensitive)
    const match = templates.find(t => t.name.toLowerCase() === templateName.toLowerCase());
    if (!match) {
      const available = templates.map(t => `  - ${t.name}`).join('\n');
      throw new Error(`Template "${templateName}" not found. Available templates:\n${available}`);
    }
    selectedTemplate = match;
  } else if (templates.length === 1) {
    // If only one template, return it directly
    selectedTemplate = templates[0];
  } else {
    // Multiple templates - let user choose
    console.log(chalk.blue('📋 Template Selection\n'));

    const response = await prompts({
      type: 'select',
      name: 'template',
      message: 'Which type of project would you like to create?',
      choices: templates.map((template, index) => ({
        title: template.name,
        value: index
      })),
      initial: 0
    }, {
      onCancel: () => {
        throw new Error('Installation cancelled by user');
      }
    });

    console.log();
    selectedTemplate = templates[response.template];
  }

  // Apply resolved git ref (branch or tag)
  const ref = resolveTemplateRef(branchOverride);
  return {
    ...selectedTemplate,
    repository: `${selectedTemplate.repository}#${ref}`
  };
}
