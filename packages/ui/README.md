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

## Accessibility (WCAG 2.1 AA baseline)

`@vertesia/ui` targets a **WCAG 2.1 AA baseline**. Most of the heavy lifting comes from the underlying Radix UI primitives (`Modal`, `Dropdown`, `Popover`, `Tooltip`, `Tabs`, `Checkbox`, `RadioGroup`, `Switch`, `Label`) — they ship with the right ARIA roles, keyboard handling, and focus management out of the box. The conventions below cover the parts the library can't enforce by construction.

### What's gated automatically

- **Biome `a11y` rule group** runs as part of `pnpm lint` (13 rules at error, 5 at warn). New code can't ship a `<button>` without `type`, an `<img>` without `alt`, a `role="..."` div where a semantic element exists, etc.
- **`vitest-axe` suite** in `src/__tests__/a11y.test.tsx` runs axe-core over representative renders of every primitive (`pnpm test`). Catches regressions in accessible names, ARIA wiring, and DOM semantics.
- **Color contrast regression test** in `src/__tests__/contrast.test.ts` validates the canonical foreground/background token pairs in `src/css/color.css` against WCAG 1.4.3 (≥ 4.5:1 normal text, ≥ 3:1 large text), with alpha compositing against the underlying surface for transparent tokens.

### Conventions

**Buttons.** Prefer `<Button>` from `@vertesia/ui/core` over raw `<button>`. Raw `<button>` is acceptable inside primitives that spread hook props onto the DOM (a downshift-style toggle, etc.) — document the reason inline.

**Icon-only buttons need an accessible name.** Pass `aria-label`:

```tsx
<Button aria-label="Close dialog" onClick={onClose}>
  <XIcon />
</Button>
```

The legacy `alt` prop is `@deprecated` — it is forwarded to `aria-label` for one release with a deduped console warning, then will be removed.

**`asChild` is safe with non-button elements.** `<Button asChild>` no longer injects a `type` attribute when rendering an `<a>` or other slotted child, and skips the loader wrap (which would otherwise pass multiple children to Radix's Slot).

**Form controls go through `<FormItem>`.** Use the new contract:

```tsx
<FormItem label="Email" helpText="We will never share your email." error={errors.email}>
  <Input value={email} onChange={setEmail} clearable={false} />
</FormItem>
```

- `helpText` and `error` render as persistent text linked to the child via `aria-describedby`. Both ids are merged into any `aria-describedby` the consumer already set.
- When `error` is set, the child also gets `aria-invalid="true"`.
- The existing `description` prop renders as a hover-only tooltip on an Info icon — it is **not** an accessibility substitute for `helpText` (screen-reader users don't see tooltips).
- Auto-wiring only fires for a **single** valid element child. Multiple children or fragments fall through unchanged with a dev-mode `console.warn`; use the `childrenId` escape hatch and set `aria-*` manually in that case.

**Input validation.** `<Input invalid>` maps to `aria-invalid="true"`. `<Input aria-describedby="…">` is passed through. Both compose with `<FormItem>` cleanly.

**Tables.** Use `<TableHeaderCell>` (defaults to `scope="col"`) and `<SortableTableHeaderCell>` (renders a real `<button>` inside the `<th>`, sets `aria-sort`):

```tsx
<SortableTableHeaderCell
  sortDirection={dir}
  onSort={() => setDir(toggle(dir))}
  sortIndicator={(d) => d === 'ascending' ? <ArrowUp /> : <ArrowDown />}
>
  Name
</SortableTableHeaderCell>
```

**SelectBox.** Trigger is now a real `<button type="button">` with `aria-haspopup="dialog"`, `aria-expanded`, and `aria-controls`. The clear control is a sibling of the trigger (not nested) to satisfy the no-nested-interactives rule. Pass `aria-label` for icon-only selects; when `label` is set, the trigger gets `aria-labelledby` automatically.

**Tab indexes.** Never use `tabIndex > 0` (Biome `noPositiveTabindex` is at error). Use `tabIndex={0}` only when wiring keyboard support onto a `<div>` that genuinely can't be a real interactive element — and add a `// biome-ignore lint/a11y/useSemanticElements` comment with the reason.

**Color tokens.** Don't hardcode colors — use the semantic Tailwind utilities (`text-foreground`, `bg-muted`, etc.). Token contrast is regression-tested; if you add a new foreground/background pair to `color.css`, add it to `PAIRS` in `contrast.test.ts`.

### Deprecated props (slated for next major)

| Prop | Migration |
|---|---|
| `Button.alt` | Use `aria-label` for the accessible name. For a visual tooltip, wrap in `<VTooltip>` or pass `title`. |
| `CopyButton.alt` | Use `aria-label`. |

Both still work for one release and emit a single deduped console warning per session.

### What's NOT gated (still requires manual review)

The axe suite is a static-DOM analyzer. It does not reliably catch focus visibility / order, label-in-name, rendered contrast in arbitrary states (hover, focus on white surface, disabled), keyboard traps, or meaningful reading order. Manual sweep checklist lives in the PR description for any non-trivial UI change.

## API Reference

For detailed API documentation, visit [docs.vertesiahq.com](https://docs.vertesiahq.com).

## License

Apache-2.0
