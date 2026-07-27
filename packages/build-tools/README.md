# @vertesia/build-tools

Custom import syntaxes for Vertesia packages — `?skill`, `?skills`, `?template`, `?templates`,
`?prompt`, `?raw`, and bare `SKILL.md` / `TEMPLATE.md` — resolved at build time into real
JavaScript modules, with schema validation.

Ships three entry points:

| Entry point | Used for |
| ----------- | -------- |
| `vertesia-build` CLI | Build-time. Runs as a post-`tsc` step over the emitted `lib/`. |
| `@vertesia/build-tools/vite` | Dev-time. Same transformers applied to sources at request time. |
| `@vertesia/build-tools` | Programmatic. `transformImports()`, the transformers, the skill preprocessor. |

> **Not a bundler plugin.** Earlier versions of this package were a Rollup plugin
> (`vertesiaImportPlugin`). It is now a standalone post-`tsc` transformer: it reads the JavaScript
> `tsc` already emitted, writes generated modules beside it, and rewrites the importing files in
> place. Nothing here depends on Rollup, Rolldown, webpack or Vite at build time — the output is
> plain ESM that any bundler can consume afterwards.

## Installation

```bash
pnpm add -D @vertesia/build-tools
```

## Quick start

Add a `vertesia-build` block to your `package.json` and run the CLI after `tsc`:

```json
{
    "scripts": {
        "build": "tsc -p tsconfig.json && vertesia-build"
    },
    "vertesia-build": {
        "libDir": "./lib",
        "srcDir": "./src",
        "transformers": ["skill", "skills", "raw"],
        "assetsDir": "./dist"
    }
}
```

Then use the import syntaxes in your source:

```typescript
// A single skill, from a Markdown file with YAML frontmatter
import codeReview from './skills/code-review.md?skill';

codeReview.name;          // 'code_review'
codeReview.title;         // 'Code Review Assistant'
codeReview.description;   // 'Reviews a diff for …'
codeReview.instructions;  // the Markdown body
codeReview.content_type;  // 'md' | 'jst'

// Every SKILL.md in the sibling directories, as an array
import allSkills from './skills/all?skills';

// Any file as a string
import template from './template.html?raw';
```

`transformers` is required, so every preset is opted into explicitly and a typo fails the build
rather than silently leaving imports untransformed.

### Vite dev mode

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { vertesiaDevServerPlugin } from '@vertesia/build-tools/vite';

export default defineConfig({
    plugins: [vertesiaDevServerPlugin()],
});
```

Defaults to all built-in transformers; pass `{ transformers: ['skill', 'raw'] }` to restrict the
set. Asset copying and widget bundling are build-time concerns and are skipped in dev.

`apiServerPlugin` from the same entry point mounts a Hono tool server as Vite middleware under
`/api`, with the dev-server plugin already included.

## Transformers

| Name | Matches | Produces |
| ---- | ------- | -------- |
| `skill` | `*.md?skill`, `*/SKILL.md` | `SkillDefinition` object |
| `skills` | `<dir>/<name>?skills` | Array of `SkillDefinition`, one per `SKILL.md` in the subdirectories |
| `template` | `*.md?template`, `*/TEMPLATE.md` | `RenderingTemplateDefinition` |
| `templates` | `<dir>/<name>?templates` | Array of rendering templates |
| `prompt` | `*?prompt` | `PromptDefinition` |
| `raw` | `*?raw` | The file contents as a string |

The two collection transformers are *virtual*: there is no file at `./all?skills`, the name before
the query is simply the generated module's name. That name is required, so two collections in the
same directory cannot collide.

## The skill transformer

### Input

```markdown
---
name: my_skill
title: My Skill
description: A helpful skill
content_type: md
tools: [tool_one, tool_two]
context_triggers:
    keywords: [skill, helper]
---

# My Skill

The instructions the model receives.
```

Frontmatter is validated with a **strict** Zod schema — an unknown key is a build error, not a
silently ignored one. `name` and `description` are required; `content_type` defaults to `md`.

`context_triggers` and `execution` each accept a nested form (as above) or a flat legacy form
(`keywords:`, `tools:`, `data_patterns:` / `language:`, `packages:`, `system_packages:` at the top
level). When `execution` is present, the first fenced code block in the body is extracted as
`execution.template`.

### Output

```typescript
{
    name: 'my_skill',
    title: 'My Skill',
    description: 'A helpful skill',
    instructions: '# My Skill\n\nThe instructions the model receives.',
    content_type: 'md',
    context_triggers: { keywords: ['skill', 'helper'] },
    tools: ['tool_one', 'tool_two'],
    scripts: ['helper.js'],   // present only if discovered
    widgets: ['chart'],       // present only if discovered
}
```

Typed as `SkillDefinition`, exported from the package. The output schema is `passthrough`, so
fields added by `properties.ts` survive validation.

### Asset discovery

Files sitting beside the skill are picked up automatically:

```text
my-skill/
├── SKILL.md         # frontmatter + instructions
├── properties.ts    # runtime properties (optional)
├── helper.js        # → skill.scripts, copied to {assetsDir}/scripts/
└── chart.tsx        # → skill.widgets, bundled to {assetsDir}/{widgetsDir}/
```

`.js` and `.py` files become `scripts` and are copied verbatim. `.tsx` files become `widgets` and
are bundled with esbuild. Both are skipped entirely when `assetsDir` is `false`.

### Runtime properties (`properties.ts`)

For anything that cannot be expressed in YAML — functions, most of all — add a `properties.ts`
next to the `SKILL.md`:

```typescript
// my-skill/properties.ts
import type { ToolUseContext } from '@vertesia/tools-sdk';

