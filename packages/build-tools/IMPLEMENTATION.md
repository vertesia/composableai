# @vertesia/build-tools — Implementation Notes

Design and internals. For usage, see [README.md](./README.md).

## Overview

A post-`tsc` import transformer. It reads the JavaScript `tsc` has already emitted into `libDir`,
replaces Vertesia query-style import specifiers (`?skill`, `?raw`, …) with generated sibling
modules, and rewrites the importing files in place.

The unit of work is a *file already on disk*, not a module graph. That is the whole design
constraint, and it is what makes the package independent of any bundler.

## Why post-`tsc`

This package began as a Rollup plugin (`vertesiaImportPlugin`) built on the `resolveId` / `load`
hooks, in a package called `rollup-plugin-imports`. That coupled every consumer to Rollup, at a
point where the repo was standardizing on Rolldown and several consumers (`studio-server`,
`workflows`) do not bundle their libraries at all — they publish or consume `tsc` output directly
and bundle later, or bundle with webpack via Temporal's workflow bundler.

Rewriting it as a standalone step decoupled the transformation from the bundler entirely: consumers
run `tsc && vertesia-build`, and whatever consumes `lib/` afterwards — Rolldown, webpack, esbuild,
Node itself — sees ordinary ESM.

Two traces of the original remain deliberately. The generated chunk format is byte-compatible with
what the old `load()` hook produced, so the runtime behavior of transformed builds did not change
across the migration; and the recursive re-scan reproduces Rollup's recursive `resolveId`/`load`
behavior, which collection chunks depend on. Both are noted in the source where they matter.

## Package structure

```text
src/
├── bin/
│   ├── build.ts               # `vertesia-build` CLI entry point
│   └── config.ts              # pure package.json config parsing
├── core/
│   ├── compilers/widget.ts    # esbuild widget bundler
│   ├── parsers/frontmatter.ts # YAML frontmatter splitter (js-yaml)
│   ├── skill-markdown/
│   │   ├── preprocess.ts      # {@tool}/{@skill}/tool= resolver — pure
│   │   └── schema-validator.ts# AJV + dispatcher-field validation
│   ├── transformers/          # skill, skills, template, templates, prompt, raw
│   ├── utils/                 # asset discovery + copying
│   └── types.ts               # TransformerRule, TransformResult, AssetFile
├── import-transform/          # the pipeline (see below)
├── vite/                      # dev-server + api-server plugins
└── index.ts                   # public exports
```

## The pipeline

`import-transform/` is one module per stage, orchestrated by `index.ts`:

| Module | Responsibility |
| ------ | -------------- |
| `patterns.ts` | `SNIFF_PATTERN` — a coarse regex pre-filter, explicitly *not* a decision procedure. |
| `scanner.ts` | Walk `libDir`, return `.js` files whose contents match the sniff, with content captured. |
| `detector.ts` | Lex a file and return the specifiers that match a transformer, with quote offsets. |
| `resolver.ts` | Map a specifier to its `srcDir` asset, its chunk path, and the replacement specifier. |
| `chunk-emitter.ts` | Run the transformer, validate, write the chunk. |
| `rewriter.ts` | Splice replacement specifiers over the original quoted ranges. |
| `builtins.ts` | Name → `TransformerRule` registry for the CLI and the Vite plugin. |

### Path mapping

`libDir` and `srcDir` are mirror trees, so `<libDir>/<rel>` ↔ `<srcDir>/<rel>`. A chunk is written
at the resolved lib path plus `.js`:

```text
import skill from './skills/code-review.md?skill';   // in lib/index.js
    source asset   src/skills/code-review.md
    chunk written  lib/skills/code-review.md.js
    rewritten to   './skills/code-review.md.js'
```

Appending rather than replacing the extension keeps the chunk name unambiguous: `foo.md` and
`foo.jst` cannot collide, and the original asset name stays readable in a stack trace.

### Detection uses a real lexer

