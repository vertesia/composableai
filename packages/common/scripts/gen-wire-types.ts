/**
 * Generates `src/wire-types.generated.ts` — every `export type X = z.infer<typeof XSchema>` in this
 * package, written out as a plain TypeScript type — and rewrites each such alias to
 * `export type X = Wire.X;` (see `WIRE_ALIAS`). Any other `z.infer<typeof Y>`
 * becomes `Wire.Y`. Later runs read the schema back from the type's name (`XSchema`, also for
 * `XFromSchema` and a helper `XWire`).
 *
 * Why: `z.infer` is resolved by each consumer, not by this package. The emitted `lib/*.d.ts` keeps the
 * alias as written, so every program that touches `ProjectConfiguration` re-runs Zod's generic
 * inference over the whole schema graph (about 18k types and 86k instantiations for that one type).
 * Across composable-ui that was half of all types the checker created. A plain type costs a few
 * hundred.
 *
 * The Zod schemas stay the single source of truth. This script walks them at runtime and emits their
 * output type, referencing another generated type by name wherever a schema is shared, and a
 * `z.enum(SomeEnum)` by the enum it wraps. `src/wire-types.generated.test.ts` (written alongside)
 * asserts, at compile time, that every generated type is identical to the `z.infer` it
 * replaces, so a schema edit without a regenerate fails `typecheck:test`.
 *
 * A schema this walker cannot express faithfully (an anonymous recursive `z.lazy`, a transform) keeps
 * its `z.infer` alias: the fallback is correctness-preserving, only slower for consumers.
 *
 * Run through `tsx` and imports `../src`, like `gen-api-components.ts`. Run `pnpm run gen:schemas`
 * after editing any schema.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

type AnySchema = { _zod: { def: { type: string }; optout?: string } };

/** The parts of a Zod v4 `def` the emitter reads; which ones are set depends on `type`. */
interface ZodDef {
    type: string;
    innerType: AnySchema;
    element: AnySchema;
    items: AnySchema[];
    rest: AnySchema | null;
    options: AnySchema[];
    left: AnySchema;
    right: AnySchema;
    keyType: AnySchema;
    valueType: AnySchema;
    out: AnySchema;
    shape: Record<string, AnySchema>;
    catchall?: AnySchema;
    partial?: boolean;
    entries: Record<string, string | number>;
    values: unknown[];
    getter: () => AnySchema;
}

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const OUTPUT = join(SRC, 'wire-types.generated.ts');
const TEST_OUTPUT = join(SRC, 'wire-types.generated.test.ts');
const OUTPUT_MODULE = './wire-types.generated.js';

/** `export type X = z.infer<typeof Y>` and `z.infer<typeof import('./m.js').Y>`, on one or more lines. */
const ALIAS =
    /export\s+type\s+(\w+)\s*=\s*z\.(?:infer|output)<\s*typeof\s+(?:import\(\s*'([^']+)'\s*\)\.)?(\w+)\s*>\s*;/g;

/**
 * `export type X = Wire.X;` — the form this script rewrites every `z.infer` alias into. It collapses to
 * the generated declaration, so a consumer's emitted `.d.ts` names it through the
 * `@vertesia/common/wire-types` subpath export, and the alias's doc comment is copied onto it.
 * (A per-name `export type { X } from` would keep the root name, but Biome's import organizer merges
 * those into one block and strands each doc comment.)
 */
const WIRE_ALIAS = /export\s+type\s+(\w+)\s*=\s*Wire\.(\w+)\s*;/g;

/** Any other `z.infer<typeof Y>` (a module-private `type YWire = ...`, an `Omit<z.infer<...>>`). */
const INLINE_INFER = /z\.(?:infer|output)<\s*typeof\s+(?:import\(\s*'([^']+)'\s*\)\.)?(\w+)\s*>/g;

/** A `Wire.X` reference that is not an alias: a helper named after an exported schema. */
const WIRE_REF = /\bWire\.(\w+)\b/g;

/** Whether offset `at` of `text` is on a comment line (a JSDoc `*` or a `//`), which is left alone. */
function inComment(text: string, at: number): boolean {
    return /^\s*(?:\*|\/\/)/.test(text.slice(text.lastIndexOf('\n', at) + 1, at));
}

/** The `/** ... *\/` comment ending right before offset `at`, if any. */
function docBefore(text: string, at: number): string {
    const before = text.slice(0, at).trimEnd();
    if (!before.endsWith('*/')) return '';
    const start = before.lastIndexOf('/**');
    return start < 0 ? '' : before.slice(start);
}

/**
 * The schema a `Wire.X` type is generated from: `XSchema`, also for an alias named `XFromSchema` and a
 * helper named `XWire` (the name taken when `X` already names something else in this package).
 */
function schemaNameFor(typeName: string): string {
    return `${typeName.replace(/FromSchema$|Wire\d*$/, '')}Schema`;
}

