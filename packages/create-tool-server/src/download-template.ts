/**
 * Template downloading from GitHub
 */
import degit from 'degit';
import chalk from 'chalk';
import { config } from './configuration.js';

/**
 * Download template from GitHub using degit
 */
export async function downloadTemplate(projectName: string): Promise<void> {
  console.log(chalk.blue('📦 Downloading template from GitHub...\n'));
  console.log(chalk.gray(`   Repository: ${config.templateRepo}`));
  console.log(chalk.gray(`   Target: ./${projectName}\n`));

  const emitter = degit(config.templateRepo, {
    cache: config.useCache,
    force: true,
  });

  // Show download progress
  emitter.on('info', (info) => {
    console.log(chalk.gray(`   ${info.message}`));
  });

  emitter.on('warn', (warning) => {
    console.log(chalk.yellow(`   ⚠️  ${warning.message}`));
  });

  try {
    await emitter.clone(projectName);
    console.log(chalk.green('   ✓ Template downloaded\n'));
  } catch (error) {
    throw new Error(`Failed to download template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
