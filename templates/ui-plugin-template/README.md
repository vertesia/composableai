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

## Prerequisites

- An application manifest [created and installed](/apps/overview) in your Vertesia project

## Getting Started

### Installation

```bash
pnpm install
```

Next, set the app Id in the `VITE_APP_NAME` variable in the `.env.local` file.

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

The plugin library will be output to the `dist/lib/` directory.

## Deployment

Since this is a standard web application, you can deploy it to any static hosting provider (Vercel, Netlify, Cloudflare Pages, AWS S3, etc.).

### Deploying to Vercel

Vercel is a practical deployment option with a generous free tier. You can very simply deploy your standalone app using the Vercel CLI.

#### Setup

Install the Vercel CLI globally:

```bash
npm i -g vercel
```

#### Deployment Steps

1. **Login to Vercel**:

    ```bash
    vercel login
    ```

2. **Deploy to preview**:

    ```bash
    vercel
    ```

    This will create a preview deployment and provide you with a URL to test your app.

3. **Deploy to production**:

    ```bash
    vercel --prod
    ```

For more information, visit the [Vercel CLI documentation](https://vercel.com/docs/cli).

#### Update App Manifest with Deployment URL

After deploying to Vercel, update your app manifest to point to the deployed URL using the vertesia CLI:

```bash
vertesia apps update <appId> --manifest '{
  "name": "my-app",
  "title": "My App",
  "description": "A sample app",
  "publisher": "your-org",
  "private": true,
  "status": "beta",
  "ui": {
    "src": "https://your-app.vercel.app/lib/plugin.js",
    "isolation": "shadow"
  }
}'
```

Replace `appId` by the actual ID and `https://your-app.vercel.app` with your actual Vercel deployment URL.

## Key Features

### Dual Build Modes

- **App Mode**: Builds a standalone application for development and testing
- **Library Mode**: Builds a plugin that can be integrated into the Vertesia platform

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
