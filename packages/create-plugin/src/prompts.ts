/**
 * User prompts for configuration
 */
import prompts from 'prompts';
import chalk from 'chalk';
import { TemplateConfig } from './template-config.js';
import { applyTransform, concatValues } from './transforms.js';

/**
 * Prompt user for configuration values
 * @param nonInteractive - If true, skip prompts and use default/initial values
 */
export async function promptUser(projectName: string, templateConfig: TemplateConfig, nonInteractive = false): Promise<Record<string, any>> {
  if (!templateConfig.prompts) {
    return {};
  }

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

    // Convert validate string to function
    // Can be either a regex pattern (e.g., "^[a-z]+$") or a function string (e.g., "(v) => v.length > 0")
    if (typeof prompt.validate === 'string') {
      const validateStr = prompt.validate;
      if (validateStr.includes('=>') || validateStr.includes('function')) {
        // It's a function string - evaluate it
        try {
          prompt.validate = eval(validateStr);
        } catch {
          // If eval fails, remove the validator
          delete prompt.validate;
        }
      } else {
        // It's a regex pattern
        try {
          const regex = new RegExp(validateStr);
          prompt.validate = (value: string) => regex.test(value) || `Must match pattern: ${validateStr}`;
        } catch {
          // If regex is invalid, remove the validator
          delete prompt.validate;
        }
      }
    }

    return prompt;
  });

  let answers: Record<string, any>;

  if (nonInteractive) {
    // Use default/initial values for all prompts
    console.log(chalk.gray('Using default values (non-interactive mode)\n'));
    answers = {};
    for (const prompt of processedPrompts) {
      if (prompt.type === 'confirm') {
        answers[prompt.name] = prompt.initial ?? true;
      } else if (prompt.type === 'select' && prompt.choices) {
        // Use the initial index or first choice
        const idx = typeof prompt.initial === 'number' ? prompt.initial : 0;
        answers[prompt.name] = prompt.choices[idx]?.value ?? prompt.choices[0]?.value;
      } else {
        answers[prompt.name] = prompt.initial ?? '';
      }
    }
  } else {
    console.log(chalk.blue('⚙️  Configure your project:\n'));

    answers = await prompts(processedPrompts, {
      onCancel: () => {
        throw new Error('Installation cancelled by user');
      }
    });

    // Check if all prompts were answered
    if (Object.keys(answers).length !== processedPrompts.length) {
      throw new Error('Installation cancelled');
    }
  }

  // Process derived variables
  if (templateConfig.derived) {
    for (const [targetName, derivedConfig] of Object.entries(templateConfig.derived)) {
      try {
        if (derivedConfig.transform === 'concat') {
          // Handle concat transform with multiple source fields
          const sourceFields = Array.isArray(derivedConfig.from) ? derivedConfig.from : [derivedConfig.from];
          const values = sourceFields.map(field => {
            const value = answers[field];
            if (value === undefined) {
              throw new Error(`Source field "${field}" not found in answers`);
            }
            return String(value);
          });
          answers[targetName] = concatValues(values, derivedConfig.separator || '');
        } else {
          // Handle single-source transforms
          const sourceField = Array.isArray(derivedConfig.from) ? derivedConfig.from[0] : derivedConfig.from;
          const sourceValue = answers[sourceField];
          if (sourceValue !== undefined) {
            answers[targetName] = applyTransform(String(sourceValue), derivedConfig.transform);
          }
        }
      } catch (error) {
        const fromStr = Array.isArray(derivedConfig.from) ? derivedConfig.from.join(', ') : derivedConfig.from;
        throw new Error(`Failed to derive ${targetName} from ${fromStr}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  console.log(); // Empty line after prompts
  return answers;
}
