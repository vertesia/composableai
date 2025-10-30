# @vertesia/create-plugin

This package scaffolds Vertesia plugin projects. Use it to create either:

- **Web Application Plugins**: React-based web applications that extend Vertesia Studio
- **Agent Tool Server**: Custom agent tools accessible via API endpoints

Visit <https://vertesiahq.com> for more information about Vertesia.

## What Can You Create?

### Web Application Plugin (UI Extensions)

Vertesia web plugins are React-based web application that can be embedded into the Vertesia Studio interface. They allow you to create custom user experiences focused on specific use cases and business processes, while seamlessly leveraging all the vertesia platform features.

### Agent Tool Server

An Agent Tool Server extends the capabilities of AI agents in Vertesia. It allows you to:

- Create custom tools that agents can use
- Integrate with external APIs and services
- Organize tools into logical collections
- Expose tools via REST API endpoints
- Support authentication and context-aware execution

## Prerequisites

Before creating a plugin project, you need:

- Node.js and pnpm (or npm)
- Vertesia CLI
- An application manifest declared in Vertesia

### Declaring Your Web Application Plugin in Vertesia

Before you can develop and integrate your web application plugin with Vertesia, you must declare an application manifest in the Vertesia platform using the Vertesia CLI.

#### Install the Vertesia CLI

If not already done, install the Vertesia CLI and create a profile:

```bash
npm install -g @vertesia/cli
vertesia profiles create
```

### Create the App Manifest

Create the app manifest using the Vertesia CLI:

```bash
vertesia apps create --manifest '{
  "name": "my-app",
  "title": "My App",
  "description": "A sample app",
  "publisher": "your-org",
  "private": true,
  "status": "beta"
}' --install
```

The `--install` flag will automatically install the app and grant permissions to the creator.

**Important**: The `name` field from your manifest (e.g., `my-app`) is what you'll use as your plugin name in the next step.

## Initialize a Plugin Project

Run the initialization command:

```bash
npm init @vertesia/plugin
# or
pnpm create @vertesia/plugin
```

You will be prompted to choose a template and provide configuration:

### Prompts

1. **Template type**: Choose between:
   - **Web application plugin**: For UI extensions
   - **Agent tool server**: For custom agent tools
2. **Package manager**: Choose between npm or pnpm
3. **Plugin name**: Use kebab-case (e.g., my-plugin or my-tools)
4. **Plugin version**: Semantic version (e.g., 1.0.0)
5. **Description**: Optional description of your plugin

### Web Application Plugin Specific

If you select the **Web application plugin** template, you'll also be asked:

1. **Isolation strategy**:
   - **Shadow DOM**: Fully isolated plugin using Shadow DOM (recommended)
   - **CSS-only isolation**: Lighter isolation using CSS scope, but may have style conflicts

## Working with Plugins

After creating your project, see the README file in the generated project for comprehensive development instructions.

## Support

For issues, questions, or feature requests:

- [GitHub Issues](https://github.com/vertesia/composableai/issues)
- [Documentation](https://docs.vertesiahq.com/)
