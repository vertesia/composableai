#!/usr/bin/env node

/**
 * @vertesia/create-tool-server
 *
 * CLI tool to create Vertesia tool server projects from GitHub templates.
 * Reads template.config.json from the template to determine prompts and file replacements.
 */

import chalk from 'chalk';
import fs from 'fs';
import { config, validation } from './configuration.js';
import { selectTemplate } from './template-selector.js';
import { selectPackageManager, installDependencies } from './package-manager.js';
import { downloadTemplate } from './download-template.js';
import { readTemplateConfig } from './template-config.js';
import { promptUser } from './prompts.js';
import {
  replaceVariables,
  adjustPackageJson,
  handleConditionalRemoves,
  removeMetaFiles
} from './process-template.js';
import { runPreInstallHooks, runPostInstallHooks } from './post-install.js';

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): { projectName: string; branch?: string } {
  let projectName: string | undefined;
  let branch: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-b' || arg === '--branch') {
      branch = args[i + 1];
      i++; // Skip next arg
    } else if (!arg.startsWith('-')) {
      projectName = arg;
    }
  }

  if (!projectName) {
    throw new Error('Project name is required');
  }

  return { projectName, branch };
}

/**
 * Main entry point
 */
async function main() {

  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Parse arguments
  let projectName: string;
  let branch: string | undefined;

  try {
    const parsed = parseArgs(args);
    projectName = parsed.projectName;
    branch = parsed.branch;
  } catch (error) {
    console.log(chalk.red('❌ Please specify a project name:\n'));
    console.log(chalk.white('Usage:'));
    console.log(chalk.cyan('  npx @vertesia/create-plugin') + chalk.gray(' <project-name> [options]\n'));
    console.log(chalk.white('Example:'));
    console.log(chalk.gray('  npx @vertesia/create-plugin my-project\n'));
    console.log(chalk.white('Options:'));
    console.log(chalk.gray('  -b, --branch <branch>  Use specific branch'));
    console.log(chalk.gray('  -h, --help             Show help\n'));
    process.exit(1);
  }

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
    const selectedTemplate = await selectTemplate(branch);

    // Show the selected template name with branch if specified
    const branchInfo = branch ? chalk.gray(` (branch: ${branch})`) : '';
    console.log(chalk.blue.bold(`\n🚀 Create ${selectedTemplate.name}`) + branchInfo + '\n');

    // Step 2: Download template from GitHub
    await downloadTemplate(projectName, selectedTemplate.repository);

    // Step 3: Read template configuration
    const templateConfig = readTemplateConfig(projectName);

    // Step 4: Detect and select package manager (may be forced by template)
    const packageManager = await selectPackageManager(templateConfig.packageManager);

    // Step 5: Prompt user for configuration
    const answers = await promptUser(projectName, templateConfig);

    // Step 5: Replace variables in files
    replaceVariables(projectName, templateConfig, answers);

    // Step 6: Adjust package.json (name and workspace dependencies)
    adjustPackageJson(projectName, answers);

    // Step 7: Handle conditional removes
    if (templateConfig.conditionalRemove) {
      handleConditionalRemoves(projectName, templateConfig, answers);
    }

    // Step 8: Remove meta files
    removeMetaFiles(projectName, templateConfig);

    // Step 9: Run pre-install hooks (if any) - e.g., CLI authentication for private registries
    let skipDependencyInstall = false;
    if (templateConfig.preInstall) {
      const preInstallSuccess = await runPreInstallHooks(projectName, templateConfig.preInstall, packageManager);
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
      await runPostInstallHooks(projectName, templateConfig.postInstall, packageManager);
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

/**
 * Show help message
 */
function showHelp(): void {
  console.log(chalk.blue.bold('\nVertesia Project Generator\n'));
  console.log('Usage:');
  console.log(chalk.gray('  pnpm create @vertesia/tool-server <project-name> [options]'));
  console.log(chalk.gray('  npm create @vertesia/tool-server <project-name> [options]'));
  console.log(chalk.gray('  npx @vertesia/create-tool-server <project-name> [options]\n'));
  console.log('Options:');
  console.log(chalk.gray('  -h, --help              Show this help message'));
  console.log(chalk.gray('  -b, --branch <branch>   Use specific branch (default: configured branch or main)\n'));
  console.log('Examples:');
  console.log(chalk.gray('  pnpm create @vertesia/tool-server my-tool-server'));
  console.log(chalk.gray('  npm create @vertesia/tool-server my-api-tools -b develop'));
  console.log(chalk.gray('  npx @vertesia/create-tool-server my-project --branch v1.0.0\n'));

  console.log('Available Templates:');
  config.templates.forEach(template => {
    console.log(chalk.gray(`  - ${template.name}`));
  });
  console.log();

  console.log(`Documentation: ${chalk.cyan(config.docsUrl)}\n`);
}

// Run the installer
main().catch((error) => {
  console.error(chalk.red(`\n❌ Fatal error: ${error.message}\n`));
  process.exit(1);
});
