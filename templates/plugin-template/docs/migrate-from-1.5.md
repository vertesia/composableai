# Migrating a release/1.5 template app to 1.6 authentication and branding

Audience: apps generated with `npm create @vertesia/plugin` from the release/1.5 template line
(`@vertesia/ui` 1.5.x). This guide covers configurable authentication, app-owned branding, loading
screens, and development workspace selection. It is a focused template migration, not a complete
SDK breaking-change inventory. Apps still on 1.4 should first follow [the 1.4 migration](migrate-from-1.4.md).

## Background: what changed

- Authentication can use the central broker or direct Firebase sign-in, configured through build
  environment variables. Trusted iframe hosting continues to use the host token handshake.
- One app-owned branding configuration supplies the login, authentication and permission loaders,
  tool-server admin loaders, and pre-React loading screen. The default layouts are shared with the UI library.
- Logos, colors, fonts, copy, and loading-logo animation can change without editing those layouts.
  Full component replacements are an explicit opt-in.
- Account and project environment defaults select the development workspace before authentication,
  avoiding manual selection when the user has access.

The migration requires a one-time update to template wiring. Afterward, keep your customizations in
`src/modules/app/branding/` when upgrading the template. Preserve your app routes, resources, identity,
and deployment settings; do not replace the entire app with a fresh scaffold.

## Migration steps

### 1. Upgrade dependencies together

Upgrade the app's `@vertesia/*` dependencies and dev dependencies to the same published 1.6 release
cohort, including `@vertesia/ui`, `@vertesia/tools-admin-ui`, `@vertesia/client`, `@vertesia/common`,
`@vertesia/tools-sdk`, `@vertesia/build-tools`, and `@vertesia/plugin-builder`. Reinstall with your
package manager and commit its updated lockfile. Do not copy the repository's `workspace:*` versions
into an independently deployed app.

The new template imports exports that older packages do not provide. In particular, the updated admin
UI requires `BrandedLoadingIndicator` from the matching UI package. Use a published 1.6 prerelease if
testing before the stable release is available; upgrading template files alone is insufficient.

### 2. Add the app-owned branding directory

Create `src/modules/app/branding/index.ts`:

```ts
import { defineAppBranding } from '@vertesia/ui/boot';

export default defineAppBranding({
    name: 'My App',
    logo: {
        light: './assets/logo-light.svg',
        dark: './assets/logo-dark.svg',
        alt: 'My App',
    },
    loadingIcon: { light: './assets/loading.svg' },
});
```

Add those assets beside the configuration. Paths resolve relative to this file and are embedded by
the Vite adapter, including for first paint and gateway version paths. Missing local assets fail the
build. To retain the template's Vertesia appearance, copy its branding configuration and the referenced
`public/logo-light.png`, `public/logo-dark.png`, and `public/icon.svg` instead.

Create `src/modules/app/branding/screens.ts`:

```ts
import type { AuthScreens } from '@vertesia/ui/shell';

export const appAuthScreens: AuthScreens = {};
```

Leaving this empty uses the shared layouts. Move any earlier custom login/loading components into
this directory and export them as `SignIn`, `Loading`, or `Permissions` only when their layout must
be different. Keep sign-in `children` and permission recovery `onAction` reachable.

### 3. Connect branding to both Vite targets

Merge these imports into `vite.config.ts`:

```ts
import { createAppBrandingPlugin } from '@vertesia/ui/boot/vite';
import branding from './src/modules/app/branding';
```

Add this plugin to **both** the app/dev and library build plugin arrays:

```ts
createAppBrandingPlugin(branding, new URL('./src/modules/app/branding/index.ts', import.meta.url)),
```

The adapter supplies `virtual:vertesia-branding` and injects the pre-React boot screen. Remove any
previous hand-written loading overlay, its styling, and its boot initialization from `index.html`
or Vite HTML transforms, so two boot screens do not compete. Keep the root element, main script,
language initialization, import-map marker, and stale-asset-recovery marker.

Add the virtual module declaration to `src/imports.d.ts`:

```ts
declare module 'virtual:vertesia-branding' {
    const branding: import('@vertesia/ui/boot').AppBranding;
    export default branding;
}
```

Ensure the Node/Vite TypeScript configuration includes the `DOM` library, as the current template's
`tsconfig.node.json` does. Preserve React deduplication and merge the current dev prebundling settings
into any existing lists:

```ts
optimizeDeps: { include: ['html-parse-stringify', 'use-sync-external-store/shim'] },
resolve: { dedupe: ['react', 'react-dom'] },
```

Keep existing aliases and other Vite options. The prebundling applies to ordinary `pnpm dev` too,
not only a special linked-SDK mode. Keep the UI and tools-admin source paths in your Tailwind entry
so shared layout and animation classes are generated; see [the current CSS entry](../src/ui/index.css).

### 4. Wire the shell and environment

In `src/ui/shell/AppEntry.tsx`, import:

```ts
import branding from 'virtual:vertesia-branding';
import { appAuthScreens } from '../../modules/app/branding/screens';
```

Pass them to the existing shell, preserving its children and other props:

```tsx
<VertesiaShell branding={branding} authScreens={appAuthScreens} preserveSignInPath>
    {/* Keep your existing routes and providers here. */}
</VertesiaShell>
```

For the service module, apply the same change to `src/modules/service/ui/AppEntry.tsx`, importing
screens from `../../app/branding/screens`. Preserve `authToken={runtimeAuthToken}` and the runtime
configuration setup. Do not edit generated `src/ui/app-ui-entry.tsx` to select a different entry.

