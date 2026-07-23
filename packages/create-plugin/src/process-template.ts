/**
 * Template file processing - variable replacement and adjustments
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { TemplateConfig } from './template-config.js';
import { getTemplateVersions } from './version.js';

/**
 * Get the latest version of an npm package from the registry.
 * Used as a fallback when templateVersions is not available.
 */
function getLatestVersion(packageName: string): string | null {
    try {
        const result = execSync(`npm view ${packageName} version`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
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
    versionMap: Record<string, string> | undefined,
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

function rewritePackageManagerScripts(
    packageJson: { scripts?: Record<string, string> },
    packageManager: string,
): number {
    if (!packageJson.scripts) return 0;

    let replacements = 0;
    const runCommand = `${packageManager} run`;
    const commandPrefix = String.raw`(^|(?:&&|\|\||[;|])\s*)`;
    const scriptNames = Object.keys(packageJson.scripts).filter((name) => name !== 'run');

    for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
        let updatedCommand = scriptCommand;
        for (const targetScript of scriptNames) {
            const directScriptPattern = new RegExp(
                `${commandPrefix}(?:npm|pnpm)\\s+${escapeRegex(targetScript)}(?=\\s|$)`,
                'g',
            );
            updatedCommand = updatedCommand.replace(directScriptPattern, `$1${runCommand} ${targetScript}`);
        }
        const explicitRunPattern = new RegExp(`${commandPrefix}(?:npm|pnpm)\\s+run\\b`, 'g');
        updatedCommand = updatedCommand.replace(explicitRunPattern, `$1${runCommand}`);
        if (updatedCommand !== scriptCommand) {
            packageJson.scripts[scriptName] = updatedCommand;
            replacements++;
        }
    }

    return replacements;
}

export function normalizePackageManagerScripts(projectName: string, packageManager: string): number {
    const packageJsonPath = path.join(projectName, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return 0;

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
        scripts?: Record<string, string>;
    };
    const replacements = rewritePackageManagerScripts(packageJson, packageManager);
    if (replacements > 0) {
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`);
    }
    return replacements;
}

function stripYamlQuotes(value: string): string {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function readTemplateCatalog(projectName: string): Record<string, string> {
    const workspacePath =
        ['pnpm-workspace.yaml.template', 'pnpm-workspace.yaml']
            .map((fileName) => path.join(projectName, fileName))
            .find((filePath) => fs.existsSync(filePath)) ?? '';

    if (!workspacePath) {
        return {};
    }

    const catalog: Record<string, string> = {};
    let inCatalog = false;

    for (const line of fs.readFileSync(workspacePath, 'utf8').split(/\r?\n/)) {
        if (!inCatalog) {
            if (line.trim() === 'catalog:') {
                inCatalog = true;
            }
            continue;
        }

        if (line.trim() === '' || line.trimStart().startsWith('#')) {
            continue;
        }

        if (!line.startsWith(' ') && !line.startsWith('\t')) {
            break;
        }

        const match = line.match(/^\s+("?[^":]+"?|[^:]+):\s*(.+?)\s*(?:#.*)?$/);
        if (match) {
            catalog[stripYamlQuotes(match[1])] = stripYamlQuotes(match[2]);
        }
    }

    return catalog;
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
    return codeExtensions.some((ext) => filePath.endsWith(ext));
}

/**
 * Replace variables in text files (HTML, JSON, Markdown, etc.)
 * Uses {{VARIABLE}} placeholder pattern
 */
function replaceInTextFile(content: string, answers: Record<string, unknown>): { content: string; modified: boolean } {
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
function replaceInCodeFile(content: string, answers: Record<string, unknown>): { content: string; modified: boolean } {
    let modified = false;

    for (const [key, value] of Object.entries(answers)) {
        // Pattern 1: CONFIG__ constant value replacement
        // Matches: const CONFIG__variableName = <value>; or <value>\n
        // Replaces only the value, keeps the constant declaration
        const configPattern = new RegExp(`(const\\s+CONFIG__${key}\\s*=\\s*)([^;\\n]+)(\\s*;?\\s*\\n?)`, 'gm');
        if (content.match(configPattern)) {
            content = content.replace(configPattern, (_match, prefix, _oldValue, suffix) => {
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
    answers: Record<string, unknown>,
): void {
    if (!templateConfig.files) {
        return;
    }

    console.log(chalk.blue('Configuring files...\n'));

    for (const file of templateConfig.files) {
        const filePath = path.join(projectName, file);

        if (!fs.existsSync(filePath)) {
            console.log(chalk.yellow(`   File not found: ${file} (skipping)`));
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
            console.log(chalk.gray(`   ${file}`));
        }
    }

    console.log();
}

export function applyDevModeAnswers(templateConfig: TemplateConfig, answers: Record<string, unknown>): void {
    if (!templateConfig.devMode?.answers) return;

    Object.assign(answers, templateConfig.devMode.answers);
}

function appendUniqueYamlListSection(content: string, sectionName: string, values: string[]): string {
    if (values.length === 0) return content;

    const existing = new Set<string>();
    const lines = content.split(/\r?\n/);
    let inSection = false;

    for (const line of lines) {
        if (line.trim() === `${sectionName}:`) {
            inSection = true;
            continue;
        }
        if (inSection && line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
            inSection = false;
        }
        if (inSection) {
            const match = line.match(/^\s*-\s+['"]?(.+?)['"]?\s*$/);
            if (match) existing.add(match[1]);
        }
    }

    const missing = values.filter((value) => !existing.has(value));
    if (missing.length === 0) return content;

    const suffix = content.endsWith('\n') ? '' : '\n';
    return `${content}${suffix}${sectionName}:\n${missing.map((value) => `  - '${value}'`).join('\n')}\n`;
}

export function applyDevModePackageManagerConfig(
    projectName: string,
    templateConfig: TemplateConfig,
    isDev: boolean,
    packageManager: string,
): void {
    if (!isDev || packageManager !== 'pnpm') return;

    const exclusions = templateConfig.devMode?.pnpmWorkspace?.minimumReleaseAgeExclude ?? [];
    if (exclusions.length === 0) return;

    const workspacePath = path.join(projectName, 'pnpm-workspace.yaml');
    if (!fs.existsSync(workspacePath)) return;

    const current = fs.readFileSync(workspacePath, 'utf8');
    const next = appendUniqueYamlListSection(current, 'minimumReleaseAgeExclude', exclusions);
    if (next !== current) {
        fs.writeFileSync(workspacePath, next);
    }
}

/**
 * Adjust package.json after variable replacement
 * 1. Sets the package name to PROJECT_NAME
 * 2. Resolves workspace:* dependencies to actual latest versions
 */
export function adjustPackageJson(
    projectName: string,
    answers: Record<string, unknown>,
    isDev: boolean,
    packageManager: string,
): void {
    console.log(chalk.blue('Adjusting package.json...\n'));

    const packageJsonPath = path.join(projectName, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        console.log(chalk.yellow('   package.json not found (skipping adjustment)'));
        console.log();
        return;
    }

    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

        // 1. Set package name to PROJECT_NAME
        const newName = answers.PROJECT_NAME || projectName;
        if (packageJson.name !== newName) {
            packageJson.name = newName;
            console.log(chalk.gray(`   Set package name to "${newName}"`));
        }

        // Pin the chosen package manager via Corepack
        if (answers.PM_VERSION) {
            packageJson.packageManager = `${packageManager}@${answers.PM_VERSION}`;
            console.log(chalk.gray(`   Set packageManager to "${packageJson.packageManager}"`));
        }

        // 2. Replace catalog: specs with concrete versions for package managers that do not support pnpm catalogs.
        let catalogReplacements = 0;

        if (packageManager !== 'pnpm') {
            const catalog = readTemplateCatalog(projectName);

            ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach((depType) => {
                if (packageJson[depType]) {
                    Object.keys(packageJson[depType]).forEach((pkgName) => {
                        if (packageJson[depType][pkgName] === 'catalog:' && catalog[pkgName]) {
                            packageJson[depType][pkgName] = catalog[pkgName];
                            catalogReplacements++;
                        }
                    });
                }
            });
        }

        if (catalogReplacements > 0) {
            console.log(chalk.gray(`   ✓ Resolved ${catalogReplacements} catalog: dependencies from template catalog`));
        }

        // 3. Replace workspace:* with pinned versions
        const internalScopes = ['@vertesia/', '@llumiverse/', '@dglabs/'];
        const versionMap = isDev ? undefined : getTemplateVersions();
        let workspaceReplacements = 0;

        if (versionMap) {
            console.log(chalk.gray('   Using pinned versions from CLI package'));
        }

        ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach((depType) => {
            if (packageJson[depType]) {
                Object.keys(packageJson[depType]).forEach((pkgName) => {
                    const isInternalPackage = internalScopes.some((scope) => pkgName.startsWith(scope));
                    if (isInternalPackage && packageJson[depType][pkgName] === 'workspace:*') {
                        if (isDev) {
                            // Dev mode: use 'dev' npm tag
                            packageJson[depType][pkgName] = 'dev';
                            workspaceReplacements++;
                        } else {
                            const resolved = resolveInternalVersion(pkgName, versionMap);
                            if (resolved) {
                                // Exact version when from version map, caret range when from registry
                                packageJson[depType][pkgName] = resolved.pinned
                                    ? resolved.version
                                    : `^${resolved.version}`;
                                workspaceReplacements++;
                            } else {
                                // No version map entry and no resolvable registry version. Floating
                                // a generated app onto the npm `latest` tag silently couples it to
                                // whatever publishes next (a different major can break the build at
                                // an unrelated time). Fail loudly instead so the caller pins a
                                // version map or uses --dev.
                                throw new Error(
                                    `Cannot resolve a version for internal dependency "${pkgName}": no entry in the ` +
                                        'pinned version map and the npm registry returned no version. ' +
                                        'Provide a version map (CLI-pinned versions) or run with --dev to use the "dev" tag.',
                                );
                            }
                        }
                    }
                });
            }
        });

        if (workspaceReplacements > 0) {
            const method = versionMap ? 'pinned' : 'latest';
            console.log(
                chalk.gray(`   Resolved ${workspaceReplacements} workspace:* dependencies to ${method} versions`),
            );
        }

        // Write back to file
        fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
    } catch (error) {
        console.log(
            chalk.yellow(
                `   Failed to adjust package.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ),
        );
    }

    console.log();
}

