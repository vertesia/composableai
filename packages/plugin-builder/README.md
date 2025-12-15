# @vertesia/plugin-builder

A Vite plugin for building Vertesia UI plugins with CSS handling and Tailwind utilities extraction.

## Features

- Seamless integration with Vite build process
- Automatic CSS file generation for plugins
- Tailwind CSS utilities layer extraction
- Optional inline CSS as JavaScript export

## Installation

```bash
npm install @vertesia/plugin-builder --save-dev
# or
pnpm add -D @vertesia/plugin-builder
```

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';

export default defineConfig({
  plugins: [
    vertesiaPluginBuilder()
  ]
});
```

## Configuration Options

```typescript
interface VertesiaPluginBuilderOptions {
  // Inline CSS as a JavaScript export variable
  inlineCss?: boolean;

  // Name of the exported CSS variable (default: 'css')
  cssVar?: string;

  // Input CSS file path (default: 'src/index.css')
  input?: string;

  // Output CSS file name (default: 'plugin.css')
  output?: string;
}
```

## Examples

### Basic Usage

```typescript
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';

export default defineConfig({
  plugins: [
    vertesiaPluginBuilder()
  ]
});
```

### With Inline CSS Export

When `inlineCss` is enabled, the plugin extracts Tailwind utilities and exports them as a JavaScript variable:

```typescript
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';

export default defineConfig({
  plugins: [
    vertesiaPluginBuilder({
      inlineCss: true,
      cssVar: 'pluginStyles'
    })
  ]
});
```

This allows you to import the CSS directly in your JavaScript:

```typescript
import { pluginStyles } from './plugin.js';
```

### Custom Input/Output

```typescript
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';

export default defineConfig({
  plugins: [
    vertesiaPluginBuilder({
      input: 'styles/main.css',
      output: 'my-plugin.css'
    })
  ]
});
```

## How It Works

1. The plugin creates a virtual entry module that imports your CSS file
2. During the build process, Vite processes the CSS through its pipeline (including Tailwind if configured)
3. The processed CSS is output to the specified file
4. If `inlineCss` is enabled, the Tailwind utilities layer is extracted and appended to the JavaScript bundle as an exported variable

## Requirements

- Vite 4.2.0 or higher
- Node.js 18+

## License

MIT
