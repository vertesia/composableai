# Asset Management

How `vertesia-build` discovers, copies and bundles the files that sit beside a `SKILL.md` or
`TEMPLATE.md`. This is the detailed reference; [README.md](./README.md) has the short version and
[IMPLEMENTATION.md](./IMPLEMENTATION.md) the pipeline it runs inside.

## Overview

Two kinds of asset are discovered, both non-recursively, both from the directory containing the
Markdown file being transformed:

| Source | Discovered as | Handling |
| ------ | ------------- | -------- |
| `.js`, `.py` beside a `SKILL.md` | `skill.scripts` | Copied verbatim |
| `.tsx` beside a `SKILL.md` | `skill.widgets` | Bundled with esbuild |
| Anything beside a `TEMPLATE.md` except `TEMPLATE.md`, `.ts`, `.js` | template assets | Copied verbatim |

Discovery always runs — the names always land in the skill definition. *Copying and bundling* are
what `assetsDir: false` disables, which is how `workflows` and `studio-server` are configured: they
want `skill.scripts` populated without a `dist/` tree.

## Skill assets

### Layout

```text
skills/my-skill/
├── SKILL.md      # the skill itself
├── properties.ts # runtime properties — not an asset, compiled by tsc
├── helper.js     # → scripts
├── script.py     # → scripts
├── widget.tsx    # → widgets
└── README.md     # ignored
```

### Result

```typescript
import mySkill from './skills/my-skill/SKILL.md';

mySkill.scripts;  // ['helper.js', 'script.py']  — names with extension
mySkill.widgets;  // ['widget']                  — names without extension
```

Both fields are omitted entirely when nothing is discovered, rather than set to `[]`.

### Destinations

```text
{assetsDir}/
├── scripts/
│   ├── helper.js
│   └── script.py
└── {widgetsDir}/
    ├── widget.js
    └── widget.js.map
```

`scripts/` is **fixed**. `discoverSkillAssets()` accepts a `scriptsDir` option, but the skill
transformer never passes one, and there is no `vertesia-build.scriptsDir` config key — so scripts
always land in `{assetsDir}/scripts/`. Only `widgetsDir` is configurable (default `widgets`).

## Widget bundling

Widgets are bundled with **esbuild**, one bundle per widget, in parallel.

The entry point is the **`tsc`-compiled `.js`**, not the `.tsx` source: `tsc` has already run by the
time `vertesia-build` starts, so `mapSrcWidgetToLib()` maps `src/…/widget.tsx` to `lib/…/widget.js`
and hands that to esbuild. No TypeScript or JSX transformation happens here — the bundler is a pure
module concatenator. That is why there is no `tsconfig` or `typescript` option: JSX settings belong
in the package's own `tsconfig.json`.

Fixed esbuild settings: `bundle: true`, `format: 'esm'`, `platform: 'browser'`,
`logLevel: 'silent'`. Output is `{assetsDir}/{widgetsDir}/{name}.js`.

### `widgetConfig`

```json
{
    "vertesia-build": {
        "libDir": "./lib",
        "srcDir": "./src",
        "transformers": ["skill", "skills"],
        "assetsDir": "./dist",
        "widgetsDir": "widgets",
        "widgetConfig": {
            "external": ["react", "react-dom", "react/jsx-runtime", "@vertesia/ui"],
            "minify": true,
            "sourcemap": true
        }
    }
}
```

| Option | Type | Default | Meaning |
| ------ | ---- | ------- | ------- |
| `external` | `string[]` | React family (below) | Packages left as bare imports rather than bundled. |
| `minify` | `boolean` | `false` | esbuild minification. |
| `sourcemap` | `boolean \| 'inline' \| 'external'` | `true` | Source map emission. |

Default externals, used whenever `external` is omitted:

```text
react, react-dom, react/jsx-runtime, react/jsx-dev-runtime, react-dom/client
```

Supplying `external` **replaces** this list rather than extending it — include the React entries
yourself if you still need them externalized.

## Template assets

`TEMPLATE.md` directories use an exclusion rule instead of an extension allow-list: every file
except `TEMPLATE.md` itself, `.ts` and `.js` is treated as an asset. Destinations are namespaced by
the template's own path, so two templates cannot overwrite each other:

```text
{assetsDir}/templates/{templatePath}/{file}
```

## Configuration summary

Only these keys affect assets; see the README for the full config reference.

| Key | Effect |
| --- | ------ |
| `assetsDir` | Destination root. `false` disables copying *and* bundling. Defaults to `libDir`. |
| `widgetsDir` | Sub-directory of `assetsDir` for widget bundles. Default `widgets`. |
| `widgetConfig` | Forwarded to the esbuild bundler (table above). |

## Implementation map

| Concern | Module | Key exports |
| ------- | ------ | ----------- |
| Skill discovery | `src/core/utils/asset-discovery.ts` | `discoverSkillAssets`, `WidgetMetadata`, `DiscoveredAssets` |
| Template discovery | `src/core/utils/template-asset-discovery.ts` | `discoverTemplateAssets` |
| Copying | `src/core/utils/asset-copy.ts` | `copyAssetFile`, `copyAssets` |
| Bundling | `src/core/compilers/widget.ts` | `compileWidget`, `compileWidgets`, `WidgetCompilerConfig` |

Ordering inside `transformImports`: assets and widgets are accumulated as chunks are emitted,
deduplicated (widgets by source path), and only copied and bundled once the whole work queue has
drained. Nothing is written for a build that fails partway through emitting.

Copy failures are wrapped with both paths:

```text
Failed to copy asset from /abs/src/skills/my-skill/helper.js to /abs/dist/scripts/helper.js: EACCES …
```

## Types

```typescript
interface AssetFile {
    sourcePath: string;              // absolute path to the source file
    destPath: string;                // path relative to assetsDir
    type: 'script' | 'template';
}

interface WidgetMetadata {
    name: string;                    // widget name, no extension
    path: string;                    // absolute path to the .tsx source
}

interface DiscoveredAssets {
    scripts: string[];               // file names, with extension
    widgets: string[];               // widget names, without extension
    widgetMetadata: WidgetMetadata[];
    assetFiles: AssetFile[];         // scripts only — widgets are bundled, not copied
}

interface WidgetCompilerConfig {
    external?: string[];
    minify?: boolean;
    sourcemap?: boolean | 'inline' | 'external';
}
```

Note that `assetFiles` never contains widgets. Widgets are bundled from their compiled entry, so
copying the `.tsx` would ship a source file that nothing imports.

## Build output

Counts are reported on the CLI's single summary line:

```text
vertesia-build: files=34 chunks=51 assets=8 widgets=2
```

With `assetsDir: false`, the last two are always `0`.

## Compatibility

Skills without scripts or widgets need no changes — both fields are optional and are only present
when something was discovered. Consumers should treat them as possibly-absent:

```typescript
import skill from './skills/my-skill/SKILL.md';

if (skill.scripts) {
    // script file names, resolvable under {assetsDir}/scripts/
}
if (skill.widgets) {
    // widget names, resolvable under {assetsDir}/{widgetsDir}/
}
```

## Testing

`tests/asset-discovery.test.ts` covers the discovery rules and `tests/skill-assets.test.ts` the
transformer integration; `tests/widget-compiler.test.ts` covers bundling. Run with `pnpm test`.
