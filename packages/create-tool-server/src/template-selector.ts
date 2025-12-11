/**
 * Template selection when multiple templates are available
 */
import prompts from 'prompts';
import chalk from 'chalk';
import { config, TemplateDefinition } from './configuration.js';

/**
 * Select a template (only prompts if multiple templates are available)
 * Returns the selected template definition
 */
export async function selectTemplate(): Promise<TemplateDefinition> {
  const templates = config.templates;

  // If only one template, return it directly
  if (templates.length === 1) {
    return templates[0];
  }

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
  return templates[response.template];
}
