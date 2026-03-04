# @vertesia/build-tools

A flexible Rollup plugin for transforming imports with custom compilers and validation. Built for Vertesia but usable in any project.

## Features

- 🎯 **Pattern-based import transformation** - Match imports by path patterns
- ✅ **Built-in Zod validation** - Validate transformed data at build time
- 🔧 **Preset transformers** - Ready-to-use transformers for common cases
- 🎨 **Custom transformers** - Easy to create custom transformation logic
- 📦 **TypeScript-first** - Full type safety with TypeScript
- ⚡ **Fast** - Efficient transformation with minimal overhead

## Installation

```bash
pnpm add -D @vertesia/build-tools
```

## Quick Start

### Using Preset Transformers

```typescript
// rollup.config.js
import { vertesiaImportPlugin, skillTransformer, rawTransformer } from '@vertesia/build-tools';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'es'
  },
  plugins: [
    vertesiaImportPlugin({
      transformers: [
        skillTransformer,  // Handles .md?skill imports
        rawTransformer     // Handles ?raw imports
      ]
    })
  ]
};
```

### Using in Your Code

```typescript
// Import a skill definition from markdown
import codeReview from './skills/code-review.md?skill';

console.log(codeReview.name);         // 'code-review'
console.log(codeReview.title);        // 'Code Review Assistant'
console.log(codeReview.description);  // 'Skill for reviewing...'
console.log(codeReview.instructions); // Full markdown content
console.log(codeReview.content_type); // 'md' or 'jst'

// Import raw file content
import template from './template.html?raw';
console.log(template); // Raw HTML string
```

## Preset Transformers

### Skill Transformer

Transforms markdown files with frontmatter into skill definition objects.

**Pattern:** `.md?skill`

**Input:** `my-skill.md`
```markdown
---
name: my-skill
title: My Skill
description: A helpful skill
content_type: md
context_triggers:
  keywords: [skill, helper]
related_tools: [tool1, tool2]
---

# My Skill

This is the skill content in markdown.
```

**Output:**
```typescript
{
  name: 'my-skill',
  title: 'My Skill',
  description: 'A helpful skill',
  instructions: '# My Skill\n\nThis is the skill content...',
  content_type: 'md',
  context_triggers: {
    keywords: ['skill', 'helper']
  },
  related_tools: ['tool1', 'tool2'],
  scripts: ['helper.js', 'script.py'],  // If .js/.py files exist in skill dir
  widgets: ['chart', 'user-select']     // If .tsx files exist in skill dir
}
```

**Type:** `SkillDefinition` (exported from package)

**Asset Discovery:** The skill transformer automatically discovers:
- Script files (`.js`, `.py`) in the skill directory → added to `scripts` array
- Widget files (`.tsx`) in the skill directory → added to `widgets` array (without extension)

**Asset Copying:** Script files are automatically copied to `{assetsDir}/scripts/` during build. Widget files are automatically compiled to `{assetsDir}/widgets/` during build.

**SkillDefinition Schema:**
```typescript
{
  name: string;                    // Required: Unique skill name (kebab-case)
  title?: string;                  // Optional: Display title
  description: string;             // Required: Short description
  instructions: string;            // Required: Skill instructions (markdown)
  content_type: 'md' | 'jst';     // Required: Content type
  input_schema?: {                 // Optional: JSON Schema for parameters
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  context_triggers?: {             // Optional: Auto-injection triggers
    keywords?: string[];           // Keywords to trigger this skill
    tool_names?: string[];         // Tools that suggest this skill
    data_patterns?: string[];      // Regex patterns for data matching
  };
  execution?: {                    // Optional: Code execution config
    language: string;              // Programming language
    packages?: string[];           // Required packages
    system_packages?: string[];    // System-level packages
    template?: string;             // Code template
  };
  related_tools?: string[];        // Optional: Related tool names
  scripts?: string[];              // Optional: Script files in skill dir
  widgets?: string[];              // Optional: Widget names in skill dir
  isEnabled?: (context: any) => Promise<boolean>;  // Optional: Runtime filter function
}
```

### Runtime Properties (`properties.ts`)

For properties that cannot be defined in YAML frontmatter (like functions), create a `properties.ts` file in your skill directory:

```typescript
// my-skill/properties.ts
import type { ToolUseContext } from '@vertesia/tools-sdk';

export default {
  // Function to check if skill is enabled
  isEnabled: async (context: ToolUseContext): Promise<boolean> => {
    return context.project?.settings?.myFeature === true;
  },

  // You can override any frontmatter property
  description: 'Dynamically set description',

  // Add any other SkillDefinition properties
};
```

