# @vertesia/create-tools

CLI tool to create Vertesia tool server projects from GitHub templates.

## Usage

```bash
# Using pnpm
pnpm create @vertesia/tools my-project

# Using npm
npm create @vertesia/tools my-project

# Using npx
npx @vertesia/create-tools my-project
```

## Features

- 📦 **Downloads template from GitHub** - Always get the latest template
- ⚙️ **Template-driven configuration** - Template defines its own prompts via `template.config.json`
- 🎨 **Interactive prompts** - User-friendly CLI with validation
- 🔄 **Variable replacement** - Automatically replaces `{{VARIABLES}}` in files
- 🧹 **Smart cleanup** - Removes meta files after installation
- 📚 **Package manager agnostic** - Works with npm, pnpm, or yarn

## How It Works

1. **Downloads** the template repository from GitHub using `degit`
2. **Reads** `template.config.json` from the template to determine configuration
3. **Prompts** the user for values (project name, description, etc.)
4. **Replaces** variables in specified files (e.g., `{{PROJECT_NAME}}` → `my-project`)
5. **Cleans up** meta files (`.git`, `template.config.json`, etc.)
6. **Installs** dependencies using the configured package manager

## Configuration

All configuration is centralized in `src/configuration.ts`:

```typescript
export const config = {
  templateRepo: 'vertesiahq/tool-server-template',
  templateConfigFile: 'template.config.json',
  packageManager: 'pnpm',
  // ... more options
}
```

### Key Configuration Options

- **`templateRepo`** - GitHub repository for the template (format: `owner/repo`)
- **`templateConfigFile`** - Name of the config file in the template
- **`packageManager`** - Which package manager to use (`npm`, `pnpm`, or `yarn`)
- **`useCache`** - Whether to cache downloaded templates

## Template Structure

The template repository should include a `template.config.json` file:

```json
{
  "version": "1.0",
  "prompts": [
    {
      "type": "text",
      "name": "PROJECT_NAME",
      "message": "Project name",
      "initial": "my-tool-server"
    },
    {
      "type": "text",
      "name": "DESCRIPTION",
      "message": "Project description",
      "initial": "A tool server for LLM integrations"
    }
  ],
  "files": [
    "package.json",
    "README.md",
    "src/server.ts"
  ],
  "removeAfterInstall": [
    ".git",
    "template.config.json"
  ]
}
```

### Template Config Schema

- **`prompts`** - Array of prompts using the [prompts](https://www.npmjs.com/package/prompts) library format
- **`files`** - List of files where variable replacement should occur
- **`removeAfterInstall`** - Files/directories to remove after installation
- **`conditionalRemove`** - Conditional file removal based on user answers

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test locally
pnpm test

# Watch mode
pnpm dev
```

## Publishing

```bash
# Build and publish
npm publish
```

After publishing, users can install with:

```bash
pnpm create @vertesia/tools my-project
```

## Template Development

To develop a template:

1. Create a GitHub repository with your template files
2. Add a `template.config.json` file with prompts and configuration
3. Use `{{VARIABLES}}` in files where you want replacements
4. Update `src/configuration.ts` to point to your template repo
5. Test with `pnpm test` or run the built CLI directly

## Examples

### Create a project with default settings

```bash
pnpm create @vertesia/tools my-project
```

### View help

```bash
pnpm create @vertesia/tools --help
```

## License

MIT
