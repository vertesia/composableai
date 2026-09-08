import type { AppUINavItem } from '@vertesia/common';

/**
 * Sidebar navigation this app contributes to the Vertesia Composite App shell.
 *
 * Published in the app manifest as `ui.navigation`; the Composite App builds its sidebar from it.
 * This maps routes that already exist -- it does not create them. Every `route` must resolve in the
 * app's own router, so keep this in sync with `src/modules/app/ui/routes.tsx` (and any other active
 * UI module) whenever routes are added, renamed, or removed.
 *
 * Delete an entry when its route goes away: a listed `route` that does not resolve is a bug in this
 * file, not a page that is missing and needs building. The app's own sidebar components never render
 * the Composite App sidebar, so composite navigation is fixed here and nowhere else.
 *
 * A sub-page reached from inside a parent page still belongs here, nested under that parent with
 * `children` -- it needs its own route (`/parent/child`) to be listed, so a nested view rendered from
 * parent-local state with no route is a missing route first. Nesting comes from `children` alone and
 * is never inferred from the path.
 *
 * Mirror the routes that carry a `label` and are not `hideFromNav` -- the same set the app's own
 * sidebar renders. Catch-alls and redirects stay out.
 *
 * `icon` is a Lucide icon name (https://lucide.dev/icons) or an SVG element as a string; `route` is
 * relative to the app's base URL. Only `/` exists in every scaffold -- add an entry per user-facing
 * route as you build it, or use an empty array if the app has no UI.
 */
export default [{ label: 'Home', icon: 'Home', route: '/' }] satisfies AppUINavItem[];
