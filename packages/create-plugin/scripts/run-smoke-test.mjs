#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
/**
 * Smoke test for create-plugin: scaffolds a project from the local plugin
 * template into a random tmpdir, then deletes it. Avoiding the repo
 * working tree keeps the generated tree out of biome's nested-config scanner
 * and out of `git status`.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgDir = resolve(__dirname, '..');
const cliPath = resolve(pkgDir, 'lib/index.js');
const localTemplates = resolve(pkgDir, '../../templates');
const cliPackage = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

const tmpRoot = mkdtempSync(join(tmpdir(), 'vertesia-create-plugin-'));
const projectName = 'test-project';
const projectPath = join(tmpRoot, projectName);

let exitCode = 0;
try {
    const result = spawnSync(
        process.execPath,
        [
            cliPath,
            projectName,
            '--yes',
            '--template',
            'Vertesia Plugin',
            '--local-templates',
            localTemplates,
            '--skip-install',
            '--dev',
            '--dependency-mode',
            'pinned',
        ],
        { cwd: tmpRoot, stdio: 'inherit' },
    );
    if (result.status !== 0) {
        exitCode = result.status ?? 1;
    } else if (!existsSync(join(projectPath, 'package.json'))) {
        console.error(`smoke test: expected ${projectPath}/package.json to exist`);
        exitCode = 1;
    } else {
        const generatedPackage = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf8'));
        const internalDependencies = Object.entries({
            ...generatedPackage.dependencies,
            ...generatedPackage.devDependencies,
            ...generatedPackage.peerDependencies,
            ...generatedPackage.optionalDependencies,
        }).filter(
            ([name]) => name.startsWith('@vertesia/') || name.startsWith('@llumiverse/') || name.startsWith('@dglabs/'),
        );
        const privateDependency = internalDependencies.find(([name]) => name.startsWith('@dglabs/'));
        const mismatchedDependency = internalDependencies.find(([name, version]) => {
            const scope = name.slice(0, name.indexOf('/'));
            return !cliPackage.templateVersions?.[scope] || version !== cliPackage.templateVersions[scope];
        });
        if (privateDependency) {
            console.error(`smoke test: generated app unexpectedly contains private dependency ${privateDependency[0]}`);
            exitCode = 1;
        } else if (mismatchedDependency) {
            const [name, version] = mismatchedDependency;
            const scope = name.slice(0, name.indexOf('/'));
            console.error(
                `smoke test: expected ${name}@${cliPackage.templateVersions?.[scope] ?? '<missing>'}, found ${version}`,
            );
            exitCode = 1;
        } else {
            console.log(`smoke test: scaffolded at ${projectPath} OK`);
        }
    }
} finally {
    rmSync(tmpRoot, { recursive: true, force: true });
}

process.exit(exitCode);
