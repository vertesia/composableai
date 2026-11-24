import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Command } from 'commander';

const NOTICES_FILE = 'THIRD-PARTY-NOTICES.txt';

declare const VERTESIA_CLI_RUNTIME: string | undefined;

/**
 * Where the native executable's notices are: in its package, one level above bin/vertesia. The
 * JavaScript CLI installs its dependencies with npm, and each one keeps its own license in node_modules.
 */
export function nativeNoticesPath(executable: string): string {
    return path.join(path.dirname(path.dirname(executable)), NOTICES_FILE);
}

function isNative(): boolean {
    return typeof VERTESIA_CLI_RUNTIME === 'string' && VERTESIA_CLI_RUNTIME.startsWith('native');
}

export function registerLicensesCommand(program: Command) {
    program
        .command('licenses')
        .description('print the licenses of the third-party software in this CLI')
        .action(() => {
            if (isNative()) {
                const notices = nativeNoticesPath(realpathSync(process.execPath));
                if (existsSync(notices)) {
                    process.stdout.write(readFileSync(notices, 'utf8'));
                    return;
                }
                console.error(`The third-party notices of this executable are missing: expected ${notices}.`);
                process.exitCode = 1;
                return;
            }
            console.log(
                [
                    'The Vertesia CLI is licensed under the Apache License 2.0.',
                    'It was installed with npm, together with its open-source dependencies: each one is in its',
                    'own folder under node_modules, with its license file and the license in its package.json.',
                    'Run `npm ls --all --global @vertesia/cli` to list them.',
                ].join('\n'),
            );
        });
}
