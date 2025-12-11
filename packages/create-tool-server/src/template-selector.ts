/**
 * Template selection when multiple templates are available
 */
import prompts from 'prompts';
import chalk from 'chalk';
import { config, TemplateDefinition } from './configuration.js';

/**
 * Apply branch override to repository URL
 */
function applyBranchOverride(repository: string, branch?: string): string {
  if (!branch) {
    return repository;
  }

  // Remove existing branch/tag if present (after #)
  const baseRepo = repository.split('#')[0];

  // Apply the override branch
  return `${baseRepo}#${branch}`;
}

/**
 * Select a template (only prompts if multiple templates are available)
 * Returns the selected template definition with branch override applied if provided
 */
export async function selectTemplate(branchOverride?: string): Promise<TemplateDefinition> {
  const templates = config.templates;

  let selectedTemplate: TemplateDefinition;

  // If only one template, return it directly
  if (templates.length === 1) {
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

  // Apply branch override if provided
  return {
    ...selectedTemplate,
    repository: applyBranchOverride(selectedTemplate.repository, branchOverride)
  };
}
