/**
 * Template file processing - variable replacement and adjustments
 */
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { TemplateConfig } from './template-config.js';

/**
 * Replace variables in files
 */
export function replaceVariables(
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
 * Adjust package.json after variable replacement
 * 1. Sets the package name to PROJECT_NAME
 * 2. Converts workspace:* dependencies to * for @vertesia and @llumiverse packages
 */
export function adjustPackageJson(projectName: string, answers: Record<string, any>): void {
  console.log(chalk.blue('📝 Adjusting package.json...\n'));

  const packageJsonPath = path.join(projectName, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log(chalk.yellow('   ⚠️  package.json not found (skipping adjustment)'));
    console.log();
    return;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // 1. Set package name to PROJECT_NAME
    const newName = answers.PROJECT_NAME || projectName;
    if (packageJson.name !== newName) {
      packageJson.name = newName;
      console.log(chalk.gray(`   ✓ Set package name to "${newName}"`));
    }

    // 2. Replace workspace:* with * for @vertesia and @llumiverse dependencies
    let workspaceReplacements = 0;

    ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(depType => {
      if (packageJson[depType]) {
        Object.keys(packageJson[depType]).forEach(pkgName => {
          if ((pkgName.startsWith('@vertesia/') || pkgName.startsWith('@llumiverse/')) &&
              packageJson[depType][pkgName] === 'workspace:*') {
            packageJson[depType][pkgName] = '*';
            workspaceReplacements++;
          }
        });
      }
    });

    if (workspaceReplacements > 0) {
      console.log(chalk.gray(`   ✓ Replaced ${workspaceReplacements} workspace:* dependencies with *`));
    }

    // Write back to file
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  } catch (error) {
    console.log(chalk.yellow(`   ⚠️  Failed to adjust package.json: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }

  console.log();
}

/**
 * Handle conditional file removal based on user answers
 */
export function handleConditionalRemoves(
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
export function removeMetaFiles(projectName: string, templateConfig: TemplateConfig): void {
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