/**
 * Handle conditional file removal based on user answers
 */
export function handleConditionalRemoves(
    projectName: string,
    templateConfig: TemplateConfig,
    answers: Record<string, unknown>,
): void {
    if (!templateConfig.conditionalRemove) return;

    console.log(chalk.blue('Applying conditional configurations...\n'));

    for (const [varName, conditions] of Object.entries(templateConfig.conditionalRemove)) {
        const value = String(answers[varName]);
        const filesToRemove = conditions[value];

        if (filesToRemove) {
            for (const file of filesToRemove) {
                const filePath = path.join(projectName, file);
                if (fs.existsSync(filePath)) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                    console.log(chalk.gray(`   Removed: ${file}`));
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

    console.log(chalk.blue('Renaming files...\n'));

    for (const [source, destination] of Object.entries(templateConfig.renameFiles)) {
        const sourcePath = path.join(projectName, source);
        const destPath = path.join(projectName, destination);

        if (fs.existsSync(sourcePath)) {
            fs.renameSync(sourcePath, destPath);
            console.log(chalk.gray(`   ${source} → ${destination}`));
        } else {
            console.log(chalk.yellow(`   File not found: ${source} (skipping rename)`));
        }
    }

    console.log();
}

/**
 * Remove meta files that shouldn't be in the user's project
 */
export function removeMetaFiles(projectName: string, templateConfig: TemplateConfig): void {
    console.log(chalk.blue('Cleaning up...\n'));

    const filesToRemove = templateConfig.removeAfterInstall || [];

    for (const file of filesToRemove) {
        const filePath = path.join(projectName, file);
        if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { recursive: true, force: true });
            console.log(chalk.gray(`   Removed: ${file}`));
        }
    }

    console.log();
}
