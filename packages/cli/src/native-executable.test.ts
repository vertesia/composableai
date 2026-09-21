import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nativeExecutable, prepareNativeExecutable } from './native-executable.js';

describe('nativeExecutable', () => {
    it.each([
        ['darwin', 'arm64', '@vertesia/cli-darwin-arm64', 'vertesia'],
        ['darwin', 'x64', '@vertesia/cli-darwin-x64', 'vertesia'],
    ] as const)(
        'selects the package for %s %s',
        (platform, architecture, expectedPackageName, expectedExecutableName) => {
            expect(nativeExecutable(platform, architecture)).toEqual({
                packageName: expectedPackageName,
                executableName: expectedExecutableName,
            });
        },
    );

    it.each([
        ['linux', 'arm64', undefined],
        ['win32', 'x64', undefined],
        ['win32', 'ia32', undefined],
        ['aix', 'x64', undefined],
    ] as const)('falls back to JavaScript for %s %s', (platform, architecture, expected) => {
        expect(nativeExecutable(platform, architecture)).toBe(expected);
    });
});

describe('prepareNativeExecutable', () => {
    it('restores execute permission on Unix', () => {
        const directory = mkdtempSync(path.join(tmpdir(), 'vertesia-cli-native-'));
        const executablePath = path.join(directory, 'vertesia');
        try {
            writeFileSync(executablePath, '', { mode: 0o644 });
            expect(prepareNativeExecutable(executablePath, 'darwin')).toBe(true);
            expect(statSync(executablePath).mode & 0o111).not.toBe(0);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it('returns false when the optional native package is unavailable', () => {
        expect(prepareNativeExecutable('/does/not/exist', 'darwin')).toBe(false);
    });
});
