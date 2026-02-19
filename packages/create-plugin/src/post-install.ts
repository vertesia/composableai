/**
 * Install hooks for running commands before/after project creation
 */
import chalk from 'chalk';
import { spawn, spawnSync } from 'child_process';
import prompts from 'prompts';
import { PostInstallConfig, PreInstallConfig } from './template-config.js';

/**
 * Check if a command exists in PATH
 */
function commandExists(command: string): boolean {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

/**
 * Install a global npm package
 */
async function installGlobalPackage(packageName: string, packageManager: string): Promise<boolean> {
  console.log(chalk.blue(`📦 Installing ${packageName}...\n`));

  return new Promise((resolve) => {
    const args = packageManager === 'npm'
      ? ['install', '-g', packageName]
      : ['add', '-g', packageName];

    const child = spawn(packageManager, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`   ✓ ${packageName} installed successfully\n`));
        resolve(true);
      } else {
        console.log(chalk.yellow(`   ⚠️  Failed to install ${packageName}\n`));
        resolve(false);
      }
    });

    child.on('error', () => {
      console.log(chalk.yellow(`   ⚠️  Failed to install ${packageName}\n`));
      resolve(false);
    });
  });
}

/**
 * Run a command in the project directory
 * Uses npx to ensure globally installed packages are found even if PATH hasn't been refreshed
 */
async function runCommand(command: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Use npx to run the command - this ensures we find globally installed packages
    // even if the shell's PATH hasn't been refreshed after installation
    const child = spawn('npx', ['--yes', ...command.split(' ')], {
      stdio: 'inherit',
      shell: true,
      cwd
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Run install hooks (shared implementation for pre and post install)
 */
async function runInstallHooks(
  projectName: string,
  config: PreInstallConfig | PostInstallConfig,
  packageManager: string,
  phase: 'pre' | 'post',
  nonInteractive = false
): Promise<boolean> {
  if (!config.commands || config.commands.length === 0) {
    return true;
  }

  const phaseLabel = phase === 'pre' ? 'pre-install' : 'post-install';
  console.log(chalk.blue(`🔧 Running ${phaseLabel} hooks...\n`));

  // Check and install CLI package if needed
  if (config.cliPackage) {
    // Extract the CLI binary name from the package (e.g., @vertesia/cli -> vertesia)
    // For scoped packages like @vertesia/cli, the binary is typically the scope name (vertesia)
    const scopeMatch = config.cliPackage.match(/^@([^/]+)\//);
    const cliBinary = scopeMatch ? scopeMatch[1] : config.cliPackage.replace(/-cli$/, '');

    if (!commandExists(cliBinary)) {
      let installCli = true;
      if (!nonInteractive) {
        const response = await prompts({
          type: 'confirm',
          name: 'installCli',
          message: `The ${config.cliPackage} package is required. Do you want to install it globally?`,
          initial: true
        });
        installCli = response.installCli;
      }

      if (installCli) {
        const installed = await installGlobalPackage(config.cliPackage, packageManager);
        if (!installed) {
          console.log(chalk.yellow(`   ⚠️  Skipping ${phaseLabel} commands that require the CLI\n`));
          return false;
        }
      } else {
        console.log(chalk.yellow(`   ⚠️  Skipping ${phaseLabel} commands that require the CLI\n`));
        return false;
      }
    }
  }

  // Run each command
  for (const cmd of config.commands) {
    if (cmd.optional && !nonInteractive) {
      const promptMessage = cmd.prompt || `Do you want to run "${cmd.name}"?`;
      const { proceed } = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: promptMessage,
        initial: true
      });

      if (!proceed) {
        console.log(chalk.gray(`   ⏭️  Skipped: ${cmd.name}\n`));
        continue;
      }
    }

    console.log(chalk.gray(`   Running: ${cmd.name}...`));
    const success = await runCommand(cmd.command, projectName);

    if (success) {
      console.log(chalk.green(`   ✓ ${cmd.name} completed\n`));
    } else {
      console.log(chalk.yellow(`   ⚠️  ${cmd.name} failed (you can run it manually later)\n`));
      // For pre-install, a failure is critical - return false to skip dependency installation
      if (phase === 'pre') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Run pre-install hooks (before npm install)
 * Returns true if all required hooks succeeded, false otherwise
 */
export async function runPreInstallHooks(
  projectName: string,
  preInstall: PreInstallConfig,
  packageManager: string,
  nonInteractive = false
): Promise<boolean> {
  return runInstallHooks(projectName, preInstall, packageManager, 'pre', nonInteractive);
}

/**
 * Run post-install hooks (after npm install)
 */
export async function runPostInstallHooks(
  projectName: string,
  postInstall: PostInstallConfig,
  packageManager: string,
  nonInteractive = false
): Promise<void> {
  await runInstallHooks(projectName, postInstall, packageManager, 'post', nonInteractive);
}