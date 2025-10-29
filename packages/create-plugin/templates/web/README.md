# Vertesia Custom App Sample

A sample project demonstrating how to build a custom app/plugin for the Vertesia platform using React, TypeScript, and Vite.

## Overview

This project serves as a template for building Vertesia plugins that can be integrated into the Vertesia platform. It includes:

- React 19 with TypeScript for type-safe component development
- Tailwind CSS for styling
- Vite for fast development and optimized builds
- Dual build modes: standalone app and plugin library

## Project Structure

```txt
src/
├── app.tsx          # Main app component with router
├── plugin.tsx       # Plugin entry point for Vertesia integration
├── routes.tsx       # Application route definitions
├── pages.tsx        # Page components
└── main.tsx         # Dev mode entry point
```

## Getting Started

### Prerequisites

- Node.js
- pnpm (or npm)

### Installation

```bash
pnpm install
```

### Development

Run the app in development mode with hot module replacement:

```bash
pnpm dev
```

The app will be available at `https://localhost:5173`.

### Building

Build both standalone app and plugin library:

```bash
pnpm build
```

Or build individually:

```bash
# Build standalone app
pnpm build:app

# Build plugin library
pnpm build:lib
```

The plugin library will be output to the `lib/` directory.

## Plugin Configuration

The plugin metadata is defined in [package.json](package.json):

```json
"plugin": {
  "title": "Vertesia Custom App",
  "publisher": "vertesia",
  "external": false,
  "status": "beta"
}
```

## Key Features

### Dual Build Modes

- **App Mode**: Builds a standalone application for development and testing
- **Library Mode**: Builds a plugin that can be integrated into the Vertesia platform

### Plugin Integration

The plugin exports a component that responds to different slots:

```tsx
export default function VertesiaCustomAppPlugin({ slot }: { slot: string }) {
  if (slot === "page") {
    return <App />;
  }
  return null;
}
```

### External Dependencies

When building as a plugin, React and Vertesia dependencies are externalized to prevent duplication:

- `react` / `react-dom`
- `@vertesia/common`
- `@vertesia/ui`

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS 4** - Styling
- **@vertesia/ui** - Vertesia UI components
- **@vertesia/plugin-builder** - Plugin build utilities

## Development Notes

- The dev server uses HTTPS (via `@vitejs/plugin-basic-ssl`)
- CSS can be inlined in the plugin bundle or kept separate (configured in [vite.config.ts](vite.config.ts))
- For debugging Vertesia UI sources, set `VERTESIA_UI_PATH` in [vite.config.ts](vite.config.ts)

## License

See package.json for license information.
