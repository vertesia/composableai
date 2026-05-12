# App

User application code lives here. Layout follows the standard React app structure:

```text
app/
├── App.tsx           # Root component (renders NestedRouterProvider)
├── routes.tsx        # Route definitions
├── constants.ts      # Shared constants (interaction names, etc.)
├── components/       # Shared UI components (used across features/pages)
├── features/         # Business logic grouped by feature
│   └── <feature>/
│       ├── components/   # Feature-only components
│       ├── hooks/        # Feature-only hooks
│       ├── types.ts      # Feature types
│       ├── utils.ts      # Feature helpers
│       ├── <Feature>View.tsx
│       └── index.ts      # Barrel export
├── hooks/            # Cross-feature custom hooks
├── layouts/          # Plugin chrome (PluginLayout, PluginSidebar, …)
└── pages/            # Route-level components — thin wrappers around features
```

## Adding a feature

1. Create `app/features/<feature-name>/`.
2. Build it as a self-contained module with `components/`, `hooks/`, `types.ts`, `utils.ts`, etc.
3. Export the entry view and any public types via `index.ts`.
4. Add a thin route component in `app/pages/<Feature>Page.tsx` that imports from `features/<feature-name>`.
5. Wire the route in `app/routes.tsx`.

For UI patterns and component conventions, see the `vertesia-ui` skill.

## Visual defaults

Build app screens as compact Vertesia Studio product surfaces. The default is a
light operational UI with restrained brand accents.

- Use `@vertesia/ui` components and semantic tokens before hardcoded colors.
- Prefer dense tables, queues, filters, split panes, detail pages, and process
  timelines over hero sections or oversized dashboard cards.
- Keep page titles around `text-xl`/`text-2xl`; use smaller headings inside
  panels.
- Do not force black/near-black backgrounds, neon palettes, or dark-first panels
  unless explicitly requested.
