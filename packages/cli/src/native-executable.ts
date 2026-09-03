import { chmodSync, existsSync, statSync } from 'node:fs';

export interface NativeExecutable {
    packageName: string;
    executableName: string;
}

export function nativeExecutable(platform: NodeJS.Platform, architecture: string): NativeExecutable | undefined {
    if (platform !== 'darwin' || !['arm64', 'x64'].includes(architecture)) {
        return undefined;
    }

    return {
        packageName: `@vertesia/cli-darwin-${architecture}`,
        executableName: 'vertesia',
    };
}

export function prepareNativeExecutable(executablePath: string, platform: NodeJS.Platform): boolean {
    if (!existsSync(executablePath)) {
        return false;
    }
    if (platform === 'darwin' && (statSync(executablePath).mode & 0o111) === 0) {
        try {
            chmodSync(executablePath, 0o755);
        } catch {
            return false;
        }
    }
    return true;
}