**How it works:**
1. The `properties.ts` file must export a default object of type `Partial<SkillDefinition>`
2. Properties from `properties.ts` **override** those from frontmatter
3. During build, the SKILL.md transformer generates code that imports `./properties.js`
4. Rollup automatically transpiles `properties.ts` to `properties.js` (via TypeScript plugin)
5. Runtime validation ensures `isEnabled` (if present) is a function
6. Build fails with clear errors if validation fails

**Directory structure:**
```
my-skill/
  ├── SKILL.md         # Declarative properties (frontmatter + markdown)
  ├── properties.ts    # Runtime properties (functions, overrides)
  ├── helper.js        # Script files (auto-discovered)
  └── chart.tsx        # Widget files (auto-discovered)
```

### Raw Transformer

Imports any file as a raw string.

**Pattern:** `?raw`

**Usage:**
```typescript
import html from './template.html?raw';
import css from './styles.css?raw';
import txt from './data.txt?raw';
```

## Custom Transformers

Create your own transformers for specific use cases:

```typescript
import { vertesiaImportPlugin } from '@vertesia/build-tools';
import { z } from 'zod';

// Define your schema
const InteractionSchema = z.object({
  name: z.string(),
  type: z.enum(['form', 'modal', 'dialog']),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string()
  }))
});

export default {
  plugins: [
    vertesiaImportPlugin({
      transformers: [
        {
          // Match pattern
          pattern: /\.interaction\.json$/,

          // Optional validation schema
          schema: InteractionSchema,

          // Transform function
          transform: (content, filePath) => {
            const json = JSON.parse(content);

            // Add computed fields
            json.timestamp = Date.now();
            json.source = filePath;

            return {
              data: json
            };
          }
        }
      ]
    })
  ]
};
```

## API

### `vertesiaImportPlugin(config)`

Main plugin factory.

**Parameters:**
- `config.transformers` - Array of transformer rules
- `config.assetsDir` - Root directory for asset output (default: `'./dist'`, use `false` to disable)
- `config.scriptsDir` - Directory for script files relative to assetsDir (default: `'scripts'`)
- `config.widgetsDir` - Directory for widget files relative to assetsDir (default: `'widgets'`)

**Returns:** Rollup Plugin

**Asset Management:**
- When `assetsDir` is configured, script files (`.js`, `.py`) discovered in skill directories are automatically copied to `{assetsDir}/{scriptsDir}/`
- Widget files (`.tsx`) are tracked in the skill definition but not copied (compile them separately)
- Set `assetsDir: false` to disable asset copying

### `TransformerRule`

Configuration for a single transformer.

```typescript
interface TransformerRule {
  pattern: RegExp;                      // Pattern to match imports
  transform: TransformFunction;         // Transform function
  schema?: z.ZodType<any>;             // Optional Zod schema
  options?: Record<string, unknown>;   // Optional custom options
}
```

### `TransformFunction`

Function that transforms file content.

```typescript
type TransformFunction = (
  content: string,
  filePath: string
) => TransformResult | Promise<TransformResult>;

interface TransformResult {
  data: unknown;          // Data to export (serialized to JSON)
  imports?: string[];     // Optional imports to inject
  code?: string;          // Optional custom code generation
}
```

## Advanced Usage

### Custom Code Generation

Instead of JSON export, generate custom code:

```typescript
{
  pattern: /\.template\.ts$/,
  transform: (content, filePath) => {
    return {
      data: null,
      code: `
        export function render() {
          return ${JSON.stringify(content)};
        }
        export const filePath = ${JSON.stringify(filePath)};
      `
    };
  }
}
```

### Adding Imports

Inject imports into the generated module:

```typescript
{
  pattern: /\.config\.yaml$/,
  transform: (content) => {
    const config = parseYaml(content);
    return {
      data: config,
      imports: [
        "import { validateConfig } from './validator.js';",
        "validateConfig(config);"
      ]
    };
  }
}
```

## Type Safety

The plugin exports TypeScript types for use in your code:

```typescript
import type { SkillDefinition } from '@vertesia/build-tools';

function processSkill(skill: SkillDefinition) {
  console.log(skill.name);
}
```

## How It Works

1. **Pattern Matching:** Plugin intercepts imports matching configured patterns
2. **File Loading:** Reads the actual file from disk
3. **Transformation:** Runs the transform function on file content
4. **Validation:** If schema provided, validates the result with Zod
5. **Code Generation:** Generates JavaScript module with the data
6. **Build Fails:** If validation fails, build stops with clear error messages

## Error Handling

The plugin provides detailed error messages when validation fails:

```
Error: Validation failed for ./skills/bad-skill.md?skill:
  - name: Required
  - description: String must contain at least 1 character(s)
```

## License

Apache-2.0

## Repository

https://github.com/vertesia/composableai

Part of the Vertesia LLM Studio monorepo.
