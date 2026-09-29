# Authentication and branding

## Custom authentication screens

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

## Default brand assets

The canonical Vertesia artwork is exported as `@vertesia/ui/assets/logo-light.png`,
`@vertesia/ui/assets/logo-dark.png`, and `@vertesia/ui/assets/icon.svg`. These files ship with
this package. Hosts can resolve and copy them into their static output at the URLs used by
`vertesiaBranding` (`/logo-light.png`, `/logo-dark.png`, `/icon.svg`), or import them through
an asset-aware bundler. The SVG is shared by the default favicon and loading artwork.

## Shared branding configuration

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

The template defaults to the canonical images in `@vertesia/ui/assets/*`; the Vite branding
adapter embeds those package references just like local assets. No copied Vertesia images are needed
in `public/`. Set `favicon` explicitly in the branding configuration; it is independent of `loadingIcon`.

## App theme and component spinners

Branding configuration controls the shared authentication and boot presentation. For the overall app
and admin UI, override semantic CSS variables in the app stylesheet (`src/ui/index.css` in the plugin template) (light and dark themes). Keep
layout styling in app components and reuse the shared UI stylesheet.

`loadingIcon` controls boot/auth loaders; it does not replace every inline `Spinner`. To customize
those too, wrap the relevant application tree with `SpinnerIconProvider` from `@vertesia/ui/core`.
Its `value` is a React component accepting `SpinnerIconProps`; apply its `className` to preserve the
resolved size and caller styles. Give custom artwork an accessible label and respect reduced motion.
Omitting the provider keeps the standard inline SVG spinner.

Template branding is selected at build time: rebuild and republish the app after changing it.
It does not automatically inherit a host deployment's brand setting. A central sign-in service owns
its own branding; an embedded app uses the host's authentication flow.

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

## Auth screen previews

In `pnpm dev`, open `/?__vertesia_auth=email`. The corner selector links to all shared login,
redirect-pending, loading, and recovery states. Direct links use these values:

- Before redirect: `email`, `providers`, `tenant`, `returning`, `pending`, `blocked`.
- After redirect: `loading`, `signup`, `restricted`, `scope-project`, `scope-account`, `no-account`,
  `credentials`, `service`, `auth-error`.
- Permissions: `permissions`, `permission-retry`, `permission-error`, `permission-denied`,
  `permission-session-expired`.

`/?__vertesia_boot=slow` keeps the real pre-React loader visible through its slow/reload timers.
Append `&__vertesia_boot_theme=light` or `dark` to select a theme. These are visual fixtures,
not an authentication round-trip test: built-in preview forms are inert and no session provider is mounted.
Branding and optional screen overrides are reused. Custom overrides should also avoid effects in preview.
The template enables previews only in Vite development; production ignores these selectors.

Other hosts can share the same fixtures using `mountAuthScreenPreview(container, screen, branding?, screens?)`
from `@vertesia/ui/shell`, invoked from an `import.meta.env.DEV` branch before mounting their auth providers.

`Env.init(props, import.meta.env)` also reads `VITE_VERTESIA_ACCOUNT_ID` and `VITE_VERTESIA_PROJECT_ID`
as the default auth workspace. With a valid accessible project, sign-in initializes that project directly,
so the application can open without manual account/project selection. Explicit URL `a`/`p` selection
wins as a whole pair; configured defaults precede stored browser selection. Hosts may provide
`props.defaultAuthSelection` instead. The setting chooses scope and does not bypass app permissions.
