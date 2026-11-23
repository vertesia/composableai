/**
 * Third-party license notices for bundled JavaScript.
 *
 * A bundler copies the code of npm packages into its output, and with it the obligation to ship their
 * copyright and license notices. These helpers find which packages a bundle contains and write those
 * notices next to it:
 *
 *   - `THIRD-PARTY-NOTICES.txt`: each package's name, version, declared license and license files.
 *   - `third-party-licenses.json`: the same data, for tools that assemble notices for a whole image.
 *
 * `thirdPartyLicenses()` is a Rollup-compatible plugin, so it works in Vite, Rolldown and tsdown
 * configurations. `collectThirdPartyLicenses()` takes module paths from any other bundler, such as the
 * inputs of an esbuild metafile.
 *
 * The output is deterministic: packages are sorted, and nothing records a time or an absolute path.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, sep } from 'node:path';

export const THIRD_PARTY_NOTICES_FILE = 'THIRD-PARTY-NOTICES.txt';
export const THIRD_PARTY_LICENSES_FILE = 'third-party-licenses.json';

const LICENSE_FILE = /^(licen[cs]e|copying|notice|copyright|unlicense|patents)([._-].*)?$/i;

export interface ThirdPartyLicenseText {
    /** File name inside the package, such as `LICENSE` or `NOTICE.md`. */
    file: string;
    content: string;
}

export interface ThirdPartyPackage {
    name: string;
    version: string;
    /** The package's declared license: its SPDX expression, or `UNKNOWN` when it declares none. */
    license: string;
    homepage?: string;
    repository?: string;
    texts: ThirdPartyLicenseText[];
}

export interface CollectThirdPartyLicensesOptions {
    /** Package names to leave out, in addition to private and `UNLICENSED` packages. */
    exclude?: (string | RegExp)[];
}

interface PackageJson {
    name?: string;
    version?: string;
    private?: boolean;
    license?: string | { type?: string };
    licenses?: { type?: string }[];
    homepage?: string;
    repository?: string | { url?: string };
}

/** The directory of the npm package that contains `file`, found from the last `node_modules` segment. */
export function packageRootOf(file: string): string | undefined {
    const normalized = file.split('?')[0].replace(/^\0/, '');
    const marker = `${sep}node_modules${sep}`;
    const index = normalized.lastIndexOf(marker);
    if (index < 0) {
        return undefined;
    }
    const rest = normalized.slice(index + marker.length).split(sep);
    const depth = rest[0]?.startsWith('@') ? 2 : 1;
    if (rest.length <= depth) {
        return undefined;
    }
    return normalized.slice(0, index + marker.length) + rest.slice(0, depth).join(sep);
}

function declaredLicense(pkg: PackageJson): string {
    if (typeof pkg.license === 'string' && pkg.license.trim()) {
        return pkg.license.trim();
    }
    if (pkg.license && typeof pkg.license === 'object' && pkg.license.type) {
        return pkg.license.type;
    }
    const legacy = (pkg.licenses ?? []).map((l) => l.type).filter(Boolean);
    if (legacy.length === 1) {
        return legacy[0] as string;
    }
    if (legacy.length > 1) {
        return `(${legacy.join(' OR ')})`;
    }
    return 'UNKNOWN';
}

function repositoryUrl(pkg: PackageJson): string | undefined {
    if (typeof pkg.repository === 'string') {
        return pkg.repository;
    }
    return pkg.repository?.url;
}

function licenseTexts(root: string): ThirdPartyLicenseText[] {
    const texts: ThirdPartyLicenseText[] = [];
    for (const name of readdirSync(root).sort(compare)) {
        if (!LICENSE_FILE.test(name)) {
            continue;
        }
        const path = join(root, name);
        if (statSync(path).isFile()) {
            texts.push({ file: name, content: readFileSync(path, 'utf8') });
        }
    }
    return texts;
}

