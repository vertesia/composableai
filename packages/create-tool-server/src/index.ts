#!/usr/bin/env node

/**
 * @vertesia/create-tool-server
 *
 * CLI tool to create Vertesia tool server projects from GitHub templates.
 * Reads template.config.json from the template to determine prompts and file replacements.
 */

import degit from 'degit';
import prompts from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { config, validation } from './configuration.js';

/**
 * Template configuration loaded from template.config.json
 *
 * This configuration defines how the template installer should:
 * - Prompt users for configuration values
 * - Replace variables in template files
 * - Conditionally remove files based on user choices
 * - Clean up template-specific files after installation
 *
 * @see TEMPLATE_CONFIG.md for detailed documentation
 */
interface TemplateConfig {
  /** Configuration format version (currently "1.0") */
  version: string;

  /** Optional human-readable description of the template */
  description?: string;

  /** Array of prompts to ask the user during installation */
  prompts: PromptConfig[];

  /** Array of file paths where {{VARIABLE}} replacement should occur */
  files: string[];

  /** Optional array of file paths to remove after installation (e.g., template.config.json) */
  removeAfterInstall?: string[];

  /**
   * Optional conditional file removal based on user answers
   * Format: { "VARIABLE_NAME": { "value": ["files", "to", "remove"] } }
   * Example: { "USE_TYPESCRIPT": { "false": ["tsconfig.json"] } }
   */
  conditionalRemove?: Record<string, Record<string, string[]>>;
}

/**
 * Configuration for a single prompt shown to the user
 *
 * The user's answer is stored using the 'name' field and can be used
 * to replace {{name}} placeholders in template files.
 */
interface PromptConfig {
  /** Prompt type: "text", "number", "confirm", "select", or "multiselect" */
  type: string;

  /** Variable name used for replacement (use {{name}} in template files) */
  name: string;

  /** Question text shown to the user */
  message: string;

  /**
   * Optional default value
   * Can include ${PROJECT_NAME} which will be replaced with the user's project name
   * Example: "initial": "@myorg/${PROJECT_NAME}"
   */
  initial?: string | number | boolean;

  /**
   * Optional validation function as string
   * Should return true if valid, or error message string if invalid
   * Example: "(value) => value.length > 0 || 'Required field'"
   */
  validate?: string;

  /**
   * Optional format function as string to transform the value before saving
   * Example: "(value) => value.toLowerCase()"
   */
  format?: string;

  /**
   * Optional skip condition as string
   * Should return true to skip this prompt based on previous answers
   * Example: "(prev) => !prev.USE_TYPESCRIPT"
   */
  skip?: string;
}

/**
 * Main entry point
 */
async function main() {
  console.log(chalk.blue.bold(`\n🚀 Create ${config.toolName}\n`));

  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // Get project name
  const projectName = args[0];

  if (!projectName) {
    console.log(chalk.red('❌ Please specify a project name:\n'));
    console.log(chalk.gray('  pnpm create @vertesia/tools my-project'));
    console.log(chalk.gray('  npm create @vertesia/tools my-project'));
    console.log(chalk.gray('  npx @vertesia/create-tools my-project\n'));
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
    // Step 1: Download template from GitHub
    await downloadTemplate(projectName);

    // Step 2: Read template configuration
    const templateConfig = readTemplateConfig(projectName);

    // Step 3: Prompt user for configuration
    const answers = await promptUser(projectName, templateConfig);

    // Step 4: Replace variables in files
    replaceVariables(projectName, templateConfig, answers);

    // Step 5: Handle conditional removes
    if (templateConfig.conditionalRemove) {
      handleConditionalRemoves(projectName, templateConfig, answers);
    }

    // Step 6: Remove meta files
    removeMetaFiles(projectName, templateConfig);

    // Step 7: Install dependencies
    await installDependencies(projectName);

    // Step 8: Success!
    showSuccess(projectName);

  } catch (error) {
    console.log(chalk.red(`\n❌ Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`));

    // Cleanup on failure
    if (fs.existsSync(projectName)) {
      console.log(chalk.gray('Cleaning up...'));
      //fs.rmSync(projectName, { recursive: true, force: true });
    }

    process.exit(1);
  }
}

/**
 * Download template from GitHub using degit
 */
