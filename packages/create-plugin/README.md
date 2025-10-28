# @vertesia/create-plugin

This package scaffolds a Vertesia plugin project. Vertesia plugins are used to extend the Vertesia Studio UI with custom functionality and integrations.

Visit <https://vertesiahq.com> for more information about Vertesia.

## What are Vertesia Plugins?

Vertesia plugins are React-based UI components that can be embedded into the Vertesia Studio interface. They allow you to:

- Create custom UI pages and interfaces
- Integrate with external services
- Extend Vertesia's functionality with custom tools and workflows
- Build reusable components for your organization

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

## Developing Your Plugin

### Development Mode

Start the development server with hot module replacement:

```bash
npm run dev
```

This will start a local development server where you can test your plugin in isolation.

### Building the Plugin

Build your plugin for production:

```bash
npm run build
```

This command builds both:

- **App mode** (`build:app`): Standalone application for testing
- **Library mode** (`build:lib`): Distributable plugin package

The output will be in the `dist/` directory.

## Plugin Configuration

Plugins are configured in the `package.json` file under the `plugin` key:

```json
{
  "plugin": {
    "title": "My Plugin",
    "publisher": "your-org",
    "external": false,
    "status": "beta"
  }
}
```

## Dependencies

Plugins use the following key dependencies:

- **React 19**: UI framework
- **@vertesia/ui**: Vertesia UI component library
- **@vertesia/common**: Shared types and utilities
- **Tailwind CSS**: Styling system
- **Vite**: Build tool and dev server

## Learn More

- [Vertesia Documentation](https://docs.vertesiahq.com/)
