import type { AppUINavItem } from '@vertesia/common';

/**
 * Sidebar navigation this app contributes to the Vertesia Composite App shell.
 *
 * Published in the app manifest as `ui.navigation`; the Composite App builds its sidebar from it.
 * This maps routes that already exist -- it does not create them. Every `route` must resolve in the
 * app's own router, so keep this in sync with `src/modules/app/ui/routes.tsx` (and any other active
 * UI module) whenever routes are added, renamed, or removed.
 *
 * `icon` is a Lucide icon name (https://lucide.dev/icons) or an SVG element as a string; `route` is
 * relative to the app's base URL. Only `/` exists in every scaffold -- add an entry per user-facing
 * route as you build it, or use an empty array if the app has no UI.
 */
export default [{ label: 'Home', icon: 'Home', route: '/' }] satisfies AppUINavItem[];
