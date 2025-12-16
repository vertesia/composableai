# @vertesia/ui

React components, hooks, and utilities for building Vertesia-powered applications. This library provides a comprehensive set of UI primitives and feature components designed to work seamlessly with the Vertesia platform.

## Installation

```bash
npm install @vertesia/ui
# or
pnpm add @vertesia/ui
```

## Subpath Exports

The package is organized into focused subpath exports:

```typescript
// Core components and hooks
import { Button, Input, ... } from "@vertesia/ui/core";

// Layout components
import { Layout, Sidebar, ... } from "@vertesia/ui/layout";

// Feature components (agents, PDF viewer, permissions, etc.)
import { AgentConversation, PDFViewer, ... } from "@vertesia/ui/features";

// Form components
import { Form, FormField, ... } from "@vertesia/ui/form";

// Code editors and viewers
import { CodeEditor, JSONEditor, ... } from "@vertesia/ui/code";

// Widget components
import { Chart, DataTable, ... } from "@vertesia/ui/widgets";

// Router utilities
import { NavLink, useRouter, ... } from "@vertesia/ui/router";

// Session management
import { useSession, SessionProvider, ... } from "@vertesia/ui/session";

// Environment utilities
import { useEnv, ... } from "@vertesia/ui/env";

// Shell components
import { Shell, ... } from "@vertesia/ui/shell";
```

## Features

### Core Components

Base UI components built on Radix UI primitives:

- Buttons, inputs, checkboxes, labels
- Dialogs, popovers, tooltips
- Tabs, separators
- Command palette (cmdk)

### Feature Components

High-level components for Vertesia functionality:

- Agent conversation UI
- PDF viewer and Magic PDF
- Permission management
- Activity documentation
- Faceted search
- User management

### Layout System

Flexible layout components:

- Resizable panels
- Responsive layouts
- Navigation components

### Code Editing

Monaco-based code editors:

- JSON editor with validation
- Code highlighting
- CodeMirror integration

### Hooks

Useful React hooks for common patterns:

- Data fetching
- Form handling
- State management

## Peer Dependencies

This package requires React 18+ and is designed to work with Tailwind CSS.

## API Reference

For detailed API documentation, visit [docs.vertesiahq.com](https://docs.vertesiahq.com).

## License

Apache-2.0
