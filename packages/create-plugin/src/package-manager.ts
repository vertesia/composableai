/**
 * Package manager detection and selection
 */
import { execSync } from 'child_process';
import prompts from 'prompts';
import chalk from 'chalk';

/**
 * Check if a command exists on the system (cross-platform)
 */
function commandExists(command: string): boolean {
  try {
    const checkCommand = process.platform === 'win32'
      ? `where ${command}`
      : `which ${command}`;
    execSync(checkCommand, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect available package managers and let user choose
 * Returns the selected package manager ('pnpm' or 'npm')
 * @param forcedPackageManager - If specified, skip selection and use this package manager
 * @param nonInteractive - If true, auto-select pnpm (if available) or npm without prompting
 */
export async function selectPackageManager(forcedPackageManager?: 'pnpm' | 'npm', nonInteractive = false): Promise<string> {
  const hasPnpm = commandExists('pnpm');
  const hasNpm = commandExists('npm');

  // If npm is not installed, something is seriously wrong
  if (!hasNpm) {
    throw new Error('npm is not installed. Please install Node.js and npm first.');
  }

  // If a specific package manager is forced by the template
  if (forcedPackageManager) {
    if (forcedPackageManager === 'pnpm' && !hasPnpm) {
      throw new Error('This template requires pnpm. Please install it first: npm install -g pnpm');
    }
    console.log(chalk.gray(`Using ${forcedPackageManager} (required by template)\n`));
    return forcedPackageManager;
  }

  // If pnpm is not installed, use npm
  if (!hasPnpm) {
    console.log(chalk.gray('Using npm (pnpm not found)\n'));
    return 'npm';
  }

  // Non-interactive: auto-select pnpm (recommended default)
  if (nonInteractive) {
    console.log(chalk.gray('Using pnpm (non-interactive mode)\n'));
    return 'pnpm';
  }

  // Both are installed - let user choose
  console.log(chalk.blue('📦 Package Manager\n'));

  const response = await prompts({
    type: 'select',
    name: 'packageManager',
    message: 'Which package manager would you like to use?',
    choices: [
      { title: 'pnpm (recommended)', value: 'pnpm' },
      { title: 'npm', value: 'npm' }
    ],
    initial: 0
  }, {
    onCancel: () => {
      throw new Error('Installation cancelled by user');
    }
  });

  console.log();
  return response.packageManager;
}

/**
 * Install dependencies using the specified package manager
 */
export async function installDependencies(projectName: string, packageManager: string): Promise<void> {
  console.log(chalk.blue('📦 Installing dependencies...\n'));
  console.log(chalk.gray(`   Using: ${packageManager}\n`));

  try {
    execSync(`${packageManager} install`, {
      cwd: projectName,
      stdio: 'inherit'
    });
    console.log();
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