`detector.ts` lexes with `es-module-lexer` rather than matching quoted strings with a regex. This
is not a refactor for elegance — the regex was wrong in a way that broke a build. It matched
anything shaped like a specifier, including a doc comment that mentioned `` `?skill` `` (which
resolved to a directory and failed with `EISDIR`) and ordinary constants such as
`const example = './example/SKILL.md'`, which became phantom imports.

An intermediate fix — stripping comments before matching — was rejected, correctly: it amounts to
writing an incomplete JavaScript lexer, and it still mishandled comments inside template
interpolations, regex literals following a keyword, and the plain-constant case, which is not a
comment problem at all. Lexing the module handles comments, template literals, regex literals,
static imports, `export … from` and dynamic `import()` in one pass, and still yields the offsets
the rewriter needs.

One wrinkle the lexer imposes: it reports specifiers *without* surrounding quotes for static
imports but *with* them for dynamic ones. `quoteBounds()` normalizes this so the rewriter has a
single convention; a dynamic import with a computed specifier yields no bounds and is skipped.

### Fail-closed behavior

A file reaches the detector only because it already matched the sniff — it contains a marker. So a
lexer failure means a real import may be left untransformed and the raw specifier would ship to the
runtime. `detectQueryImports` therefore does not catch parse errors, and `transformImports`
annotates them with the file path:

```text
Failed to parse imports in /abs/path/lib/foo.js: Parse error @:12:5
```

The same principle governs the skill preprocessor (below): every failure mode stops the build.

### Recursion

Emitted chunks are re-scanned with `SNIFF_PATTERN` and queued if they match. This is what makes
collection transformers work: `./all?skills` emits a chunk containing
`import Skill_foo from './foo/SKILL.md';` lines, which are themselves transform targets. `seenFiles`
and `emittedChunks` guard against reprocessing.

## Transformers

A `TransformerRule` is a `pattern` plus a `transform` function, with optional `schema` (Zod,
validated in the emitter), `virtual` (no file to read), and `options`.

`TransformResult.code` lets a transformer emit arbitrary module source instead of a JSON default
export. Three built-ins rely on it: both collections generate import lists, and the skill
transformer switches to custom code when a `properties.ts` is present, emitting

```javascript
import properties from './properties.js';
// guard: isEnabled must be a function
const skill = { … };
export default { ...skill, ...properties };
```

so the merge happens at runtime. `properties.ts` is compiled to `properties.js` by `tsc` in the
step before this one — the pipeline never compiles TypeScript itself.

The skill transformer validates twice: frontmatter against a **strict** schema (unknown key ⇒
error) before transformation, and the built definition against `SkillDefinitionSchema`
(passthrough, so `properties.ts` additions survive) in the emitter.

## Skill Markdown preprocessing

