/**
 * User prompts for configuration
 */
import prompts from 'prompts';
import chalk from 'chalk';
import { TemplateConfig } from './template-config.js';
import { applyTransform } from './transforms.js';

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

  // Process derived variables
  if (templateConfig.derived) {
    for (const [targetName, config] of Object.entries(templateConfig.derived)) {
      const sourceValue = answers[config.from];
      if (sourceValue !== undefined) {
        try {
          answers[targetName] = applyTransform(String(sourceValue), config.transform);
        } catch (error) {
          throw new Error(`Failed to derive ${targetName} from ${config.from}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }

  console.log(); // Empty line after prompts
  return answers;
}
