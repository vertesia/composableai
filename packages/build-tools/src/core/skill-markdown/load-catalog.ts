/**
 * Loading the skill catalog named by `vertesia-build.skillCatalog`.
 *
 * Shared by the `vertesia-build` CLI and the Vite dev-server plugin so both resolve
 * `{@tool …}` / `{@skill …}` against the same registry. Without this the two paths disagree:
 * a build would validate a skill body that `vite dev` and `vitest` then refuse to transform.
 *
 * The catalog is named as a *module path* rather than inlined, because it is derived from compiled
 * code — a package's own tool registry, or a dependency's catalog artifact. Naming it in
 * package.json keeps that dependency explicit instead of having build-tools go looking for a
 * registry it should not know about.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PreprocessSkillMarkdownOptions } from './preprocess.js';

export const CONFIG_KEY = 'vertesia-build';

/**
 * Shape a `skillCatalog` module may export.
 *
 * The name collections are `Iterable<string>` rather than `ReadonlySet`, so a catalog can export
 * plain arrays — which is what a JSON-derived one naturally produces. They are normalised to sets
 * here, which is why this cannot simply extend `PreprocessSkillMarkdownOptions`.
 */
interface RawCatalog extends Omit<Partial<PreprocessSkillMarkdownOptions>, keyof RawCatalogNames> {
    tools?: Iterable<string>;
    skills?: Iterable<string>;
    ambiguousTools?: Iterable<string>;
    ambiguousSkills?: Iterable<string>;
    unvalidatableTools?: Iterable<string>;
    exampleLanguages?: Iterable<string>;
}

/** The option keys `RawCatalog` widens to `Iterable`. */
interface RawCatalogNames {
    tools: unknown;
    skills: unknown;
    ambiguousTools: unknown;
    ambiguousSkills: unknown;
    unvalidatableTools: unknown;
    exampleLanguages: unknown;
}

/**
 * Import a catalog module and normalise it into preprocessor options.
 *
 * @throws when the module does not export both `tools` and `skills`.
 */
export async function loadSkillCatalog(modulePath: string): Promise<PreprocessSkillMarkdownOptions> {
    const loaded = (await import(pathToFileURL(modulePath).href)) as Record<string, unknown>;
    const source = (loaded.default ?? loaded) as RawCatalog;

    if (!source.tools || !source.skills) {
        throw new Error(`skillCatalog module ${modulePath} must export { tools, skills }.`);
    }
    return {
        tools: new Set(source.tools),
        skills: new Set(source.skills),
        ambiguousTools: source.ambiguousTools ? new Set(source.ambiguousTools) : undefined,
        ambiguousSkills: source.ambiguousSkills ? new Set(source.ambiguousSkills) : undefined,
        unvalidatableTools: source.unvalidatableTools ? new Set(source.unvalidatableTools) : undefined,
        validateExample: source.validateExample,
        validateField: source.validateField,
        skillToolPrefix: source.skillToolPrefix,
        exampleLanguages: source.exampleLanguages ? new Set(source.exampleLanguages) : undefined,
    };
}

/**
 * Absolute path of the catalog module configured in a package.json, if any.
 *
 * Returns `undefined` when the key is absent — a package that uses no constructs needs no catalog,
 * and the transformer only fails when a body actually uses one.
 */
export function resolveSkillCatalogPath(pkg: Record<string, unknown>, cwd: string): string | undefined {
    const raw = pkg[CONFIG_KEY];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return undefined;
    }
    const value = (raw as { skillCatalog?: unknown }).skillCatalog;
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`"${CONFIG_KEY}.skillCatalog" must be a non-empty path when set.`);
    }
    return path.resolve(cwd, value);
}

/** Read `<dir>/package.json`, or `undefined` when it is missing or unparseable. */
export function readPackageJson(dir: string): Record<string, unknown> | undefined {
    try {
        return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf-8')) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}