/** How module `file` imports the generated file. */
function outputSpecifier(file: string): string {
    const specifier = relative(dirname(join(SRC, file)), OUTPUT)
        .split('\\')
        .join('/')
        .replace(/\.ts$/, '.js');
    return specifier.startsWith('.') ? specifier : `./${specifier}`;
}

interface Alias {
    name: string;
    /** Module (src-relative, `.ts`) whose alias line this is. */
    file: string;
    /** Module (src-relative, `.ts`) exporting the schema value. */
    schemaFile: string;
    schemaExport: string;
    schema?: AnySchema;
    /** The alias's doc comment, carried onto the generated declaration. */
    doc: string;
}

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(path);
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) return [];
        if (entry.name.endsWith('.test.ts') || entry.name.includes('.generated.')) return [];
        return [path];
    });
}

function toSrcRelative(file: string): string {
    return relative(SRC, file).split('\\').join('/');
}

function resolveImport(fromFile: string, specifier: string): string {
    return toSrcRelative(join(dirname(join(SRC, fromFile)), specifier.replace(/\.js$/, '.ts')));
}

function isSchema(value: unknown): value is AnySchema {
    return typeof value === 'object' && value !== null && '_zod' in value;
}

function isEnumLike(value: unknown): value is Record<string, string | number> {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || isSchema(value)) return false;
    const values = Object.values(value);
    return values.length > 0 && values.every((v) => typeof v === 'string' || typeof v === 'number');
}

/** src-relative `.ts` path -> the specifier the generated file imports it by. */
function specifierFor(file: string): string {
    return `./${file.replace(/\.ts$/, '.js')}`;
}

/**
 * Packages whose schemas this package embeds. A schema is read from `schemas` and referenced by the
 * type of the same name exported from `types` (the browser-safe barrel consumers already import).
 */
const EXTERNAL_PACKAGES = [
    {
        schemas: '@llumiverse/common/schemas',
        types: '@llumiverse/common',
        // Hand-written interfaces that `z.infer` of their schema is assignable to but not identical with
        // (`ToolDefinition.input_schema` spells out optional keys the `looseObject` leaves open). These
        // are written out structurally instead.
        inline: new Set(['ToolDefinitionSchema']),
    },
];

/** Names a declared `z.ZodType<T>` can use without an import. */
const BUILTIN_TYPE_NAMES = new Set([
    'string',
    'number',
    'boolean',
    'bigint',
    'symbol',
    'null',
    'undefined',
    'unknown',
    'any',
    'never',
    'object',
    'Record',
    'Partial',
    'Required',
    'Readonly',
    'Pick',
    'Omit',
    'Exclude',
    'Extract',
    'NonNullable',
    'Array',
    'ReadonlyArray',
    'Date',
    'keyof',
    'typeof',
]);

/**
 * Where each type name a module can see comes from: its named imports (relative ones rewritten for
 * the generated file) and its own exported declarations.
 */
function moduleTypeScope(file: string, text: string): Map<string, string> {
    const scope = new Map<string, string>();
    for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)) {
        const specifier = m[2].startsWith('.') ? specifierFor(resolveImport(file, m[2])) : m[2];
        for (const part of m[1].split(',')) {
            const name = part
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/)
                .pop();
            if (name) scope.set(name, specifier);
        }
    }
    for (const m of text.matchAll(/export\s+(?:declare\s+)?(?:const\s+)?(?:enum|type|interface|class)\s+(\w+)/g)) {
        scope.set(m[1], specifierFor(file));
    }
    return scope;
}

/** A workspace package's `src` directory, found from its resolved `lib` entry point. */
function packageSourceDir(specifier: string): string {
    return join(dirname(fileURLToPath(import.meta.resolve(specifier))), '..', 'src');
}

/** Type names a package's declaration files export (`interface X`, `type X`, `export type { X }`). */
function declaredTypeNames(specifier: string): Set<string> {
    const libDir = dirname(fileURLToPath(import.meta.resolve(specifier)));
    const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) return walk(path);
            return entry.name.endsWith('.d.ts') ? [path] : [];
        });
    const names = new Set<string>();
    for (const file of walk(libDir)) {
        const text = readFileSync(file, 'utf8');
        for (const m of text.matchAll(/\b(?:interface|type)\s+(\w+)/g)) names.add(m[1]);
        for (const m of text.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
            for (const part of m[1].split(',')) {
                const name = part
                    .trim()
                    .split(/\s+as\s+/)
                    .pop();
                if (name) names.add(name);
            }
        }
    }
    return names;
}

/**
 * A map keyed by a schema's `def`, not its instance. `.meta()` and `.describe()` return a clone that
 * shares the def, so `AgentSearchScopeSchema.meta({ description })` is still `AgentSearchScope`.
 */
