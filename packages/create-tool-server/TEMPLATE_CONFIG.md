# Template Configuration Guide

This document describes the `template.config.json` file format used by `@vertesia/create-tools` to configure project templates.

## Overview

The `template.config.json` file is placed in the root of your GitHub template repository. When users create a project from your template, the installer reads this configuration to:

1. Prompt users for project-specific values
2. Replace placeholders in template files
3. Conditionally remove files based on user choices
4. Clean up template-specific files after installation

## File Location

```
your-template-repo/
├── template.config.json    # ← Configuration file
├── package.json
├── src/
└── ...
```

## Schema

```typescript
interface TemplateConfig {
  version: string;                                    // Configuration format version
  description?: string;                               // Optional template description
  prompts: PromptConfig[];                           // User prompts for configuration
  files: string[];                                   // Files to process for variable replacement
  removeAfterInstall?: string[];                     // Files to remove after installation
  conditionalRemove?: Record<string, Record<string, string[]>>;  // Conditional file removal
}

interface PromptConfig {
  type: string;                    // Prompt type (text, number, confirm, select, multiselect)
  name: string;                    // Variable name (used as {{NAME}} in templates)
  message: string;                 // Prompt message shown to user
  initial?: string | number | boolean;  // Default value
  validate?: string;               // Validation function (as string)
  format?: string;                 // Format function (as string)
  skip?: string;                   // Skip condition (as string)
}
```

## Fields Reference

### `version` (required)

**Type:** `string`

**Description:** Specifies the configuration format version. Currently only `"1.0"` is supported.

**Example:**
```json
{
  "version": "1.0"
}
```

---

### `description` (optional)

**Type:** `string`

**Description:** A human-readable description of the template. Currently not displayed but reserved for future use.

**Example:**
```json
{
  "description": "A template for building custom tool servers with tools, skills, and interactions"
}
```

---

### `prompts` (required)

**Type:** `PromptConfig[]`

**Description:** Array of prompts to ask the user during installation. Each prompt collects a value that can be used to replace placeholders in template files.

**Prompt Types:**
- `text` - Single-line text input
- `number` - Numeric input
- `confirm` - Yes/no question (boolean)
- `select` - Single choice from list
- `multiselect` - Multiple choices from list

**Available Variables in `initial` values:**
- `${PROJECT_NAME}` - Replaced with the project name specified by the user

**Example:**
```json
{
  "prompts": [
    {
      "type": "text",
      "name": "PROJECT_NAME",
      "message": "Project name",
      "initial": "my-tool-server"
    },
    {
      "type": "text",
      "name": "PROJECT_DESCRIPTION",
      "message": "Project description",
      "initial": "A custom tool server"
    },
    {
      "type": "text",
      "name": "AUTHOR_NAME",
      "message": "Author name",
      "initial": ""
    },
    {
      "type": "confirm",
      "name": "USE_TYPESCRIPT",
      "message": "Use TypeScript?",
      "initial": true
    },
    {
      "type": "select",
      "name": "PACKAGE_MANAGER",
      "message": "Package manager",
      "initial": "pnpm",
      "choices": [
        { "title": "pnpm", "value": "pnpm" },
        { "title": "npm", "value": "npm" },
        { "title": "yarn", "value": "yarn" }
      ]
    }
  ]
}
```

#### Prompt Config Fields

##### `type` (required)
Prompt type: `"text"`, `"number"`, `"confirm"`, `"select"`, or `"multiselect"`

##### `name` (required)
Variable name used for replacement. In template files, use `{{NAME}}` where `NAME` is this value.

##### `message` (required)
Question text shown to the user.

##### `initial` (optional)
Default value. Can include `${PROJECT_NAME}` which will be replaced with the user's project name.

##### `validate` (optional)
JavaScript expression (as string) to validate input. Return `true` if valid, or error message string if invalid.

**Example:**
```json
{
  "validate": "(value) => value.length > 0 || 'Required field'"
}
```

##### `format` (optional)
JavaScript expression (as string) to format the value before saving.

**Example:**
```json
{
  "format": "(value) => value.toLowerCase()"
}
```

##### `skip` (optional)
JavaScript expression (as string) that returns `true` to skip this prompt based on previous answers.

**Example:**
```json
{
  "skip": "(prev) => !prev.USE_TYPESCRIPT"
}
```

---

### `files` (required)

**Type:** `string[]`

**Description:** Array of file paths (relative to template root) where variable replacement should occur. The installer will search for `{{VARIABLE_NAME}}` placeholders and replace them with user-provided values.

