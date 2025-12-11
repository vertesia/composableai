/**
 * User prompts for configuration
 */
import prompts from 'prompts';
import chalk from 'chalk';
import { TemplateConfig } from './template-config.js';

/**
 * Prompt user for configuration values
 */
export async function promptUser(projectName: string, templateConfig: TemplateConfig): Promise<Record<string, any>> {
  console.log(chalk.blue('⚙️  Configure your project:\n'));

  // Process prompts - replace ${PROJECT_NAME} and other variables in initial values
  const processedPrompts = templateConfig.prompts.map(p => {
    const prompt: any = { ...p };

    // Override PROJECT_NAME initial value with the directory name
    if (prompt.name === 'PROJECT_NAME') {
      prompt.initial = projectName;
    }

    // Replace ${PROJECT_NAME} in initial values
    if (typeof prompt.initial === 'string') {
      prompt.initial = prompt.initial.replace(/\$\{PROJECT_NAME\}/g, projectName);
    }

    return prompt;
  });

  const answers = await prompts(processedPrompts, {
    onCancel: () => {
      throw new Error('Installation cancelled by user');
    }
  });

  // Check if all prompts were answered
  if (Object.keys(answers).length !== processedPrompts.length) {
    throw new Error('Installation cancelled');
  }

  console.log(); // Empty line after prompts
  return answers;
}