class DefMap<V> {
    private readonly map = new Map<object, V>();
    get(schema: AnySchema): V | undefined {
        return this.map.get(schema._zod.def);
    }
    has(schema: AnySchema): boolean {
        return this.map.has(schema._zod.def);
    }
    set(schema: AnySchema, value: V): void {
        this.map.set(schema._zod.def, value);
    }
    values(): IterableIterator<V> {
        return this.map.values();
    }
}

const sameDef = (a: AnySchema, b: AnySchema): boolean => a._zod.def === b._zod.def;

class Unsupported extends Error {}

/** Hit a cycle through `schema`, which has no alias of its own: it needs a named helper type. */
class NeedsName extends Error {
    constructor(readonly schema: AnySchema) {
        super('anonymous recursive schema');
    }
}

async function main() {
    const files = sourceFiles(SRC).map(toSrcRelative).sort();

    const aliases: Alias[] = [];
    const inlineRefs: { file: string; schemaFile: string; schemaExport: string }[] = [];
    const wireRefs: { file: string; name: string }[] = [];
    for (const file of files) {
        const text = readFileSync(join(SRC, file), 'utf8');
        // In source order whatever form each alias is in, so the generated file does not reorder.
        const fileAliases: (Alias & { at: number })[] = [];
        for (const m of text.matchAll(ALIAS)) {
            if (m[3] !== schemaNameFor(m[1])) {
                throw new Error(
                    `${file}: ${m[1]} must be named after its schema (${m[3]} -> ${m[3].replace(/Schema$/, '')})`,
                );
            }
            fileAliases.push({
                name: m[1],
                file,
                schemaFile: m[2] ? resolveImport(file, m[2]) : '',
                schemaExport: m[3],
                doc: docBefore(text, m.index),
                at: m.index,
            });
        }
        for (const m of text.matchAll(WIRE_ALIAS)) {
            if (m[1] !== m[2]) throw new Error(`${file}: ${m[1]} must alias Wire.${m[1]}, not Wire.${m[2]}`);
            fileAliases.push({
                name: m[1],
                file,
                schemaFile: '',
                schemaExport: schemaNameFor(m[1]),
                doc: docBefore(text, m.index),
                at: m.index,
            });
        }
        aliases.push(...fileAliases.sort((a, b) => a.at - b.at).map(({ at: _at, ...alias }) => alias));
        const rest = text.replace(ALIAS, '').replace(WIRE_ALIAS, '');
        for (const m of rest.matchAll(INLINE_INFER)) {
            if (inComment(rest, m.index)) continue;
            inlineRefs.push({ file, schemaFile: m[1] ? resolveImport(file, m[1]) : file, schemaExport: m[2] });
        }
        for (const m of rest.matchAll(WIRE_REF)) {
            if (!inComment(rest, m.index)) wireRefs.push({ file, name: m[1] });
        }
    }

    // Load every module once. Barrels come last so a value's defining module wins the name lookup.
    const modules = new Map<string, Record<string, unknown>>();
    const ordered = [...files].sort((a, b) => Number(a.endsWith('index.ts')) - Number(b.endsWith('index.ts')));
    for (const file of ordered) {
        modules.set(file, (await import(pathToFileURL(join(SRC, file)).href)) as Record<string, unknown>);
    }

    // Resolve each alias to its schema value. An unqualified `typeof Y` names a local or an import of
    // the alias's own module; the module namespace exposes only exports, so fall back to any module
    // exporting that name (schema export names are unique in this package).
    const schemaExports = new Map<string, AnySchema>();
    const schemaExportFile = new Map<string, string>();
    for (const [file, exports] of modules) {
        for (const [key, value] of Object.entries(exports)) {
            if (isSchema(value) && !schemaExports.has(key)) {
                schemaExports.set(key, value);
                schemaExportFile.set(key, file);
            }
        }
    }
    for (const alias of aliases) {
        const own = modules.get(alias.schemaFile || alias.file)?.[alias.schemaExport];
        if (isSchema(own)) {
            alias.schema = own;
            alias.schemaFile ||= alias.file;
        } else {
            // Imported into the alias's module rather than exported from it: use the defining module.
            alias.schema = schemaExports.get(alias.schemaExport);
            alias.schemaFile = schemaExportFile.get(alias.schemaExport) ?? '';
        }
        if (!alias.schema)
            throw new Error(`${alias.file}: cannot resolve schema ${alias.schemaExport} for ${alias.name}`);
    }

    // A schema shared by several aliases is emitted once, under the first alias; the rest point at it.
    const primaryName = new DefMap<string>();
    for (const alias of aliases) {
        if (alias.schema && !primaryName.has(alias.schema)) primaryName.set(alias.schema, alias.name);
    }

    // Exported schemas with no alias. One on a recursive cycle becomes a named helper type.
    const exportNames = new DefMap<string>();
    for (const [name, schema] of schemaExports) {
        if (!primaryName.has(schema) && !exportNames.has(schema)) exportNames.set(schema, name);
    }
    // A helper must not reuse a name the generated file imports or a module exports as a type.
    const takenNames = new Set([
        ...aliases.map((a) => a.name),
        ...[...modules.values()].flatMap((m) => Object.keys(m)),
        ...files.flatMap((file) =>
            [...readFileSync(join(SRC, file), 'utf8').matchAll(/export\s+(?:type|interface)\s+(\w+)/g)].map(
                (m) => m[1],
            ),
        ),
    ]);
    const helpers: { name: string; schema: AnySchema }[] = [];
    const addHelper = (schema: AnySchema): string => {
        const base = (exportNames.get(schema) as string).replace(/Schema$/, '');
        let name = takenNames.has(base) ? `${base}Wire` : base;
        for (let i = 2; takenNames.has(name); i++) name = `${base}Wire${i}`;
        takenNames.add(name);
        primaryName.set(schema, name);
        helpers.push({ name, schema });
        return name;
    };

    // Enum-like objects (TS enums, `as const` maps) passed to `z.enum`, by identity: this package's own,
    // then those of the packages it embeds schemas from.
    const enumRefs = new Map<object, { name: string; specifier: string }>();
    const enumsByName = new Map<string, { value: Record<string, string | number>; specifier: string }>();
    const addEnum = (key: string, value: unknown, specifier: string) => {
        if (!isEnumLike(value)) return;
        if (!enumRefs.has(value)) enumRefs.set(value, { name: key, specifier });
        if (!enumsByName.has(key)) enumsByName.set(key, { value, specifier });
    };
    for (const [file, exports] of modules) {
        for (const [key, value] of Object.entries(exports)) addEnum(key, value, specifierFor(file));
    }
    for (const pkg of EXTERNAL_PACKAGES) {
        for (const [key, value] of Object.entries(await import(pkg.types))) addEnum(key, value, pkg.types);
    }

    // `z.literal(ApiKeyTypes.secret)` infers `ApiKeyTypes.secret`, but at runtime it is just `'sk'`, the
    // same as a plain `z.literal('sk')`. The sources say which is which, per site: an exported literal
    // schema is matched by identity, an inline one by its property key and value. A site this misreads
    // fails the generated test rather than shipping a wrong type.
    type MemberRef = { name: string; member: string; specifier: string };
    const literalBySchema = new DefMap<MemberRef>();
    const literalByKey = new Map<string, MemberRef>();
    const memberRef = (enumName: string, member: string): [MemberRef, string | number] | undefined => {
        const target = enumsByName.get(enumName);
        const value = target?.value[member];
        return target && value !== undefined
            ? [{ name: enumName, member, specifier: target.specifier }, value]
            : undefined;
    };
    const LITERAL = String.raw`z\s*\.literal\(\s*([A-Z]\w*)\.(\w+)\s*\)`;
    const literalSources = [SRC, ...EXTERNAL_PACKAGES.map((pkg) => packageSourceDir(pkg.types))];
    const externalSchemaExports = new Map<string, AnySchema>();
    for (const pkg of EXTERNAL_PACKAGES) {
        for (const [key, value] of Object.entries(await import(pkg.schemas))) {
            if (isSchema(value)) externalSchemaExports.set(key, value);
        }
    }
    for (const dir of literalSources) {
        for (const file of sourceFiles(dir)) {
            const text = readFileSync(file, 'utf8');
            for (const m of text.matchAll(new RegExp(String.raw`export\s+const\s+(\w+)\s*=\s*${LITERAL}`, 'g'))) {
                const schema = schemaExports.get(m[1]) ?? externalSchemaExports.get(m[1]);
                const ref = memberRef(m[2], m[3]);
                if (schema && ref) literalBySchema.set(schema, ref[0]);
            }
            for (const m of text.matchAll(new RegExp(String.raw`(\w+)\s*:\s*${LITERAL}`, 'g'))) {
                const ref = memberRef(m[2], m[3]);
                if (ref) literalByKey.set(`${m[1]}\0${ref[1]}`, ref[0]);
            }
        }
    }

    // Schemas imported from other packages, referenced by the type each package exports beside them
    // (`XSchema` -> `X`). The generated test proves every such reference equal to what `z.infer` gives.
    const externalNames = new DefMap<{ name: string; specifier: string }>();
    for (const pkg of EXTERNAL_PACKAGES) {
        const exports = (await import(pkg.schemas)) as Record<string, unknown>;
        const declared = declaredTypeNames(pkg.types);
        for (const [key, value] of Object.entries(exports)) {
            const name = key.replace(/Schema$/, '');
            if (pkg.inline.has(key)) continue;
            if (isSchema(value) && name !== key && declared.has(name) && !externalNames.has(value)) {
                externalNames.set(value, { name, specifier: pkg.types });
            }
        }
    }

    // A schema declared `: z.ZodType<T>` or cast `as z.ZodType<T>` infers exactly `T`, whatever it
    // builds at runtime (`z.enum([...]) as z.ZodType<FileProcessingStatus>`). Emit `T`, importing each
    // name in it from wherever the declaring module gets it.
    const declaredType = new DefMap<{ type: string; imports: [string, string][] }>();
    // `z.lazy(() => X) as unknown as z.ZodObject` in a union infers a bare `ZodObject`'s output.
    const bareObjectLazies = new Set<string>();
    const unresolvedDeclarations: string[] = [];
    const anyDeclared = new Map<string, { type: string; imports: [string, string][] }>();
    for (const file of files) {
        const text = readFileSync(join(SRC, file), 'utf8');
        const scope = moduleTypeScope(file, text);
        const declarations = [
            ...text.matchAll(/export\s+const\s+(\w+)\s*:\s*z\.ZodType<([^=]+?)>\s*=/g),
            // The body may not run into the next declaration, or a cast would be credited to the first
            // `export const` above it.
            ...[
                ...text.matchAll(
                    /export\s+const\s+(\w+)\s*=((?:(?!\nexport\s)[\s\S])*?)\bas\s+z\.ZodType<([^;]+?)>\s*;/g,
                ),
            ].map((m) => [m[0], m[1], m[3]] as RegExpMatchArray),
            // A bare `: z.ZodType` (the usual annotation on a self-referential schema) infers `unknown`.
            ...[...text.matchAll(/export\s+const\s+(\w+)\s*:\s*z\.ZodType\s*=/g)].map(
                (m) => [m[0], m[1], 'unknown'] as RegExpMatchArray,
            ),
        ];
        const resolveDeclared = (name: string, text: string) => {
            const type = text.trim();
            const imports: [string, string][] = [];
            for (const [ident] of type.matchAll(/\b[A-Za-z_]\w*\b/g)) {
                if (BUILTIN_TYPE_NAMES.has(ident)) continue;
                const specifier = scope.get(ident);
                if (!specifier) {
                    unresolvedDeclarations.push(`${file}: ${name}: z.ZodType<${type}>`);
                    return undefined;
                }
                imports.push([specifier, ident]);
            }
            return { type, imports };
        };
        for (const m of declarations) {
            const schema = modules.get(file)?.[m[1]];
            if (!isSchema(schema)) continue;
            const declared = resolveDeclared(m[1], m[2]);
            if (declared) declaredType.set(schema, declared);
        }
        // A module-private `const X: z.ZodType<T> = z.any().meta({...})` (an OpenAPI shape Zod cannot
        // express) is unreachable by name, so it is recognised by the meta object it registers.
        for (const m of text.matchAll(
            /(?:^|\n)const\s+(\w+)\s*:\s*z\.ZodType<([^=]+?)>\s*=\s*z\s*\.any\(\)\s*\.meta\((\{[\s\S]*?\})\);/g,
        )) {
            const declared = resolveDeclared(m[1], m[2]);
            if (!declared) continue;
            const key = JSON.stringify(new Function(`return (${m[3]});`)());
            const previous = anyDeclared.get(key);
            if (previous && previous.type !== declared.type) {
                throw new Error(`${file}: ${m[1]} shares its meta with a z.any() declared ${previous.type}`);
            }
            anyDeclared.set(key, declared);
        }
        for (const m of text.matchAll(
            /z\.lazy\(\s*\(\)\s*=>\s*(\w+)\s*\)\s*as\s+unknown\s+as\s+z\.ZodObject\b(?!<)/g,
        )) {
            bareObjectLazies.add(m[1]);
        }
    }

    const typeImports = new Map<string, Set<string>>();
    const addImport = (file: string, name: string) => {
        const set = typeImports.get(file) ?? new Set<string>();
        set.add(name);
        typeImports.set(file, set);
    };

    /** Imports an enum-like value for `typeof`, aliased when a generated type shares its name. */
    const exportedAs = new DefMap<string>();
    for (const [name, schema] of schemaExports) if (!exportedAs.has(schema)) exportedAs.set(schema, name);

    const importEnum = (name: string, specifier: string): string => {
        // `DashboardStatus` can be both the values object and a generated type: alias the value.
        const local = new Set(primaryName.values()).has(name) ? `${name}Values` : name;
        addImport(specifier, local === name ? name : `${name} as ${local}`);
        return local;
    };

    const literal = (value: unknown): string => {
        if (value === undefined) return 'undefined';
        if (typeof value === 'bigint') return `${value}n`;
        return JSON.stringify(value);
    };
    const union = (parts: string[]): string => {
        const unique = [...new Set(parts)];
        return unique.length === 0 ? 'never' : unique.join(' | ');
    };
    /** Parenthesizes a type with a top-level `|` or `&`, so `[]` or `&` binds to the whole of it. */
    const group = (type: string): string => {
        let depth = 0;
        let quote = '';
        for (let i = 0; i < type.length; i++) {
            const c = type[i];
            if (quote) {
                if (c === '\\') i++;
                else if (c === quote) quote = '';
            } else if (c === '"' || c === "'") quote = c;
            else if ('([{<'.includes(c)) depth++;
            else if (')]}>'.includes(c)) depth--;
            else if (depth === 0 && (c === '|' || c === '&')) return `(${type})`;
        }
        return type;
    };
    const key = (name: string): string => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

    /** The TS output type of `schema`. `stack` detects a cycle through schemas with no name yet. */
    const emit = (schema: AnySchema, root: AnySchema, stack: AnySchema[], field?: string): string => {
        const external = externalNames.get(schema);
        if (external) {
            addImport(external.specifier, external.name);
            return external.name;
        }
        const named = primaryName.get(schema);
        // Outside the root, a named schema is a reference; inside it, only a cycle back to the root is.
        if (named && (!sameDef(schema, root) || stack.length > 0)) return named;
        const seen = stack.findIndex((s) => sameDef(s, schema));
        if (seen >= 0) {
            // Name the first exported schema on the cycle; TS expresses recursion only through names.
            const nameable = stack.slice(seen).find((s) => exportNames.has(s) && !primaryName.has(s));
            if (nameable) throw new NeedsName(nameable);
            const cycle = stack.slice(seen).map((s) => {
                const label = exportNames.get(s) ?? primaryName.get(s) ?? s._zod.def.type;
                const shape = s._zod.def.type === 'object' ? (s._zod.def as ZodDef).shape : undefined;
                return shape ? `${label}{${Object.keys(shape).slice(0, 6).join(',')}}` : label;
            });
            throw new Unsupported(`anonymous recursive schema (${cycle.join(' -> ')})`);
        }
        stack.push(schema);
        try {
            return emitDef(schema, root, stack, field);
        } finally {
            stack.pop();
        }
    };

    /** A `z.any()` helper found by its meta; a site's `.meta({ description })` clone chains back to it. */
    const declaredAny = (schema: AnySchema) => {
        for (let s: AnySchema | undefined = schema; s; s = (s._zod as { parent?: AnySchema }).parent) {
            const declared = anyDeclared.get(JSON.stringify(z.globalRegistry.get(s as never)));
            if (declared) return declared;
        }
        return undefined;
    };

    const emitDef = (schema: AnySchema, root: AnySchema, stack: AnySchema[], field?: string): string => {
        const def = schema._zod.def as ZodDef;
        const inner = (s: AnySchema) => emit(s, root, stack);
        // Wrappers keep the property key, so an inline enum-member literal under them is still found.
        const wrapped = (s: AnySchema) => emit(s, root, stack, field);
        const declared = declaredType.get(schema) ?? (def.type === 'any' ? declaredAny(schema) : undefined);
        if (declared) {
            const locals = new Map(declared.imports.map(([specifier, name]) => [name, importEnum(name, specifier)]));
            return declared.type.replace(/\b[A-Za-z_]\w*\b/g, (ident) => locals.get(ident) ?? ident);
        }
        switch (def.type) {
            case 'string':
            case 'number':
            case 'boolean':
            case 'bigint':
            case 'symbol':
            case 'null':
            case 'undefined':
            case 'any':
            case 'unknown':
            case 'never':
                return def.type;
            case 'void':
                return 'void';
            case 'date':
                return 'Date';
            case 'nan':
                return 'number';
            case 'literal':
                return union(
                    (def.values as unknown[]).map((value) => {
                        const ref =
                            literalBySchema.get(schema) ??
                            (field === undefined ? undefined : literalByKey.get(`${field}\0${value}`));
                        if (!ref) return literal(value);
                        const local = importEnum(ref.name, ref.specifier);
                        return `(typeof ${local})[${JSON.stringify(ref.member)}]`;
                    }),
                );
            case 'enum': {
                const ref = enumRefs.get(def.entries);
                if (ref) {
                    const local = importEnum(ref.name, ref.specifier);
                    return `(typeof ${local})[keyof typeof ${local}]`;
                }
                return union(Object.values(def.entries as Record<string, unknown>).map(literal));
            }
            case 'optional':
                return union([wrapped(def.innerType), 'undefined']);
            case 'nullable':
                return union([wrapped(def.innerType), 'null']);
            case 'default':
            case 'prefault':
            case 'catch': {
                // The output of a defaulted schema never includes the `undefined` it replaces.
                const type = wrapped(def.innerType);
                return type === 'undefined' ? 'never' : `Exclude<${type}, undefined>`;
            }
            case 'nonoptional':
                return `Exclude<${wrapped(def.innerType)}, undefined>`;
            case 'readonly':
                return `Readonly<${wrapped(def.innerType)}>`;
            case 'array':
                return `${group(inner(def.element))}[]`;
            case 'tuple': {
                const items = (def.items as AnySchema[]).map(inner);
                if (def.rest) items.push(`...${group(inner(def.rest))}[]`);
                return `[${items.join(', ')}]`;
            }
            case 'union':
                return union(
                    (def.options as AnySchema[]).map((option) => {
                        if (option._zod.def.type === 'lazy') {
                            const target = exportedAs.get((option._zod.def as ZodDef).getter());
                            if (target && bareObjectLazies.has(target)) return 'Record<string, unknown>';
                        }
                        return group(inner(option));
                    }),
                );
            case 'intersection':
                return `${group(inner(def.left))} & ${group(inner(def.right))}`;
            case 'record': {
                const record = `Record<${inner(def.keyType)}, ${inner(def.valueType)}>`;
                return def.partial ? `Partial<${record}>` : record;
            }
            case 'lazy':
                return inner(def.getter());
            case 'pipe':
                return inner(def.out);
            case 'object': {
                const shape = def.shape as Record<string, AnySchema>;
                const lines = Object.entries(shape).map(([name, field]) => {
                    const optional = field._zod.optout === 'optional';
                    return `${key(name)}${optional ? '?' : ''}: ${emit(field, root, stack, name)};`;
                });
                const catchall = def.catchall as AnySchema | undefined;
                if (catchall && catchall._zod.def.type !== 'never') lines.push(`[k: string]: ${inner(catchall)};`);
                return lines.length === 0 ? 'Record<string, never>' : `{\n${lines.join('\n')}\n}`;
            }
            default:
                throw new Unsupported(`zod type '${def.type}'`);
        }
    };

    /** Emits a root, naming each exported schema a cycle runs through until the root resolves. */
    const emitRoot = (schema: AnySchema): string => {
        for (;;) {
            try {
                return emit(schema, schema, []);
            } catch (error) {
                if (!(error instanceof NeedsName)) throw error;
                addHelper(error.schema);
            }
        }
    };

    // Every other `z.infer<typeof Y>` and `Wire.Y` reference needs a generated name for `Y`: its alias's,
    // or a helper's. Resolved before the aliases emit, so they reference the helper too.
    const resolveSchema = (file: string, exportName: string): AnySchema => {
        const own = modules.get(file)?.[exportName];
        const schema = isSchema(own) ? own : schemaExports.get(exportName);
        if (!schema) throw new Error(`${file}: cannot resolve schema ${exportName}`);
        return schema;
    };
    const inlineNames = new Map<string, string>();
    const nameFor = (schema: AnySchema): string => primaryName.get(schema) ?? addHelper(schema);
    for (const ref of inlineRefs) {
        inlineNames.set(
            `${ref.schemaFile}\0${ref.schemaExport}`,
            nameFor(resolveSchema(ref.schemaFile, ref.schemaExport)),
        );
    }
    const aliasNames = new Set(aliases.map((a) => a.name));
    for (const ref of wireRefs) {
        if (aliasNames.has(ref.name)) continue;
        const name = nameFor(resolveSchema(ref.file, schemaNameFor(ref.name)));
        if (name !== ref.name) throw new Error(`${ref.file}: Wire.${ref.name} is now generated as Wire.${name}`);
    }

    const body: string[] = [];
    let usesZod = false;
    const checks: string[] = [];
    const fallbacks: string[] = [];
    const generated = new Set<string>();
    for (const alias of aliases) {
        const schema = alias.schema as AnySchema;
        const primary = primaryName.get(schema) as string;
        let type: string;
        try {
            type = primary === alias.name ? emitRoot(schema) : primary;
        } catch (error) {
            if (!(error instanceof Unsupported)) throw error;
            fallbacks.push(`${alias.name} (${alias.file}): ${error.message}`);
            continue;
        }
        generated.add(alias.name);
        if (alias.doc) body.push(alias.doc);
        body.push(`export type ${alias.name} = ${type};`);
        const schemaModule = specifierFor(alias.schemaFile || alias.file);
        checks.push(
            `    ${alias.name}: Same<W.${alias.name}, z.infer<typeof import('${schemaModule}').${alias.schemaExport}>>;`,
        );
    }

    // Helpers can uncover further cycles, so the list grows while it is walked.
    // A helper that cannot be written out keeps `z.infer` of its exported schema: still correct.
    for (let i = 0; i < helpers.length; i++) {
        const helper = helpers[i];
        let type: string;
        try {
            type = emitRoot(helper.schema);
        } catch (error) {
            if (!(error instanceof Unsupported)) throw error;
            const exportName = exportNames.get(helper.schema) as string;
            const file = schemaExportFile.get(exportName) as string;
            type = `z.infer<typeof import('${specifierFor(file)}').${exportName}>`;
            usesZod = true;
            fallbacks.push(`helper ${helper.name}: ${error.message}`);
        }
        body.push(`export type ${helper.name} = ${type};`);
        if (!type.startsWith('z.infer<')) {
            const exportName = exportNames.get(helper.schema) as string;
            const file = schemaExportFile.get(exportName) as string;
            checks.push(
                `    ${helper.name}: Same<W.${helper.name}, z.infer<typeof import('${specifierFor(file)}').${exportName}>>;`,
            );
            generated.add(helper.name);
        }
    }

    // A fallback alias stays `z.infer` in its own module; generated types that reference it import it.
    for (const alias of aliases) {
        if (!generated.has(alias.name) && body.some((line) => new RegExp(`\\b${alias.name}\\b`).test(line))) {
            addImport(specifierFor(alias.file), alias.name);
        }
    }

    const imports = [...typeImports]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([file, names]) => `import type { ${[...names].sort().join(', ')} } from '${file}';`);

    const header = [
        '// Generated by scripts/gen-wire-types.ts from the Zod schemas in this package. Do not edit.',
        '// Run `pnpm run gen:schemas` after changing a schema.',
        '',
    ];
    if (usesZod) imports.unshift("import type { z } from 'zod';");
    writeFileSync(OUTPUT, [...header, ...imports, '', ...body, ''].join('\n'));
    writeFileSync(
        TEST_OUTPUT,
        [
            ...header,
            "import { describe, expect, it } from 'vitest';",
            "import type { z } from 'zod';",
            `import type * as W from '${OUTPUT_MODULE}';`,
            '',
            '// Identical types, the same test `expectTypeOf().toEqualTypeOf()` uses: a nested `any` or a',
            '// widened member fails it. A schema edited without a regenerate fails `typecheck:test` on the',
            '// entry for the type that drifted: `true` is not assignable to `false`.',
            'type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;',
            '',
            'interface Checks {',
            ...checks,
            '}',
            '',
            'const checks: Checks = {',
            ...[...generated].map((name) => `    ${name}: true,`),
            '};',
            '',
            "describe('wire-types.generated', () => {",
            "    it('asserts every generated type against its schema', () => {",
            `        expect(Object.keys(checks)).toHaveLength(${generated.size});`,
            '    });',
            '});',
            '',
        ].join('\n'),
    );

    // Point each generated `z.infer` alias at its generated type, so the published `.d.ts` carries no
    // Zod inference. The alias stays where it was, under its doc comment.
    const rewritten: string[] = [];
    for (const file of files) {
        const path = join(SRC, file);
        const text = readFileSync(path, 'utf8');
        let next = text.replace(ALIAS, (line, name: string) =>
            generated.has(name) ? `export type ${name} = Wire.${name};` : line,
        );
        next = next.replace(
            INLINE_INFER,
            (ref, specifier: string | undefined, schemaExport: string, at: number, all: string) => {
                if (inComment(all, at)) return ref;
                const name = inlineNames.get(`${specifier ? resolveImport(file, specifier) : file}\0${schemaExport}`);
                return name && generated.has(name) ? `Wire.${name}` : ref;
            },
        );
        if (next === text) continue;
        if (!/^import\s+type\s+\*\s+as\s+Wire\s+from\s/m.test(next)) {
            const imports = [...next.matchAll(/^import\s[\s\S]*?\sfrom\s+'[^']+';[^\S\n]*$/gm)];
            const at = imports.length ? (imports.at(-1)?.index ?? 0) + (imports.at(-1)?.[0].length ?? 0) : 0;
            const line = `import type * as Wire from '${outputSpecifier(file)}';`;
            next = at ? `${next.slice(0, at)}\n${line}${next.slice(at)}` : `${line}\n${next}`;
        }
        writeFileSync(path, next);
        rewritten.push(file);
    }

    // The schemas and `z` a rewritten module imported only for `z.infer` are now unused. Then the same
    // `biome check --write` the pre-commit hook runs, so committing does not rewrite what this wrote.
    // Diagnostics reach the terminal: a check that cannot fix everything fails the run.
    const biome = (args: string[], paths: string[]) =>
        execFileSync('pnpm', ['exec', 'biome', ...args, ...paths], {
            stdio: ['ignore', 'ignore', 'inherit'],
        });
    const rewrittenPaths = rewritten.map((file) => join(SRC, file));
    if (rewrittenPaths.length)
        biome(['lint', '--only=correctness/noUnusedImports', '--write', '--unsafe'], rewrittenPaths);
    biome(['check', '--write'], [OUTPUT, TEST_OUTPUT, ...rewrittenPaths]);

    console.log(
        `Wrote ${generated.size} types + ${helpers.length} helpers to ${toSrcRelative(OUTPUT)} ` +
            `(${fallbacks.length} kept as z.infer); pointed ${rewritten.length} modules at it`,
    );
    for (const f of fallbacks) console.log(`  z.infer kept: ${f}`);
    for (const d of unresolvedDeclarations) console.log(`  declared type not resolvable, walked instead: ${d}`);
}

await main();