In `src/ui/env.ts`, import the virtual branding and use `branding.title ?? branding.name` for the
document title and `Env.init` name. Keep the existing required Studio, Zeno, and STS endpoints and
`authTokenProvider: requestIframeHostAuthToken`. Make these two changes to the initialization:

```ts
// Add inside the existing endpoints object:
auth: import.meta.env.VITE_AUTH_SERVER_URL?.trim() || undefined,

// Pass Vite's environment as the second argument:
Env.init(props, import.meta.env);
```

Here `props` means your existing initialization object; these are edits to that initializer, not a
replacement file. The complete working version is
[the template environment module](../src/ui/env.ts). Passing `import.meta.env` enables the Firebase
and default workspace settings below. No environment values should be hardcoded into page components.

### 5. Choose authentication and development defaults

The default remains central authentication. To explicitly select a central broker:

```ini
VITE_AUTH_MODE=central
VITE_AUTH_SERVER_URL=https://your-auth-server.example.com/
```

Unlike the 1.5 guide's configuration model, the central broker URL is now configurable. This is
separate from `VITE_VERTESIA_STS_URL`, which still selects the token service.

To use direct Firebase authentication, contact Vertesia. Vertesia must configure it for your
deployment and provide the required settings. Central authentication remains the default.

Put these settings in `.env.app.local` for local development, or in Vercel's build environment.
Restart Vite after changing local settings; rebuild and redeploy after changing deployment settings.
`VITE_*` values are public browser configuration, never service-account credentials. Valid gateway
runtime authentication configuration takes precedence over build settings, and embedded apps retain
host-token authentication.

Keep the required `VITE_VERTESIA_STUDIO_URL`, `VITE_VERTESIA_ZENO_URL`, and `VITE_VERTESIA_STS_URL`.

To skip manual workspace selection during development, add:

```ini
VITE_VERTESIA_ACCOUNT_ID=your-vertesia-account-id
VITE_VERTESIA_PROJECT_ID=your-vertesia-project-id
```

These are Vertesia IDs, distinct from the Firebase project ID. Explicit URL selections (`?a=...&p=...`)
override the entire configured pair; otherwise configured IDs take precedence over browser history.
A project-only default does not reuse an unrelated cached account. These defaults do not bypass
permissions: the app still needs to be registered, installed in the selected project, and accessible
to the signed-in user. Add the two optional fields to your `ImportMetaEnv` declaration if needed.

### 6. Customize motion and optionally enable previews

For a logo that should dim rather than rotate:

```ts
loadingIcon: {
    light: './assets/loading.svg',
    animation: 'my-app-dim 2s ease-in-out infinite',
    keyframes: '@keyframes my-app-dim { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }',
},
```

This configuration applies to boot and shared branded loaders, including permissions and the admin
UI. Use `animation: 'none'` for a static logo; omit it for default motion. Reduced-motion preferences
disable animation. Custom screen components own their own motion.

For visual previews, merge the development-only preview branch from [the current main entry](../src/ui/main.tsx)
before mounting your normal app. It uses the shared `mountAuthScreenPreview` helper without mounting
session providers. Merely upgrading the dependency does not enable these query parameters in an old entry.

Once wired, inspect `/?__vertesia_auth=email`, `pending`, `loading`, `permissions`, and
`permission-error` using the gallery selector. Inspect first paint with `/?__vertesia_boot=slow`,
optionally adding `&__vertesia_boot_theme=light` or `dark`. Preview forms are inert; they do not test
an actual authentication round trip. Keep preview imports behind `import.meta.env.DEV`.

For custom HTML/CSS before React mounts, use `boot: { html: './boot.html', styles: './boot.css' }`
in the branding configuration. See [the branding reference](../README.md#fully-custom-layouts) for
recovery controls and asset handling. Do not reintroduce a second inline loader in `index.html`.

### 7. Rebuild, redeploy, and verify

Run your app's declared lint, typecheck, tests, and production build scripts. For the current template:

```bash
pnpm check
pnpm build
```

Run the app-owned unit test script (for example, `pnpm test:unit` if your app declares it);
the ungenerated repository scaffold has no application test suite. If using service hosting, also run `pnpm service:build`. Run the app's Playwright primary-flow suite
against the deployment under test. Check these cases manually as well:

- Standalone central auth: sign-in and logout use the configured broker and preserve the return path.
- Standalone Firebase: the branded login appears locally and after deployment; provider sign-in returns
  successfully and STS accepts the token.
- Embedded: the host handshake still authenticates without an unnecessary standalone redirect.
- Workspace defaults: a fresh browser session enters the configured accessible project; explicit URL
  selections win, and inaccessible projects still show recovery rather than granting access.
- Loading: boot, authentication, permissions, and admin resource pages show the configured branding.
  Fast admin requests avoid flashing a loader; slow loaders animate and disappear when content is ready.
- Appearance: check light/dark themes, reduced motion, slow-load recovery, and custom code overrides.
- Production: deep links and branding assets work at the deployed base path, and preview query
  parameters do not replace the real app.

## FAQ

**Must I adopt custom branding to upgrade dependencies?**
No. Branding is optional. The steps above enable the new template experience; leave your current
shell wiring in place if you only need an SDK upgrade, then adopt the configuration separately.

**Which files should I keep during the next template upgrade?**
Keep `src/modules/app/branding/`, its assets, and your other app-owned modules. Merge shared shell,
Vite, and entry-point updates. Routine branding should no longer require changes to those shared files.

**Why do I still see an account/project selector?**
Check that `Env.init` receives `import.meta.env`, that the dev server was restarted, and that URL
parameters are not overriding the defaults. An access-denied selector can also mean the configured
project does not have the app installed or the current user lacks access.
