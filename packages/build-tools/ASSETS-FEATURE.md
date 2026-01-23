# Asset Management Feature

## Overview

The plugin now supports automatic discovery and copying of asset files (scripts and widgets) associated with skill definitions.

## New Features

### 1. Asset Discovery

When transforming a skill markdown file, the plugin automatically discovers:
- **Script files**: `.js` and `.py` files in the same directory
- **Widget files**: `.tsx` files in the same directory

### 2. SkillDefinition Enhancement

The `SkillDefinition` type now includes:
```typescript
{
  name: string;
  title: string;
  description: string;
  keywords?: string[];
  content: string;
  scripts?: string[];    // NEW: Script file names (e.g., ["helper.js", "script.py"])
  widgets?: string[];    // NEW: Widget names without extension (e.g., ["chart", "user-select"])
  metadata?: Record<string, unknown>;
}
```

### 3. Asset Copying

Script files are automatically copied to the configured assets directory during build.

### 4. Widget Compilation

Widget `.tsx` files are **automatically compiled** during the build process using Rollup with TypeScript support. The plugin handles widget compilation transparently without requiring separate configuration.

## Configuration

### Plugin Options

```typescript
vertesiaImportPlugin({
  transformers: [skillTransformer, rawTransformer],

  // Asset directory configuration
  assetsDir: './dist',          // Default: './dist', use false to disable
  scriptsDir: 'scripts',        // Default: 'scripts' (relative to assetsDir)
  widgetsDir: 'widgets',        // Default: 'widgets' (relative to assetsDir)

  // Widget compilation configuration (optional)
  widgetConfig: {
    external: ['react', 'react-dom', 'react/jsx-runtime'],  // External dependencies
    tsconfig: './tsconfig.json',                             // TypeScript config path
    typescript: {},                                          // Additional TS plugin options
    minify: false                                            // Enable minification
  }
})
```

### Options Explained

- **`assetsDir`**: Root directory for asset output
  - If string: assets copied to this directory
  - If `false`: asset copying disabled
  - Default: `'./dist'`

- **`scriptsDir`**: Directory for script files relative to `assetsDir`
  - Default: `'scripts'`
  - Scripts copied to: `{assetsDir}/{scriptsDir}/`

- **`widgetsDir`**: Directory for compiled widget files relative to `assetsDir`
  - Default: `'widgets'`
  - Compiled widgets output to: `{assetsDir}/{widgetsDir}/`

- **`widgetConfig`**: Widget compilation configuration (optional)
  - **`external`**: Array of external dependencies (default: React and React DOM)
  - **`tsconfig`**: Path to TypeScript config file (default: `'./tsconfig.json'`)
  - **`typescript`**: Additional options passed to `@rollup/plugin-typescript`
  - **`minify`**: Enable minification with terser (default: `false`)

## How It Works

### 1. Skill Directory Structure

```
skills/my-skill/
├── SKILL.md        # Skill definition
├── helper.js       # JavaScript helper (will be copied)
├── script.py       # Python script (will be copied)
├── widget.tsx      # React widget (won't be copied, compile separately)
└── README.md       # Other files (ignored)
```

### 2. Import the Skill

```typescript
import mySkill from './skills/my-skill/SKILL.md?skill';

console.log(mySkill.scripts);  // ['helper.js', 'script.py']
console.log(mySkill.widgets);  // ['widget']
```

### 3. Build Output

```
dist/
├── scripts/
│   ├── helper.js   # Copied from skill directory
│   └── script.py   # Copied from skill directory
└── widgets/
    └── widget.js   # Automatically compiled from widget.tsx
```

## Implementation Details

### Asset Discovery (`src/utils/asset-discovery.ts`)

**Functions:**
- `discoverSkillAssets(skillFilePath, options)`: Discovers assets in skill directory
  - Returns: `{ scripts, widgets, assetFiles }`
  - Scripts: Files matching `/\.(js|py)$/`
  - Widgets: Files matching `/\.tsx$/` (extension removed from name)

### Asset Copying (`src/utils/asset-copy.ts`)

**Functions:**
- `copyAssetFile(asset, assetsRoot)`: Copies a single asset file
- `copyAssets(assets, assetsRoot)`: Copies multiple assets
  - Creates directories recursively
  - Reports number of files copied

### Widget Compilation (`src/utils/widget-compiler.ts`)

**Functions:**
- `compileWidgets(widgets, outputDir, config)`: Compiles widgets using Rollup
  - Spawns child Rollup process with TypeScript support
  - Compiles each widget to ES module format
  - Supports custom externals, TypeScript options, and minification
  - Generates source maps
  - Inlines dynamic imports

### Plugin Integration

