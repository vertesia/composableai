/**
 * Pure config-parsing logic for the `vertesia-build` CLI.
 *
 * Lives in its own module so it can be unit-tested without spawning a
 * subprocess. Errors are surfaced as thrown exceptions — the CLI entry
 * point (`build.ts`) catches them and translates to `process.exit(1)`
 * with a clear message.
 */

import path from 'node:path';
import { resolveTransformerNames } from '../import-transform/builtins.js';
import type { TransformImportsOptions } from '../import-transform/index.js';

export const CONFIG_KEY = 'vertesia-build';

export class VertesiaBuildConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'VertesiaBuildConfigError';
    }
}

interface RawConfig {
    libDir?: unknown;
    srcDir?: unknown;
    transformers?: unknown;
    assetsDir?: unknown;
    widgetsDir?: unknown;
    widgetConfig?: unknown;
}

/**
 * Parse and validate the `vertesia-build` block of a package.json.
 *
 * @param pkg  Parsed contents of the consuming `package.json`.
 * @param cwd  Working directory used to resolve relative paths in the config.
 * @returns Resolved options suitable for passing to `transformImports`.
 * @throws {VertesiaBuildConfigError} when the config is missing, malformed,
 *         or references unknown transformers.
 */
export function resolveConfig(pkg: Record<string, unknown>, cwd: string): TransformImportsOptions {
    const raw = pkg[CONFIG_KEY];

    if (raw === undefined) {
        throw new VertesiaBuildConfigError(`missing "${CONFIG_KEY}" key in package.json at ${cwd}.`);
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new VertesiaBuildConfigError(`"${CONFIG_KEY}" must be an object in package.json.`);
    }
    const cfg = raw as RawConfig;

    if (typeof cfg.libDir !== 'string' || cfg.libDir.length === 0) {
        throw new VertesiaBuildConfigError(`"${CONFIG_KEY}.libDir" must be a non-empty string.`);
    }
    if (typeof cfg.srcDir !== 'string' || cfg.srcDir.length === 0) {
        throw new VertesiaBuildConfigError(`"${CONFIG_KEY}.srcDir" must be a non-empty string.`);
    }
    if (!Array.isArray(cfg.transformers) || cfg.transformers.length === 0) {
        throw new VertesiaBuildConfigError(
            `"${CONFIG_KEY}.transformers" must be a non-empty array of transformer names.`,
        );
    }
    const names: string[] = [];
    for (const entry of cfg.transformers) {
        if (typeof entry !== 'string' || entry.length === 0) {
            throw new VertesiaBuildConfigError(
                `every entry in "${CONFIG_KEY}.transformers" must be a non-empty string.`,
            );
        }
        names.push(entry);
    }

    let transformers: TransformImportsOptions['transformers'];
    try {
        transformers = resolveTransformerNames(names);
    } catch (error) {
        // resolveTransformerNames throws plain Error; rewrap so callers can
        // identify config-level failures uniformly.
        throw new VertesiaBuildConfigError((error as Error).message);
    }

    const resolved: TransformImportsOptions = {
        libDir: path.resolve(cwd, cfg.libDir),
        srcDir: path.resolve(cwd, cfg.srcDir),
        transformers,
    };

    if (cfg.assetsDir !== undefined) {
        if (cfg.assetsDir === false) {
            resolved.assetsDir = false;
        } else if (typeof cfg.assetsDir === 'string' && cfg.assetsDir.length > 0) {
            resolved.assetsDir = path.resolve(cwd, cfg.assetsDir);
        } else {
            throw new VertesiaBuildConfigError(`"${CONFIG_KEY}.assetsDir" must be a string path or false.`);
        }
    }

    if (cfg.widgetsDir !== undefined) {
        if (typeof cfg.widgetsDir !== 'string' || cfg.widgetsDir.length === 0) {
            throw new VertesiaBuildConfigError(`"${CONFIG_KEY}.widgetsDir" must be a non-empty string when set.`);
        }
        resolved.widgetsDir = cfg.widgetsDir;
    }

    if (cfg.widgetConfig !== undefined) {
        if (typeof cfg.widgetConfig !== 'object' || cfg.widgetConfig === null || Array.isArray(cfg.widgetConfig)) {
            throw new VertesiaBuildConfigError(`"${CONFIG_KEY}.widgetConfig" must be an object when set.`);
        }
        resolved.widgetConfig = cfg.widgetConfig as TransformImportsOptions['widgetConfig'];
    }

    return resolved;
}