async function downloadTemplate(projectName: string): Promise<void> {
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

/**
 * Read template.config.json from the downloaded template
 */
function readTemplateConfig(projectName: string): TemplateConfig {
  const configPath = path.join(projectName, config.templateConfigFile);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Template configuration file not found: ${config.templateConfigFile}`);
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse template configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Prompt user for configuration values
 */
async function promptUser(projectName: string, templateConfig: TemplateConfig): Promise<Record<string, any>> {
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

/**
 * Replace variables in files
 */
function replaceVariables(
  projectName: string,
  templateConfig: TemplateConfig,
  answers: Record<string, any>
): void {
  console.log(chalk.blue('✏️  Configuring files...\n'));

  for (const file of templateConfig.files) {
    const filePath = path.join(projectName, file);

    if (!fs.existsSync(filePath)) {
      console.log(chalk.yellow(`   ⚠️  File not found: ${file} (skipping)`));
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace each variable
    for (const [key, value] of Object.entries(answers)) {
      const placeholder = `{{${key}}}`;
      if (content.includes(placeholder)) {
        content = content.replace(new RegExp(placeholder, 'g'), String(value));
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(chalk.gray(`   ✓ ${file}`));
    }
  }

  console.log();
}

/**
 * Handle conditional file removal based on user answers
 */
function handleConditionalRemoves(
  projectName: string,
  templateConfig: TemplateConfig,
  answers: Record<string, any>
): void {
  if (!templateConfig.conditionalRemove) return;

  console.log(chalk.blue('🔧 Applying conditional configurations...\n'));

  for (const [varName, conditions] of Object.entries(templateConfig.conditionalRemove)) {
    const value = String(answers[varName]);
    const filesToRemove = conditions[value];

    if (filesToRemove) {
      for (const file of filesToRemove) {
        const filePath = path.join(projectName, file);
        if (fs.existsSync(filePath)) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(chalk.gray(`   ✓ Removed: ${file}`));
        }
      }
    }
  }

  console.log();
}

/**
 * Remove meta files that shouldn't be in the user's project
 */
function removeMetaFiles(projectName: string, templateConfig: TemplateConfig): void {
  console.log(chalk.blue('🧹 Cleaning up...\n'));

  const filesToRemove = templateConfig.removeAfterInstall || [];

  for (const file of filesToRemove) {
    const filePath = path.join(projectName, file);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { recursive: true, force: true });
      console.log(chalk.gray(`   ✓ Removed: ${file}`));
    }
  }

  console.log();
}

/**
 * Install dependencies using the configured package manager
 */
async function installDependencies(projectName: string): Promise<void> {
  console.log(chalk.blue('📦 Installing dependencies...\n'));
  console.log(chalk.gray(`   Using: ${config.packageManager}\n`));

  try {
    execSync(`${config.packageManager} install`, {
      cwd: projectName,
      stdio: 'inherit'
    });
    console.log();
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Show success message
 */
function showSuccess(projectName: string): void {
  console.log(chalk.green.bold('✅ Project created successfully!\n'));
  console.log(chalk.gray('Next steps:\n'));
  console.log(chalk.cyan(`  cd ${projectName}`));
  console.log(chalk.cyan(`  ${config.packageManager} dev`));
  console.log();
  console.log(chalk.gray(`Documentation: ${config.docsUrl}`));
  console.log(chalk.gray(`Template: ${config.templateUrl}\n`));
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(chalk.blue.bold(`\n${config.toolName} - Project Generator\n`));
  console.log('Usage:');
  console.log(chalk.gray('  pnpm create @vertesia/tools <project-name>'));
  console.log(chalk.gray('  npm create @vertesia/tools <project-name>'));
  console.log(chalk.gray('  npx @vertesia/create-tools <project-name>\n'));
  console.log('Options:');
  console.log(chalk.gray('  -h, --help     Show this help message\n'));
  console.log('Examples:');
  console.log(chalk.gray('  pnpm create @vertesia/tools my-tool-server'));
  console.log(chalk.gray('  npm create @vertesia/tools my-api-tools\n'));
  console.log(`Documentation: ${chalk.cyan(config.docsUrl)}`);
  console.log(`Template: ${chalk.cyan(config.templateUrl)}\n`);
}

// Run the installer
main().catch((error) => {
  console.error(chalk.red(`\n❌ Fatal error: ${error.message}\n`));
  process.exit(1);
});