**Example:**
```json
{
  "files": [
    "package.json",
    "README.md",
    "src/server.ts",
    ".env.example"
  ]
}
```

**Usage in template files:**

`package.json`:
```json
{
  "name": "{{PROJECT_NAME}}",
  "description": "{{PROJECT_DESCRIPTION}}",
  "author": "{{AUTHOR_NAME}}"
}
```

After installation with values:
- `PROJECT_NAME` = "my-tool-server"
- `PROJECT_DESCRIPTION` = "My custom tool server"
- `AUTHOR_NAME` = "John Doe"

Becomes:
```json
{
  "name": "my-tool-server",
  "description": "My custom tool server",
  "author": "John Doe"
}
```

#### Using Variables in Code Files

For **code files** (TypeScript, JavaScript, etc.), you cannot use `{{VARIABLE}}` directly as it breaks compilation. Instead, use two different patterns depending on what you're replacing:

##### Pattern 1: CONFIG__ for Constant Values

Use `CONFIG__` prefix for configuration values (booleans, numbers, strings):

**Template file (vite.config.ts):**
```typescript
// Define CONFIG__ constants at the top of your file
const CONFIG__inlineCss = false;
const CONFIG__serverPort = 3000;
const CONFIG__pluginTitle = "My Plugin";

// Use them in your code
const inlineCss = CONFIG__inlineCss;

export default defineConfig({
  server: {
    port: CONFIG__serverPort
  },
  // ... rest of config
});
```

**After installation** (with `inlineCss=true`, `serverPort=8080`, `pluginTitle="Analytics"`):
```typescript
const CONFIG__inlineCss = true;
const CONFIG__serverPort = 8080;
const CONFIG__pluginTitle = "Analytics";

const inlineCss = CONFIG__inlineCss;
// ... rest of code remains unchanged
```

##### Pattern 2: TEMPLATE__ for Identifiers

Use `TEMPLATE__` prefix for identifier names (functions, classes, variables):

**Template file (src/plugin.tsx):**
```typescript
export default function TEMPLATE__PluginComponentName({ slot }: { slot: string }) {
  return <div>Hello from TEMPLATE__PluginComponentName</div>;
}

class TEMPLATE__ServiceClass {
  // ...
}
```

**template.config.json with derived variable:**
```json
{
  "prompts": [
    {
      "type": "text",
      "name": "PROJECT_NAME",
      "message": "Project name",
      "initial": "my-plugin"
    }
  ],
  "derived": {
    "PluginComponentName": {
      "from": "PROJECT_NAME",
      "transform": "pascalCase"
    }
  },
  "files": ["src/plugin.tsx", "vite.config.ts"]
}
```

**After installation** (user enters "analytics-dashboard"):
```typescript
export default function AnalyticsDashboard({ slot }: { slot: string }) {
  return <div>Hello from AnalyticsDashboard</div>;
}
```

**How it works:**
1. **CONFIG__** - Only the **value** is replaced, constant declaration remains
2. **TEMPLATE__** - The entire **identifier** is replaced with the user's value
3. Your template stays compilable and testable with default values
4. Both patterns work anywhere in code files (.js, .jsx, .mjs, .ts, .tsx)

**Benefits:**
- ✅ Template compiles and runs normally during development
- ✅ Type-safe (preserves boolean, number, string types)
- ✅ Clear visual markers for template variables
- ✅ Supports both configuration values and identifier names

**For non-code files** (JSON, HTML, Markdown), continue using simple `{{VARIABLE}}` placeholders.

---

### `removeAfterInstall` (optional)

**Type:** `string[]`

**Description:** Array of file paths to remove after installation completes. Use this to clean up template-specific files that users don't need.

**Common files to remove:**
- `template.config.json` - The configuration file itself
- `TEMPLATE_README.md` - Template development docs
- `.github/workflows/template-*.yml` - Template CI workflows

**Example:**
```json
{
  "removeAfterInstall": [
    "template.config.json",
    "TEMPLATE_README.md",
    ".github/workflows/template-test.yml"
  ]
}
```

---

### `conditionalRemove` (optional)

**Type:** `Record<string, Record<string, string[]>>`

**Description:** Conditionally remove files based on user answers. The structure is:
```
{
  "VARIABLE_NAME": {
    "value1": ["files", "to", "remove"],
    "value2": ["other", "files"]
  }
}
```

When the user's answer for `VARIABLE_NAME` equals `value1`, the specified files are removed.