The plugin:
1. Collects assets and widgets during the `load` phase
2. Copies script assets during the `buildEnd` phase
3. Compiles widgets during the `buildEnd` phase
4. Logs the number of files copied and compiled

## Example Usage

### Basic Configuration (with automatic widget compilation)

```typescript
// rollup.config.js
import { vertesiaImportPlugin, skillTransformer } from '@vertesia/build-tools';

export default {
  plugins: [
    vertesiaImportPlugin({
      transformers: [skillTransformer],
      assetsDir: './dist',  // Scripts copied to ./dist/scripts/, widgets to ./dist/widgets/
      widgetConfig: {
        // Widgets automatically compiled with TypeScript
        external: ['react', 'react-dom', 'react/jsx-runtime']
      }
    })
  ]
};
```

### Disable Asset Copying and Widget Compilation

```typescript
vertesiaImportPlugin({
  transformers: [skillTransformer],
  assetsDir: false  // No asset copying or widget compilation
})
```

### Widget Compilation Only (no asset copying)

```typescript
vertesiaImportPlugin({
  transformers: [skillTransformer],
  assetsDir: './dist',
  widgetConfig: {
    // Omit this to skip widget compilation, keeping only asset copying
  }
})
```

### Custom Directories and Advanced Widget Config

```typescript
vertesiaImportPlugin({
  transformers: [skillTransformer],
  assetsDir: './build',
  scriptsDir: 'skill-scripts',  // Scripts copied to ./build/skill-scripts/
  widgetsDir: 'compiled-widgets',  // Widgets compiled to ./build/compiled-widgets/
  widgetConfig: {
    external: ['react', 'react-dom', 'react/jsx-runtime', '@vertesia/ui'],
    tsconfig: './tsconfig.widgets.json',
    typescript: {
      jsx: 'react-jsx',
      target: 'es2020'
    },
    minify: true  // Enable terser minification
  }
})
```

## Testing

New tests added:
- `tests/asset-discovery.test.ts` - Asset discovery utilities (4 tests)
- `tests/skill-assets.test.ts` - Skill transformer with assets (4 tests)

Total tests: **21 passing**

## Type Safety

The `AssetFile` interface:
```typescript
export interface AssetFile {
  sourcePath: string;      // Absolute path to source file
  destPath: string;        // Relative path within assets directory
  type: 'script';          // Asset type (scripts only - widgets compiled separately)
}
```

The `WidgetConfig` interface:
```typescript
export interface WidgetConfig {
  external?: string[];                    // External dependencies (default: React/ReactDOM)
  tsconfig?: string;                      // Path to tsconfig.json (default: './tsconfig.json')
  typescript?: Record<string, unknown>;   // Additional TypeScript plugin options
  minify?: boolean;                       // Enable terser minification (default: false)
}
```

The `WidgetMetadata` interface:
```typescript
export interface WidgetMetadata {
  name: string;     // Widget name (without .tsx extension)
  path: string;     // Absolute path to widget source file
}
```

## Migration

### For Existing Skills

No changes needed! Skills without scripts/widgets continue to work:
- `scripts` and `widgets` are optional properties
- Only populated if assets exist in skill directory

### For Existing Code

If you're consuming skill definitions:
```typescript
// Before
const skill = await import('./skill.md?skill');
// skill.scripts and skill.widgets didn't exist

// After
const skill = await import('./skill.md?skill');
if (skill.scripts) {
  // Script files available at runtime
}
if (skill.widgets) {
  // Widget names available for dynamic loading
}
```

## Performance

- Asset discovery is file-system based (fast)
- Only processes files in skill directory (non-recursive)
- Asset copying happens once during `buildEnd` phase
- Widget compilation happens once during `buildEnd` phase
  - Widgets compiled in parallel using `Promise.all()`
  - Each widget gets its own Rollup build process
  - Source maps generated for debugging
- No impact on hot module replacement (HMR)

## Advanced Features

### Minification

Enable minification for production builds:

```typescript
widgetConfig: {
  minify: true  // Uses rollup-plugin-terser
}
```

### Custom TypeScript Configuration

Use a separate tsconfig for widgets:

```typescript
widgetConfig: {
  tsconfig: './tsconfig.widgets.json',
  typescript: {
    jsx: 'react-jsx',
    target: 'es2020',
    declaration: false
  }
}
```

### External Dependencies

Control which dependencies are externalized:

```typescript
widgetConfig: {
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom/client',
    '@vertesia/ui',
    '@vertesia/common'
  ]
}
```

Default externals include:
- `react`
- `react-dom`
- `react/jsx-runtime`
- `react/jsx-dev-runtime`
- `react-dom/client`

## Build Output

When widgets are compiled, you'll see console output:

```
Copied 2 asset file(s) to ./dist
Compiling 3 widget(s)...
Compiled 3 widget(s) to ./dist/widgets
```
