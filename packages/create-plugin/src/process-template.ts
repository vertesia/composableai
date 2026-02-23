/**
 * Template file processing - variable replacement and adjustments
 */
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TemplateConfig } from './template-config.js';
import { getTemplateVersions } from './version.js';

/**
 * Get the latest version of an npm package from the registry.
 * Used as a fallback when templateVersions is not available.
 */
function getLatestVersion(packageName: string): string | null {
  try {
    const result = execSync(`npm view ${packageName} version`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Resolve the version for an internal package using the version map.
 * Falls back to npm registry lookup if the map is not available or doesn't cover the scope.
 * Returns { version, pinned } where pinned=true means the version came from the map
 * and should be used as-is (exact), pinned=false means it came from the registry
 * and should use caret range.
 */
function resolveInternalVersion(
  pkgName: string,
  versionMap: Record<string, string> | undefined
): { version: string; pinned: boolean } | null {
  if (versionMap) {
    for (const [scope, version] of Object.entries(versionMap)) {
      if (pkgName.startsWith(`${scope}/`)) {
        return { version, pinned: true };
      }
    }
  }
  // Fallback: query npm registry
  const latest = getLatestVersion(pkgName);
  return latest ? { version: latest, pinned: false } : null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a file is a code file based on extension
 */
function isCodeFile(filePath: string): boolean {
  const codeExtensions = ['.js', '.jsx', '.mjs', '.ts', '.tsx'];
  return codeExtensions.some(ext => filePath.endsWith(ext));
}

/**
 * Replace variables in text files (HTML, JSON, Markdown, etc.)
 * Uses {{VARIABLE}} placeholder pattern
 */
function replaceInTextFile(content: string, answers: Record<string, any>): { content: string; modified: boolean } {
  let modified = false;

  for (const [key, value] of Object.entries(answers)) {
    const placeholder = `{{${key}}}`;
    if (content.includes(placeholder)) {
      content = content.replace(new RegExp(escapeRegex(placeholder), 'g'), String(value));
      modified = true;
    }
  }

  return { content, modified };
}

/**
 * Replace variables in code files (JavaScript, TypeScript)
 * Supports two patterns:
 * 1. const CONFIG__variableName = value; - Constant value replacement
 * 2. TEMPLATE__IdentifierName - Identifier name replacement (functions, classes, variables)
 */
function replaceInCodeFile(content: string, answers: Record<string, any>): { content: string; modified: boolean } {
  let modified = false;

  for (const [key, value] of Object.entries(answers)) {
    // Pattern 1: CONFIG__ constant value replacement
    // Matches: const CONFIG__variableName = <value>; or <value>\n
    // Replaces only the value, keeps the constant declaration
    const configPattern = new RegExp(
      `(const\\s+CONFIG__${key}\\s*=\\s*)([^;\\n]+)(\\s*;?\\s*\\n?)`,
      'gm'
    );
    if (content.match(configPattern)) {
      content = content.replace(configPattern, (match, prefix, oldValue, suffix) => {
        return `${prefix}${JSON.stringify(value)}${suffix}`;
      });
      modified = true;
    }

    // Pattern 2: TEMPLATE__ identifier replacement
    // Matches: TEMPLATE__IdentifierName anywhere in code
    // Replaces the entire identifier with the value
    const templatePattern = new RegExp(`TEMPLATE__${key}\\b`, 'g');
    if (content.match(templatePattern)) {
      content = content.replace(templatePattern, String(value));
      modified = true;
    }
  }

  return { content, modified };
}

/**
 * Replace variables in files
 * Uses different strategies based on file type:
 * - Code files (.js, .jsx, .mjs, .ts, .tsx):
 *   - CONFIG__variableName for constant values
 *   - TEMPLATE__IdentifierName for identifier replacement
 * - Text files (all others): {{VARIABLE}} placeholder pattern
 */
export function replaceVariables(
  projectName: string,
  templateConfig: TemplateConfig,
  answers: Record<string, any>
): void {
  if (!templateConfig.files) {
    return;
  }

  console.log(chalk.blue('✏️  Configuring files...\n'));

  for (const file of templateConfig.files) {
    const filePath = path.join(projectName, file);

    if (!fs.existsSync(filePath)) {
      console.log(chalk.yellow(`   ⚠️  File not found: ${file} (skipping)`));
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Choose replacement strategy based on file type
    if (isCodeFile(file)) {
      const result = replaceInCodeFile(content, answers);
      content = result.content;
      modified = result.modified;
    } else {
      const result = replaceInTextFile(content, answers);
      content = result.content;
      modified = result.modified;
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
 * 2. Resolves workspace:* dependencies to actual latest versions
 */
export function adjustPackageJson(projectName: string, answers: Record<string, any>, isDev: boolean): void {
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

    // 2. Replace workspace:* with pinned versions
    const internalScopes = ['@vertesia/', '@llumiverse/', '@dglabs/'];
    const versionMap = isDev ? undefined : getTemplateVersions();
    let workspaceReplacements = 0;

    if (versionMap) {
      console.log(chalk.gray('   Using pinned versions from CLI package'));
    }

    ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach(depType => {
      if (packageJson[depType]) {
        Object.keys(packageJson[depType]).forEach(pkgName => {
          const isInternalPackage = internalScopes.some(scope => pkgName.startsWith(scope));
          if (isInternalPackage && packageJson[depType][pkgName] === 'workspace:*') {
            if (isDev) {
              // Dev mode: use 'dev' npm tag
              packageJson[depType][pkgName] = 'dev';
              workspaceReplacements++;
            } else {
              const resolved = resolveInternalVersion(pkgName, versionMap);
              if (resolved) {
                // Exact version when from version map, caret range when from registry
                packageJson[depType][pkgName] = resolved.pinned ? resolved.version : `^${resolved.version}`;
                workspaceReplacements++;
              } else {
                packageJson[depType][pkgName] = 'latest';
                workspaceReplacements++;
              }
            }
          }
        });
      }
    });

    if (workspaceReplacements > 0) {
      const method = versionMap ? 'pinned' : 'latest';
      console.log(chalk.gray(`   ✓ Resolved ${workspaceReplacements} workspace:* dependencies to ${method} versions`));
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
 * Rename files based on template configuration
 * Useful for files like .env.template -> .env that can't be committed to git
 */
export function renameFiles(projectName: string, templateConfig: TemplateConfig): void {
  if (!templateConfig.renameFiles) return;

  console.log(chalk.blue('📝 Renaming files...\n'));

  for (const [source, destination] of Object.entries(templateConfig.renameFiles)) {
    const sourcePath = path.join(projectName, source);
    const destPath = path.join(projectName, destination);

    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, destPath);
      console.log(chalk.gray(`   ✓ ${source} → ${destination}`));
    } else {
      console.log(chalk.yellow(`   ⚠️  File not found: ${source} (skipping rename)`));
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