function compare(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function matches(name: string, patterns: (string | RegExp)[]): boolean {
    return patterns.some((pattern) => (typeof pattern === 'string' ? pattern === name : pattern.test(name)));
}

/**
 * Lists the npm packages whose files are among `moduleIds` (absolute paths of bundled modules), with their
 * license texts. Modules outside `node_modules` (the project's own sources, linked workspace packages) and
 * private or `UNLICENSED` packages are not third-party and are left out.
 */
export function collectThirdPartyLicenses(
    moduleIds: Iterable<string>,
    options: CollectThirdPartyLicensesOptions = {},
): ThirdPartyPackage[] {
    const roots = new Set<string>();
    for (const id of moduleIds) {
        const root = packageRootOf(id);
        if (root) {
            roots.add(root);
        }
    }
    const packages = new Map<string, ThirdPartyPackage>();
    for (const root of roots) {
        const manifestPath = join(root, 'package.json');
        if (!existsSync(manifestPath)) {
            continue;
        }
        const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as PackageJson;
        const name = pkg.name ?? basename(root);
        const license = declaredLicense(pkg);
        if (pkg.private || license === 'UNLICENSED' || matches(name, options.exclude ?? [])) {
            continue;
        }
        const version = pkg.version ?? '0.0.0';
        const key = `${name}@${version}`;
        if (!packages.has(key)) {
            packages.set(key, {
                name,
                version,
                license,
                homepage: pkg.homepage,
                repository: repositoryUrl(pkg),
                texts: licenseTexts(root),
            });
        }
    }
    // Code-point order, not localeCompare: the output must not depend on the build machine's locale.
    return [...packages.values()].sort((a, b) => compare(a.name, b.name) || compare(a.version, b.version));
}

/** Renders the human-readable notices file. */
export function renderThirdPartyNotices(packages: ThirdPartyPackage[], title = 'this software'): string {
    const rule = '-'.repeat(80);
    const lines = [
        `Third-party software notices for ${title}`,
        '',
        'This software includes the open-source packages listed below. Each is distributed under its own',
        'license, reproduced after its name.',
        '',
    ];
    for (const pkg of packages) {
        lines.push(rule, `${pkg.name} ${pkg.version}`, `License: ${pkg.license}`);
        const url = pkg.repository ?? pkg.homepage;
        if (url) {
            lines.push(`Source: ${url}`);
        }
        lines.push('');
        if (pkg.texts.length === 0) {
            lines.push('The package ships no license file; its declared license is given above.', '');
        }
        for (const text of pkg.texts) {
            lines.push(`${text.file}:`, '', text.content.trimEnd(), '');
        }
    }
    return `${lines.join('\n')}\n`;
}

/** Renders the machine-readable list. */
export function renderThirdPartyLicensesJson(packages: ThirdPartyPackage[]): string {
    return `${JSON.stringify({ packages }, null, 2)}\n`;
}

export interface ThirdPartyLicensesPluginOptions extends CollectThirdPartyLicensesOptions {
    /** Name used in the notices title. Defaults to the bundle's own package name. */
    title?: string;
    /** Output file names, relative to the output directory. */
    noticesFileName?: string;
    jsonFileName?: string;
}

interface EmittedAsset {
    type: 'asset';
    fileName: string;
    source: string;
}

interface BundleChunk {
    type: 'chunk' | 'asset';
    modules?: Record<string, unknown>;
}

interface PluginContext {
    emitFile(file: EmittedAsset): string;
}

/** The subset of the Rollup plugin interface this plugin uses, so it fits Vite, Rolldown and tsdown alike. */
export interface ThirdPartyLicensesPlugin {
    name: string;
    generateBundle(this: PluginContext, options: unknown, bundle: Record<string, BundleChunk>): void;
}

/**
 * Emits THIRD-PARTY-NOTICES.txt and third-party-licenses.json with every npm package whose code is in the
 * generated chunks. Add it to `plugins` in a Vite, Rolldown or tsdown configuration.
 */
export function thirdPartyLicenses(options: ThirdPartyLicensesPluginOptions = {}): ThirdPartyLicensesPlugin {
    return {
        name: 'vertesia:third-party-licenses',
        generateBundle(_outputOptions, bundle) {
            const ids: string[] = [];
            for (const output of Object.values(bundle)) {
                if (output.type === 'chunk' && output.modules) {
                    ids.push(...Object.keys(output.modules));
                }
            }
            const packages = collectThirdPartyLicenses(ids, options);
            const title = options.title ?? readOwnName() ?? 'this software';
            this.emitFile({
                type: 'asset',
                fileName: options.noticesFileName ?? THIRD_PARTY_NOTICES_FILE,
                source: renderThirdPartyNotices(packages, title),
            });
            this.emitFile({
                type: 'asset',
                fileName: options.jsonFileName ?? THIRD_PARTY_LICENSES_FILE,
                source: renderThirdPartyLicensesJson(packages),
            });
        },
    };
}

function readOwnName(): string | undefined {
    const path = join(process.cwd(), 'package.json');
    if (!existsSync(path)) {
        return undefined;
    }
    return (JSON.parse(readFileSync(path, 'utf8')) as PackageJson).name;
}

/** Absolute paths of the inputs of an esbuild metafile, which are relative to the working directory. */
export function resolveMetafileInputs(inputs: Record<string, unknown>, workingDir: string): string[] {
    return Object.keys(inputs).map((input) => (input.startsWith(sep) ? input : join(workingDir, input)));
}