export default {
    isEnabled: async (context: ToolUseContext): Promise<boolean> => {
        return context.project?.settings?.myFeature === true;
    },
    description: 'Overrides the frontmatter description',
};
```

The default export is a `Partial<SkillDefinition>` and its properties **override** frontmatter. When
the file exists, the generated chunk imports `./properties.js` — the JavaScript `tsc` emitted from
it — and spreads it over the skill object, so the merge happens at runtime rather than at build
time. A generated guard throws if `isEnabled` is present but is not a function.

## Skill Markdown preprocessing

Skill bodies routinely name tools and other skills, and embed example payloads. Left as prose,
those drift out of sync with the tool definitions they describe and nothing catches it. The
preprocessor makes the references explicit so the build can verify them.

Four constructs, all optional:

| Written | Rendered | Verified |
| ------- | -------- | -------- |
| `{@tool fetch_document}` | `` `fetch_document` `` | tool exists, name unambiguous |
| `{@skill web_search}` | `` `learn_web_search` `` | skill exists, name unambiguous |
| `{@param fetch_document.format}` | `` `format` `` | that tool's schema declares the field |
| ` ```json tool=fetch_document ` | plain ` ```json ` fence | payload validates against the tool's schema |

````markdown
Call {@tool fetch_document} to load the object — {@param fetch_document.format} selects the
representation — then read it with {@skill artifacts}.

```json tool=fetch_document
{ "id": "abc123", "format": "text" }
```
````

A `{@param …}` path is spelled like a `dispatch` descriptor: dots nest and `[]` walks an array, so
`{@param batch_execute.inputs[].input}` resolves. Only the path is rendered.

Everything fails closed: an unknown tool, an ambiguous name, an unterminated `{@`, a `tool=` tag on
a non-JSON fence, a duplicate tag, or a payload the schema rejects all stop the build with the file
and the offending name in the message. Inline code spans and untagged fences are left untouched.

### Wiring the catalog

The preprocessor is pure — it never reads a registry itself. The consuming package names a module
that supplies one:

```json
{
    "vertesia-build": {
        "libDir": "./lib",
        "srcDir": "./src",
        "transformers": ["skill", "skills", "raw"],
        "skillCatalog": "./lib/skill-catalog.js"
    }
}
```

That module exports the catalog (arrays are accepted anywhere a set is):

```typescript
export const tools = new Set(['fetch_document', 'batch_execute']);
export const skills = new Set(['web_search', 'artifacts']);

// Optional
export const ambiguousTools = new Set<string>();     // names with >1 provider — always an error
export const ambiguousSkills = new Set<string>();
export const unvalidatableTools = new Set<string>(); // known, but no schema available here
export const validateExample = createSchemaExampleValidator(entries); // returns string[] of errors
export const validateField = createSchemaFieldValidator(entries);     // resolves {@param …} paths
export const skillToolPrefix = 'learn_';             // default
export const exampleLanguages = new Set(['json']);   // default
```

`createSchemaExampleValidator` (also exported from this package) validates a payload against the
tool's AJV schema, and additionally resolves *dispatcher* fields — a `string` parameter that carries
another tool's name, such as `batch_execute.tool_name` — which JSON Schema alone cannot check.
`createSchemaFieldValidator` walks a `{@param …}` path through the same schemas, descending into
`anyOf`/`oneOf`/`allOf` branches and following local `$ref`s (resolved against the innermost
embedded resource, so a nested `$defs` block wins), and reports the declared fields alongside an
unknown one. A tool with no schema, a tool absent from the entries, and a path crossing an
unresolvable reference are all errors rather than passes; so is a catalog that omits
`validateField` while a skill uses `{@param …}`.

If `skillCatalog` is configured but `skill` is not among the `transformers`, the build fails. If a
skill body uses any of the constructs while **no** catalog is configured, the build also
fails, rather than shipping a raw `{@tool …}` to the model.

## Configuration reference

All paths are resolved relative to the package directory.

| Key | Type | Default | Meaning |
| --- | ---- | ------- | ------- |
| `libDir` | string | *required* | Root of the compiled output to transform. |
| `srcDir` | string | *required* | Root of the sources, mirroring `libDir`. |
| `transformers` | string[] | *required* | Names from the table above. Non-empty. |
| `assetsDir` | string \| false | `libDir` | Where scripts and widgets are emitted; `false` disables both. |
| `widgetsDir` | string | `'widgets'` | Sub-directory of `assetsDir` for widget bundles. |
| `widgetConfig` | object | — | Options forwarded to the esbuild widget bundler, e.g. `{ "minify": true }`. |
| `skillCatalog` | string | — | Module supplying `{ tools, skills, … }` for the preprocessor. |

## Programmatic API

### `transformImports(options)`

Runs the pipeline directly, with the same options as the config block:

```typescript
import { transformImports } from '@vertesia/build-tools';

const result = await transformImports({
    libDir: './lib',
    srcDir: './src',
    transformers: [skillTransformer, rawTransformer],
    assetsDir: './dist',
});
// → { filesProcessed, chunksEmitted, assetsCopied, widgetsCompiled }
```

Note that `transformers` here takes resolved `TransformerRule` objects, not names; use
`resolveTransformerNames()` to go from one to the other.

### `preprocessSkillMarkdown(markdown, options)`

The resolver on its own. Never throws and reads no files — it returns
`{ markdown, references, examples, errors }` so callers decide what to do with problems.
`assertSkillMarkdown(markdown, options, source)` is the fail-closed wrapper that throws once,
listing every problem found.

### Custom transformers

A transformer is a pattern plus a function:

```typescript
import { transformImports } from '@vertesia/build-tools';
import { z } from 'zod';

const InteractionSchema = z.object({
    name: z.string(),
    type: z.enum(['form', 'modal', 'dialog']),
});

await transformImports({
    libDir: './lib',
    srcDir: './src',
    transformers: [
        {
            pattern: /\.interaction\.json$/,
            schema: InteractionSchema,       // optional, validated at build time
            transform: (content, filePath) => ({
                data: { ...JSON.parse(content), source: filePath },
            }),
        },
    ],
});
```

`transform` returns a `TransformResult`:

| Field | Meaning |
| ----- | ------- |
| `data` | Value to export as the module default (serialized to JSON). |
| `code` | Custom module source, used *instead* of the JSON export. |
| `imports` | Extra import lines to inject at the top of the generated module. |
| `assets` | Files to copy into `assetsDir`. |
| `widgets` | Widget entries to bundle. |

Set `virtual: true` on the rule when the specifier does not name a real file, as the collection
transformers do.

## How it works

1. **Scan** — walk `libDir` for `.js` files containing a query-import marker.
2. **Detect** — lex each file with `es-module-lexer` and match the specifiers against the
   transformers. A real lexer rather than a regex, because a regex matches anything that *looks*
   like a specifier: a doc comment mentioning `` `?skill` ``, or a plain constant holding a path,
   were both picked up as imports.
3. **Resolve** — map the specifier back to its source asset under `srcDir`.
4. **Emit** — run the transformer, validate against the rule's Zod schema if it has one, and write
   the generated module as a sibling chunk in `libDir`.
5. **Rewrite** — splice the new chunk's path over the original specifier, in place.
6. **Recurse** — emitted chunks are re-scanned, so a `?skills` collection chunk that imports
   `SKILL.md` siblings is itself transformed.
7. **Finish** — copy discovered assets and bundle discovered widgets with esbuild.

A file that cannot be lexed stops the build with `Failed to parse imports in <file>: …`. It only
reached the queue because it contains a marker, so a swallowed failure would mean a real import
ships untransformed.

## Error handling

Failures name the file and the specific problem. Frontmatter and output-schema failures list every
offending field:

```text
Invalid frontmatter in /abs/src/skills/bad/SKILL.md:
  - description: Invalid input: expected string, received undefined
  - frontmatter: Unrecognized key: "descriptoin"
```

Preprocessor failures are collected and reported together, with line numbers, rather than one per
run:

```text
Skill markdown errors in /abs/src/skills/fetch/SKILL.md:
  - line 12: '{@tool fetch_documnet}' refers to a tool no provider registers
  - line 31: example / must NOT have additional properties ('document_id')
  - line 44: example is tagged 'tool=fetch_document' on a 'bash' fence; only json fences can be validated
```

Configuration failures are prefixed with the CLI name and exit non-zero:

```text
vertesia-build: skillCatalog is configured but "skill" is not in vertesia-build.transformers.
vertesia-build: "vertesia-build.libDir" must be a non-empty string.
```

## License

Apache-2.0

## Repository

<https://github.com/vertesia/composableai> — `packages/build-tools`, part of the Vertesia LLM Studio
monorepo.