**Example:**
```json
{
  "conditionalRemove": {
    "USE_TYPESCRIPT": {
      "false": [
        "tsconfig.json",
        "src/**/*.ts"
      ]
    },
    "PACKAGE_MANAGER": {
      "npm": [
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml"
      ],
      "yarn": [
        "pnpm-lock.yaml",
        "package-lock.json"
      ]
    },
    "INCLUDE_EXAMPLES": {
      "false": [
        "src/tools/calculator",
        "src/skills/code-review",
        "src/interactions/summarize"
      ]
    }
  }
}
```

**Use cases:**
- Remove TypeScript files if user chooses JavaScript
- Remove package manager lock files
- Remove example code if user wants a minimal setup
- Remove platform-specific files based on deployment choice

---

### `derived` (optional)

**Type:** `Record<string, DerivedVariable>`

**Description:** Automatically generate additional variables by transforming user input. Useful for creating consistent naming across different contexts (e.g., component names from project names).

**DerivedVariable structure:**
```typescript
{
  "from": "SOURCE_VARIABLE",    // Variable to derive from
  "transform": "transformType"  // Transformation to apply
}
```

**Supported transforms:**
- `pascalCase` - MyPlugin, HelloWorld
- `camelCase` - myPlugin, helloWorld
- `kebabCase` - my-plugin, hello-world
- `snakeCase` - my_plugin, hello_world
- `titleCase` - My Plugin, Hello World
- `upperCase` - MY-PLUGIN, HELLO WORLD
- `lowerCase` - my-plugin, hello world

**Example:**
```json
{
  "prompts": [
    {
      "type": "text",
      "name": "PROJECT_NAME",
      "message": "Project name",
      "initial": "my-plugin"
    }
  ],
  "derived": {
    "ComponentName": {
      "from": "PROJECT_NAME",
      "transform": "pascalCase"
    },
    "packageName": {
      "from": "PROJECT_NAME",
      "transform": "kebabCase"
    },
    "constantName": {
      "from": "PROJECT_NAME",
      "transform": "snakeCase"
    }
  }
}
```

**After user enters "my cool plugin":**
- `PROJECT_NAME` = "my cool plugin"
- `ComponentName` = "MyCoolPlugin" (derived, pascalCase)
- `packageName` = "my-cool-plugin" (derived, kebabCase)
- `constantName` = "my_cool_plugin" (derived, snakeCase)

**Usage in template files:**
```typescript
// src/plugin.tsx
export default function {{ComponentName}}() {
  return <div>Hello from {{ComponentName}}!</div>;
}
```

```json
// package.json
{
  "name": "{{packageName}}",
  "version": "1.0.0"
}
```

```typescript
// src/config.ts
const CONFIG__pluginName = "{{PROJECT_NAME}}";
export const PLUGIN_ID = "{{constantName}}";
```

**Benefits:**
- ✅ Ensures consistent naming conventions across files
- ✅ No need to ask users multiple questions for the same concept
- ✅ Reduces user error in naming
- ✅ Common use case: Component names from project names

---

## Complete Example

Here's a complete `template.config.json` for a tool server template:

```json
{
  "version": "1.0",
  "description": "A template for building custom tool servers with tools, skills, and interactions",
  "prompts": [
    {
      "type": "text",
      "name": "PROJECT_NAME",
      "message": "Project name",
      "initial": "my-tool-server"
    },
    {
      "type": "text",
      "name": "PROJECT_DESCRIPTION",
      "message": "Project description",
      "initial": "A custom tool server with tools, skills, and interactions"
    },
    {
      "type": "text",
      "name": "SERVER_TITLE",
      "message": "Server title (displayed in UI)",
      "initial": "My Tool Server"
    },
    {
      "type": "text",
      "name": "AUTHOR_NAME",
      "message": "Author name",
      "initial": ""
    },
    {
      "type": "confirm",
      "name": "INCLUDE_EXAMPLES",
      "message": "Include example tools, skills, and interactions?",
      "initial": true
    },
    {
      "type": "select",
      "name": "DEPLOYMENT_TARGET",
      "message": "Primary deployment target",
      "initial": "vercel",
      "choices": [
        { "title": "Vercel", "value": "vercel" },
        { "title": "Cloud Run", "value": "cloudrun" },
        { "title": "Railway", "value": "railway" },
        { "title": "Docker", "value": "docker" }
      ]
    }
  ],
  "files": [
    "package.json",
    "README.md",
    "src/server.ts"
  ],
  "conditionalRemove": {
    "INCLUDE_EXAMPLES": {
      "false": [
        "src/tools/calculator",
        "src/skills/code-review",
        "src/interactions/summarize"
      ]
    },
    "DEPLOYMENT_TARGET": {
      "cloudrun": [
        "vercel.json",
        "api/"
      ],
      "railway": [
        "vercel.json",
        "api/"
      ],
      "docker": [
        "vercel.json",
        "api/"
      ]
    }
  },
  "removeAfterInstall": [
    "template.config.json",
    "TEMPLATE_README.md"
  ]
}
```

