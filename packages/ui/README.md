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

// Widget components, including the form, code editor and JSON viewer widgets
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

## Color conventions

Use `bg-background text-foreground` for pages, `bg-card text-card-foreground` for cards,
and `bg-popover text-popover-foreground` for dialogs. Page and card surfaces are white in light
mode. Reserve `bg-muted` for subdued areas; muted text is `text-muted-foreground`.

Color names describe surfaces and `-foreground` names describe their text/icons. Status panels
pair `bg-success text-success-foreground` (likewise info, attention, destructive, and done).
Primary actions use `<Button>` with its default primary variant, which pairs a blue background
with `text-primary-foreground`. Avoid overriding button label colors.

All standard utilities use the named color token. `/50` changes opacity, never the selected token.
The CSS compiler contract is checked by `src/__tests__/theme.test.ts`; contrast is checked by
`src/__tests__/contrast.test.ts`. Verify rendered states in both themes as well.

See [the migration guide](COLOR-MIGRATION.md) before updating an existing consumer to this theme.

### Custom authentication screens

`VertesiaShell` accepts optional `authScreens: AuthScreens` components:

- `SignIn` receives `SignInScreenViewProps` from `@vertesia/ui/shell`: sign-in flow state and transitions,
  `authError`, reusable default form `children` and `notice`, logo/positioning preferences, and
  callbacks for account reset, sanitized-scope continuation, retry, and signup. It owns the whole
  page layout; retain `children` for the shared tenant-resolution and authentication forms.
  `flow.onProviderClicked` only changes presentation state; it does not initiate a provider redirect.
  Use `flow.mode` to replace the provider-redirect pending screen. The shell retains loading,
  signed-in, allowed-path, and error-suppression guards.
- `Loading` receives `AuthLoadingScreenProps` from `@vertesia/ui/shell`. It owns the entire
  authentication loading page without any imposed layout or animation. It disappears immediately
  when authentication finishes or a token becomes available.
- `Permissions` receives `PermissionLoadingScreenProps` from `@vertesia/ui/features`: the
  `loading`/`retrying`/`error` status, localized title/description, optional error and loading icon,
  and an appropriate recovery `actionLabel`/`onAction`. This is a presentation override only;
  application children never render until permissions are available.

Omitted entries retain existing screens and logo/loading-icon behavior. Define component functions
outside render so state does not reset on parent renders. All screens are under the session, theme,
and translation providers, but outside the permission context and application providers.

See `templates/plugin-template/src/modules/app/ui/auth/` for editable application examples. These
options customize app-owned pages; they neither enable Firebase mode nor theme external provider
or central-auth pages.


`@vertesia/ui/boot` supports the pre-React stage separately: pass app-authored `html` and `styles`
to `createBootScreenVitePlugin()` or `injectBootScreenHtml()`. HTML replaces the default inner loader;
CSS is inlined after the default boot styles. The outer `#loading-indicator` owns the handoff and
supplies `.vboot` / `.vboot-dark`. The optional root CSS variable `--vertesia-boot-background` sets
first-paint document color. These inputs must be trusted static developer content. Automatic startup
also reveals the optional slow-notice/reload elements after 10/30 seconds and wires `data-boot-reload`
buttons. Hosts with their own startup/error controller can continue using `autoStart: false`.

### Shared branding configuration

`defineAppBranding` and `AppBranding` from `@vertesia/ui/boot` define the data-only branding contract.
Pass resolved configuration as `<VertesiaShell branding={branding}>` for shared branded login,
authentication-loading, and permission screens. `authScreens` entries override individual defaults.
Without `branding`, existing shell presentation remains unchanged.

Branding reuses the existing sign-in, animated loading-icon, permission-recovery, and pre-React
layouts. Configuration changes assets, theme values, and copy while preserving spacing and controls.
The `loadingIcon` light/dark assets are separate from the sign-in `logo`. Omitted color and font
settings retain the existing theme. Different layouts require explicit screen or boot HTML overrides.


The Node-only `createAppBrandingPlugin(config, configModuleUrl)` from `@vertesia/ui/boot/vite` resolves
relative image/font paths, exposes `virtual:vertesia-branding`, and generates the boot HTML/CSS, title,
and favicon. Local assets are embedded for base-path independence; import this adapter only in Vite config.
The `@vertesia/ui/boot` entry remains free of React, Node, and Vite dependencies.

The plugin template README contains the full configuration example and custom HTML/CSS escape hatch.
Copy overrides are scoped to the shell and preserve shared translation resources. Colors are scoped to
each screen; decorative accent and button foreground/background are separate settings.


Applications using Vite can pass `import.meta.env` as the second argument to `Env.init(props, import.meta.env)`
to enable `VITE_AUTH_MODE` (`firebase` or `central`) and the `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` build settings.
Complete Firebase settings select Firebase mode when the mode is omitted; partial settings fail at startup.
Valid injected runtime configuration takes precedence, while explicit `props.firebase` and `window.AUTH_MODE`
retain their existing priority. Set `props.endpoints.auth` separately for the central authentication URL.

Loading-logo motion is configurable in `loadingIcon`, for both pre-React boot and authentication loading:

```ts
loadingIcon: {
    light: './assets/icon.svg',
    animation: 'my-app-dim 2s ease-in-out infinite',
    keyframes: '@keyframes my-app-dim { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }',
},
```

`animation` accepts a CSS animation shorthand; `keyframes` contains optional trusted app-authored CSS
and is embedded before first paint. Use app-specific keyframe names to avoid collisions.
Set `animation: 'none'` for a static logo. Omitting it preserves the default spin/pulse treatment;
a custom animation replaces both. Reduced-motion preferences disable loading-logo animation.
This changes logo motion only; permission/recovery layout and explicitly overridden screens remain app-controlled.
