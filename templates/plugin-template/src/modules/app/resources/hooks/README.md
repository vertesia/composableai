# Application hooks

Application hooks are authenticated server-side handlers exposed by the app runtime under `/api/hooks/<name>`.
Define their handlers in this directory and register every hook in `index.ts`.

## Lifecycle hooks

The reserved lifecycle hook names are `install` and `uninstall`. Studio calls them while reconciling the promoted app
version: `install` for the newly promoted version and `uninstall` for a previous promoted version that is replaced or
removed. A lifecycle hook receives the authenticated Vertesia client factory, decoded token payload, and installation
metadata:

```ts
import type { AppLifecycleHook } from '@vertesia/tools-sdk';

export const install: AppLifecycleHook = async ({ getClient, metadata, payload }) => {
    if (!payload.project?.id) throw new Error('A project-scoped token is required.');
    const client = await getClient();
    const project = await client.projects.retrieve(payload.project.id);
    // Create or restore project resources with client.
    console.info('App installed', metadata.app_install_id, project.name);
    return { message: `Installation completed for ${project.name}.` };
};
```

Lifecycle hooks can be invoked again, so make their operations idempotent. Register them in `index.ts`:

```ts
import type { AppHookDefinition } from '@vertesia/tools-sdk';
import { install } from './install.js';
import { uninstall } from './uninstall.js';

export const hooks = [
    { kind: 'lifecycle', name: 'install', handler: install },
    { kind: 'lifecycle', name: 'uninstall', handler: uninstall },
] satisfies AppHookDefinition[];
```

An unpromoted immutable version exposes these definitions in its package but does not run them. During candidate QA,
validate registration and package output only. Do not invoke lifecycle endpoints manually or expect their project
side effects before promotion.

## Event hooks

Event hook names must be unique kebab-case path segments; `install` and `uninstall` are reserved. An event hook
receives the canonical platform event and delivery metadata, followed by an authenticated execution context:

```ts
import type { AppEventHook } from '@vertesia/tools-sdk';

export const contentChanged: AppEventHook = async ({ event, delivery }) => {
    const title = typeof event.resource_data?.name === 'string' ? event.resource_data.name : 'Untitled content object';
    console.info('Content changed', title, delivery.attempt);
};
```

Use `event.resource_data` when the event snapshot contains the required fields. This avoids a timing race when a
resource is deleted or superseded and avoids assuming that the subscription's `run_as_role` can read the resource.
The execution context still provides `getClient()` for API calls the hook genuinely needs and is authorized to make.

Register the event handler with `kind: 'event'`, then add an app-owned subscription in
`../subscriptions/index.ts`. The subscription's `hook` must match the registered event hook name:

```ts
import { SystemRoles } from '@vertesia/common';

{
    id: 'content-changed',
    name: 'Content changed',
    hook: 'content-changed',
    filter: {
        event_category: ['content'],
        action: ['create', 'update'],
        resource_type: ['content_object'],
    },
    run_as_role: SystemRoles.automation,
}
```

Subscription definitions are visible in an unpromoted version's package, but Studio materializes them in Event Bus
only when that version is promoted. Do not expect a bare candidate to appear in the subscription list or receive
matching event deliveries.

Hooks belong to application modules, not `src/tool-server`. The generated `app-server-modules.ts` aggregates
the `hooks` and `subscriptions` exports from every selected module into the runtime configuration.
