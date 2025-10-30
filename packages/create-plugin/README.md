# @vertesia/create-plugin

This package scaffolds a Vertesia plugin project. Vertesia plugins are used to extend the Vertesia Studio UI with custom functionality and integrations.

Visit <https://vertesiahq.com> for more information about Vertesia.

## What are Vertesia Plugins?

Vertesia plugins are React-based UI components that can be embedded into the Vertesia Studio interface. They allow you to:

- Create custom UI pages and interfaces
- Integrate with external services
- Extend Vertesia's functionality with custom tools and workflows
- Build reusable components for your organization

## Prerequisites

Before creating a plugin project, you need:

- Node.js and pnpm (or npm)
- Vertesia CLI
- An application manifest declared in Vertesia

## Declaring Your App in Vertesia

Before you can develop and integrate your plugin with Vertesia, you must declare an application manifest in the Vertesia platform. This is done using the Vertesia CLI.

### Install the Vertesia CLI

If not already done, install the vertesia CLI and create a profile

```bash
npm install -g @vertesia/cli
vertesia profiles create
```

### Create the App Manifest

**Create the app manifest** using the Vertesia CLI:

```bash
vertesia apps create --manifest '{
  "name": "my-app",
  "title": "My App",
  "description": "A sample app",
  "publisher": "your-org",
  "private": true,
  "status": "beta",
  "ui": {
    "src": "/plugins/my-app",
    "isolation": "shadow"
  }
}' --install
```

The `--install` flag will automatically install the app and grant permissions to the creator.

**Important**: The `name` field from your manifest (e.g., `my-app`) is what you'll enter when running `create-plugin` to initialize your project.

For more information on managing apps, run:

```bash
vertesia apps --help
```

## Initialize a Vertesia Plugin Project

Run the command line command:

```bash
npm init @vertesia/plugin
```

Follow the instructions on screen. You will be prompted for:

1. **Package manager**: Choose between npm or pnpm
2. **Plugin name**: Use kebab-case (e.g., my-plugin)
3. **Plugin version**: Semantic version (e.g., 1.0.0)
4. **Description**: Optional description of your plugin
5. **Isolation strategy**: Choose between:
   - **Shadow DOM**: Fully isolated plugin using Shadow DOM (recommended)
   - **CSS-only isolation**: Lighter isolation using CSS scope, but may have style conflicts

## Project Structure

The generated project is a TypeScript + React + Vite project with the following structure:

- `src/plugin.tsx` - Main plugin component entry point
- `src/routes.tsx` - Plugin routing configuration
- `src/pages.tsx` - Plugin pages
- `vite.config.ts` - Vite configuration for building the plugin
- `package.json` - Package configuration with plugin metadata

## Developing and deploying Your Plugin

Look at the README file in the boostrapped project to learn how to develop and deploy your plugin.

## Learn More

- [Vertesia Documentation](https://docs.vertesiahq.com/)