`core/skill-markdown/preprocess.ts` resolves `{@tool x}`, `{@skill x}` and ` ```json tool=x `
fences in skill bodies.

**The module is pure.** It reads no files, imports no registry, and never inspects Git. It receives
a catalog — sets of known tool and skill names, plus an optional `validateExample` callback — and
returns `{ markdown, references, examples, errors }`. `assertSkillMarkdown` is the thin fail-closed
wrapper that throws once, listing every problem.

That purity is deliberate. The tools live in the consuming packages' registries; a transformer that
went looking for one would couple this package to whichever package happens to own it, and would
have to pick a winner when several do. Instead `vertesia-build` loads the module named by
`vertesia-build.skillCatalog` and passes the result in.

Design points worth knowing:

- **Ambiguity is an error, not a resolution.** A name defined by two providers is passed in via
  `ambiguousTools` / `ambiguousSkills` and any unqualified reference to it fails. Silently binding
  to whichever definition won is the exact failure the construct exists to prevent.
- **Every `tool=` fence is validated.** A tagged example against a tool with no available schema
  (`unvalidatableTools`) is an error rather than a pass — otherwise the tag would advertise a check
  that never ran.
- **`{@tool}` is not a naming indirection.** It renders to the plain name in backticks. Its value
  is the fail-closed check and consistent rendering, not centralizing where names are written.
- **Catalog-less builds fail on use.** If a body uses any construct and no catalog is configured,
  the transformer throws instead of emitting the raw construct into the instructions.

`schema-validator.ts` holds the semantic engine shared with the repo's skill auditor:
`createSchemaExampleValidator` (AJV, configured `{ allErrors: true, coerceTypes: true, strict:
false }` to mirror the runtime) plus the dispatcher primitives — `nodesAtPath`, `toolNamesAtPath`,
`schemaNodeAtPath`, `checkDispatchDescriptor`, `resolveDispatchedNames`, `pairDispatchedInputs`.
Dispatcher fields are parameters typed `string` that carry another tool's name
(`batch_execute.tool_name`, `launch_workstream.allowed_tools[]`); JSON Schema is structurally blind
to them, so the relation is declared as a `ToolDispatchDescriptor` (`{ field, inputField?, deny? }`)
beside the tool's `params` and checked here.

### Transformer identity

The CLI swaps the configured skill transformer for one bound to the loaded catalog. It matches by a
`Symbol.for('@vertesia/build-tools:skillTransformer')` marker (`isSkillTransformer`), not by
`pattern.source` — pattern matching would also silently replace a consumer's own transformer
registered for the same files. If nothing matches while `skillCatalog` is set, the build fails
rather than proceeding with an unbound transformer.

## Widget compilation

`.tsx` files beside a `SKILL.md` are discovered, tracked in `skill.widgets`, and bundled with
**esbuild** into `{assetsDir}/{widgetsDir}/`. The entry point is the `tsc`-compiled `.js`, not the
`.tsx` source (`mapSrcWidgetToLib`). esbuild is the only bundler this package uses, and only here.

Both asset copying and widget compilation are skipped when `assetsDir` is `false`, which is how
`workflows` and `studio-server` are configured.

## Vite dev path

`vite/dev-server.ts` applies the same transformer set through Vite's `resolveId` + `load` hooks, so
a source file behaves identically under `vite dev` and under `tsc && vertesia-build`. Asset copying
and widget bundling are build-time concerns and are not performed. `vite/api-server.ts` layers a
Hono tool server onto it as `/api` middleware.

Vite and `@hono/node-server` are **optional peer dependencies** — the CLI path never loads them.

## Configuration

Parsing lives in `bin/config.ts`, separate from the CLI, so it is unit-testable without spawning a
process. `resolveConfig` is pure and total: it validates every field and throws
`VertesiaBuildConfigError`, which `build.ts` translates into `process.exit(1)`.

`resolveSkillCatalogPath` is kept separate from `resolveConfig` precisely because loading the
catalog is asynchronous I/O, and `resolveConfig` is meant to stay pure.

## Testing

14 files, 143 tests (`pnpm test`), all unit-level — no fixture builds are spawned.

| Area | Files |
| ---- | ----- |
| Pipeline | `detector`, `import-transform`, `import-transform-units`, `builtins` |
| Transformers | `skill`, `skill-assets`, `prompt`, `raw` |
| Skill Markdown | `skill-markdown` (35 tests: rendering, every fail-closed path, mutation cases) |
| Support | `frontmatter`, `asset-discovery`, `bin-config`, `widget-compiler`, `dev-server` |

Coverage of the preprocessor is verified by mutation rather than by assertion count: known-bad
inputs (an unknown tool name, a payload with a wrong field name under a `tool=` tag) must fail, and
tests assert the failure, so a regression that weakens a check is caught.

## Dependencies

| Package | Used for |
| ------- | -------- |
| `js-yaml` | Frontmatter parsing. |
| `zod` | Transformer output schemas, validated in the emitter. |
| `ajv` | Tagged-example validation, mirroring the agent runtime's config. |
| `es-module-lexer` | Import detection. |
| `esbuild` | Widget bundling. |
| `vite`, `@hono/node-server` | Optional peers, dev path only. |

No bundler is used to build this package: `build` is `clean:lib && tsc -p tsconfig.json && chmod +x
./lib/bin/build.js`.

## License

Apache-2.0 — part of the Vertesia LLM Studio monorepo,
<https://github.com/vertesia/composableai> (`packages/build-tools`).
