# App Module

This module is the user-owned part of the generated app. Add business UI and Vertesia resource
definitions here.

```text
src/modules/app/
├── ui/
│   ├── routes.tsx        # App route definitions
│   ├── pages/            # Route-level components
│   ├── components/       # App-specific shared UI components
│   ├── features/         # Optional feature folders
│   └── hooks/            # Optional app-specific hooks
└── resources/
    ├── activities/
    ├── interactions/
    ├── skills/
    ├── templates/
    ├── tools/
    └── types/
```

The shared app shell lives under `src/ui/shell`. It owns layout, top-level app routing, and common
chrome. Keep app-specific pages, feature code, and resource definitions in this module instead of
adding them to `src/ui/shell`.

## Adding A UI Feature

1. Create `src/modules/app/ui/features/<feature-name>/` when the feature has more than one small file.
2. Put route-level wrappers in `src/modules/app/ui/pages/`.
3. Add or update route entries in `src/modules/app/ui/routes.tsx`.
4. Use shared shell components from `src/ui/shell/components` or `src/ui/shell/layouts` only when needed.

## Adding Vertesia Resources

Add definitions to the matching folder under `src/modules/app/resources/` and export them from that
folder's `index.ts`. The module codegen collects these exports into the tool server package.
