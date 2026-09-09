import type { AppUINavItem } from '@vertesia/common';

/**
 * Sidebar entries this app contributes to the Vertesia Composite App shell, published in the app
 * manifest as `ui.navigation`. It maps routes that already exist -- it does not create them.
 *
 * Mirror the composed routes `src/ui/app-ui-modules.tsx` exports across every active UI module,
 * taking each with a `label` and no `hideFromNav`. A scaffold selected with extra modules serves
 * their routes too, so this default starts incomplete for those apps.
 *
 * Nest a sub-page under its parent with `children`; it needs its own `/parent/child` route, and
 * nesting never comes from the path. `icon` is a Lucide name. Leave `preferredSection` unset for the
 * main section; `'settings'` for settings/admin, `'footer'` only when asked.
 */
export default [{ label: 'Home', icon: 'Home', route: '/' }] satisfies AppUINavItem[];
