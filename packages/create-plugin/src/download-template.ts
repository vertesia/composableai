/**
 * Template downloading from GitHub or local copy
 */
import degit from 'degit';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { config } from './configuration.js';

/**
 * Extract the template directory name from a repository string.
 * e.g. "vertesia/composableai/templates/plugin-template#main" → "plugin-template"
 */
function extractTemplateDirName(repository: string): string {
  // Strip the #ref suffix if present
  const repoPath = repository.split('#')[0];
  // Last segment is the template directory name
  return repoPath.split('/').pop()!;
}

/**
 * Download template from GitHub using degit, or copy from a local directory.
 *
 * @param projectName - Target project directory name
 * @param repository - Repository string (e.g. "owner/repo/path#ref")
 * @param localTemplatesPath - When set, copy from this local path instead of fetching from GitHub
 */
export async function downloadTemplate(
  projectName: string,
  repository: string,
  localTemplatesPath?: string
): Promise<void> {
  if (localTemplatesPath) {
    const templateDir = extractTemplateDirName(repository);
    const sourcePath = path.resolve(localTemplatesPath, templateDir);

    console.log(chalk.blue('📦 Copying template from local directory...\n'));
    console.log(chalk.gray(`   Source: ${sourcePath}`));
    console.log(chalk.gray(`   Target: ./${projectName}\n`));

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Local template directory not found: ${sourcePath}`);
    }

    fs.cpSync(sourcePath, projectName, { recursive: true });
    console.log(chalk.green('   ✓ Template copied\n'));
    return;
  }

  console.log(chalk.blue('📦 Downloading template from GitHub...\n'));
  console.log(chalk.gray(`   Repository: ${repository}`));
  console.log(chalk.gray(`   Target: ./${projectName}\n`));

  const emitter = degit(repository, {
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