## Installation Flow

When a user runs `pnpm create @vertesia/tools my-project`, the installer:

1. **Downloads** the template from GitHub using degit
2. **Reads** `template.config.json`
3. **Prompts** the user with questions from `prompts` array
4. **Replaces** `{{VARIABLES}}` in files listed in `files` array
5. **Conditionally removes** files based on `conditionalRemove` rules
6. **Removes** meta files listed in `removeAfterInstall`
7. **Installs** npm dependencies
8. **Shows** success message

## Best Practices

### 1. Keep Prompts Minimal
Only ask for essential information. Too many prompts overwhelm users.

```json
// ✅ Good - Essential info only
{
  "prompts": [
    { "name": "PROJECT_NAME", ... },
    { "name": "AUTHOR_NAME", ... }
  ]
}

// ❌ Bad - Too many questions
{
  "prompts": [
    { "name": "PROJECT_NAME", ... },
    { "name": "AUTHOR_NAME", ... },
    { "name": "AUTHOR_EMAIL", ... },
    { "name": "AUTHOR_URL", ... },
    { "name": "LICENSE", ... },
    { "name": "GIT_REPO", ... }
  ]
}
```

### 2. Provide Sensible Defaults
Use `initial` values that work for most users.

```json
{
  "type": "text",
  "name": "PROJECT_DESCRIPTION",
  "message": "Project description",
  "initial": "A custom tool server"  // ✅ Reasonable default
}
```

### 3. Use PROJECT_NAME in Initial Values
Reference the project name in defaults when appropriate.

```json
{
  "type": "text",
  "name": "PACKAGE_NAME",
  "message": "NPM package name",
  "initial": "@myorg/${PROJECT_NAME}"  // ✅ References project name
}
```

### 4. Document Variables in Template Files
Add comments to help template maintainers.

```typescript
// src/server.ts
const server = createToolServer({
    title: '{{SERVER_TITLE}}',           // Replaced during installation
    description: '{{PROJECT_DESCRIPTION}}', // Replaced during installation
    // ...
});
```

### 5. Test Your Template Config
Create test installations to verify:
- All prompts work correctly
- Variable replacement works in all files
- Conditional removal works as expected
- No leftover template artifacts

```bash
# Test installation
pnpm create @vertesia/tools test-project
cd test-project
pnpm dev
```

### 6. Keep Files List Updated
When adding new template files with variables, remember to add them to `files` array.

### 7. Use Conditional Remove Wisely
Only remove files that truly aren't needed. Don't be too aggressive - users can delete files themselves.

## Testing Your Template

1. **Test locally first:**
   ```bash
   # Create test installation
   cd /tmp
   pnpm create @vertesia/tools test-project
   cd test-project
   pnpm build
   pnpm start
   ```

2. **Test different configurations:**
   - Try with/without examples
   - Try different deployment targets
   - Test with minimal vs full setup

3. **Verify cleanup:**
   - Check that `template.config.json` is removed
   - Verify conditional files are removed correctly
   - Ensure no template artifacts remain

4. **Test the generated project:**
   - Build succeeds
   - Tests pass (if any)
   - Development server starts
   - Production build works

## Troubleshooting

### Variables Not Being Replaced

**Problem:** `{{VARIABLE}}` still appears in files after installation.

**Solutions:**
1. Ensure the file is listed in `files` array
2. Check that the variable name matches exactly (case-sensitive)
3. Verify the file exists in the template

### Conditional Remove Not Working

**Problem:** Files aren't being removed based on user choice.

**Solutions:**
1. Check that the variable name matches a prompt name
2. Verify the value matches exactly (case-sensitive)
3. Ensure file paths are correct relative to project root

### Template Config Not Found

**Problem:** Installer says "Template configuration file not found".

**Solutions:**
1. Ensure `template.config.json` is in the repository root
2. Check file name spelling (case-sensitive)
3. Verify the file is committed to the repository

## Version History

### Version 1.0 (Current)
- Initial template configuration format
- Support for prompts, file replacement, and conditional removal

---

For more information about creating templates, see the [main README](./README.md).
