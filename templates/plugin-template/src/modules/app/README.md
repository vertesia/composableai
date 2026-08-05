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
    ├── dashboards/
    ├── hooks/
    ├── interactions/
    ├── mcp/
    ├── processes/
    ├── skills/
    ├── templates/
    ├── tools/
    └── types/
```

The shared app shell lives under `src/ui/shell`. It owns layout, top-level app routing, and common
chrome. Keep app-specific pages, feature code, and resource definitions in this module instead of
adding them to `src/ui/shell`.

## Routes And Module Mounts

The `app` module owns the root route `/`. Use it for the app home, dashboard, or a redirect to the
module that should open first.

Other UI modules should mount under stable prefixes so they compose without route conflicts. For
example, the content app module mounts under `/content`, and an assistant/chat module may mount
under `/chat` or `/assistant`.

To make another module the app home, redirect from the app route instead of importing that module's
page directly:

```tsx
import { redirectTo } from '@vertesia/ui/router';
import { HomeIcon } from 'lucide-react';

export const routes = [
    {
        path: '/',
        label: 'nav.home',
        icon: HomeIcon,
        Component: redirectTo('/content'),
    },
];
```

Redirecting keeps the target module's internal navigation consistent with its prefix.

## Adding A UI Feature

1. Create `src/modules/app/ui/features/<feature-name>/` when the feature has more than one small file.
2. Put route-level wrappers in `src/modules/app/ui/pages/`.
3. Add or update route entries in `src/modules/app/ui/routes.tsx`.
4. Use shared shell components from `src/ui/shell/components` or `src/ui/shell/layouts` only when needed.

## Adding Vertesia Resources

Add definitions to the matching folder under `src/modules/app/resources/` and export them from that
folder's `index.ts`. The module codegen collects these exports into the tool server package.

The tool-server bootstrap only exposes generated module contributions. When introducing a new contribution type,
add its typed empty default to this app module and update the template codegen `SERVER_RESOURCES` list; do not add an
app-owned registry directly under `src/tool-server/`.

Register lifecycle and event hooks in `resources/hooks/index.ts`. Event hooks use kebab-case names, receive the
standard `{ event, delivery }` webhook envelope, and are advertised through `/api/package?scope=hooks`.
