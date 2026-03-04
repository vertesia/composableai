#!/usr/bin/env node

/**
 * @vertesia/create-tool-server
 *
 * CLI tool to create Vertesia tool server projects from GitHub templates.
 * Reads template.config.json from the template to determine prompts and file replacements.
 */

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import { config, validation } from './configuration.js';
import { downloadTemplate } from './download-template.js';
import { installDependencies, selectPackageManager } from './package-manager.js';
import { runPostInstallHooks, runPreInstallHooks } from './post-install.js';
import {
  adjustPackageJson,
  handleConditionalRemoves,
  removeMetaFiles,
  renameFiles,
  replaceVariables
} from './process-template.js';
import { promptUser } from './prompts.js';
import { readTemplateConfig } from './template-config.js';
import { selectTemplate } from './template-selector.js';

/**
 * Main entry point
 */
async function main() {

  const program = new Command()
    .name('create-plugin')
    .description('CLI to create Vertesia plugins: UI plugins or tool servers')
    .argument('<project-name>', 'Name of the project to create')
    .option('-b, --branch <branch>', 'Use a specific template branch')
    .option('-t, --template <name>', 'Template name (skips interactive selection)')
    .option('-y, --yes', 'Non-interactive mode: use defaults for all prompts', false)
    .option('--dev', 'Use workspace dependencies (development mode)', false)
    .option('--local-templates <path>', 'Use local template directory instead of fetching from GitHub')
    .addHelpText('after', `
Available Templates:
${config.templates.map(t => `  - ${t.name}`).join('\n')}

Documentation: ${config.docsUrl}
`)
    .parse();

  const projectName = program.args[0];
  const opts = program.opts<{ branch?: string; template?: string; yes: boolean; dev: boolean; localTemplates?: string }>();
  const { branch, template, yes: nonInteractive, dev, localTemplates } = opts;

  // Validate project name
  if (!validation.projectNamePattern.test(projectName)) {
    console.log(chalk.red(`❌ ${validation.projectNameError}\n`));
    process.exit(1);
  }

  if (validation.reservedNames.includes(projectName)) {
    console.log(chalk.red(`❌ "${projectName}" is a reserved name. Please choose a different name.\n`));
    process.exit(1);
  }

  // Check if directory already exists
  if (fs.existsSync(projectName)) {
    console.log(chalk.red(`❌ Directory "${projectName}" already exists.\n`));
    process.exit(1);
  }

  try {
    // Step 1: Select template (only prompts if multiple templates available)
    const selectedTemplate = await selectTemplate(branch, template);

    // Show the selected template name with branch if specified
    const branchInfo = branch ? chalk.gray(` (branch: ${branch})`) : '';
    console.log(chalk.blue.bold(`\n🚀 Create ${selectedTemplate.name}`) + branchInfo + '\n');

    // Step 2: Download template from GitHub (or copy from local path)
    await downloadTemplate(projectName, selectedTemplate.repository, localTemplates);

    // Step 3: Read template configuration
    const templateConfig = readTemplateConfig(projectName);

    // Step 4: Detect and select package manager (may be forced by template)
    const packageManager = await selectPackageManager(templateConfig.packageManager, nonInteractive);

    // Step 5: Prompt user for configuration
    const answers = await promptUser(projectName, templateConfig, nonInteractive);

    // Step 5: Replace variables in files
    replaceVariables(projectName, templateConfig, answers);

    // Step 6: Adjust package.json (name and workspace dependencies)
    adjustPackageJson(projectName, answers, dev);

    // Step 7: Handle conditional removes
    if (templateConfig.conditionalRemove) {
      handleConditionalRemoves(projectName, templateConfig, answers);
    }

    // Step 8: Rename files (e.g., .env.template -> .env)
    renameFiles(projectName, templateConfig);

    // Step 9: Remove meta files
    removeMetaFiles(projectName, templateConfig);

    // Step 9: Run pre-install hooks (if any) - e.g., CLI authentication for private registries
    let skipDependencyInstall = false;
    if (templateConfig.preInstall) {
      const preInstallSuccess = await runPreInstallHooks(projectName, templateConfig.preInstall, packageManager, nonInteractive);
      if (!preInstallSuccess) {
        console.log(chalk.yellow('⚠️  Pre-install hooks failed. Skipping dependency installation.\n'));
        console.log(chalk.gray('You can install dependencies manually after resolving the issue:\n'));
        console.log(chalk.gray(`  cd ${projectName}`));
        console.log(chalk.gray(`  ${packageManager} install\n`));
        skipDependencyInstall = true;
      }
    }

    // Step 10: Install dependencies
    if (!skipDependencyInstall) {
      await installDependencies(projectName, packageManager);
    }

    // Step 11: Run post-install hooks (if any)
    if (!skipDependencyInstall && templateConfig.postInstall) {
      await runPostInstallHooks(projectName, templateConfig.postInstall, packageManager, nonInteractive);
    }

    // Step 12: Success!
    showSuccess(projectName, packageManager, selectedTemplate.name, selectedTemplate.repository);

  } catch (error) {
    console.log(chalk.red(`\n❌ Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`));

    // Cleanup on failure
    if (fs.existsSync(projectName)) {
      console.log(chalk.gray('Cleaning up...'));
      fs.rmSync(projectName, { recursive: true, force: true });
    }

    process.exit(1);
  }
}

/**
 * Show success message
 */
function showSuccess(projectName: string, packageManager: string, templateName: string, repository: string): void {
  console.log(chalk.green.bold('✅ Project created successfully!\n'));
  console.log(chalk.gray('Next steps:\n'));
  console.log(chalk.cyan(`  cd ${projectName}`));
  console.log(chalk.cyan(`  ${packageManager} dev`));
  console.log();
  console.log(chalk.gray(`Documentation: ${config.docsUrl}`));
  console.log(chalk.gray(`Template: ${templateName}`));
  console.log(chalk.gray(`Repository: ${repository}\n`));
}


// Run the installer
main().catch((error) => {
  console.error(chalk.red(`\n❌ Fatal error: ${error.message}\n`));
  process.exit(1);
});