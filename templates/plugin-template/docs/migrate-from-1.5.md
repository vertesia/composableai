# Migrating a release/1.5 template app to 1.6

Audience: apps generated with `npm create @vertesia/plugin` from the release/1.5 template line
(`@vertesia/ui` 1.5.x). This guide covers configurable authentication, app-owned branding, loading
screens, and development workspace selection, then, for apps that Vertesia hosts through AppGen only,
[the sandboxed service runtime](#appgen-apps-hosted-by-vertesia-the-sandboxed-service-runtime)
for apps that Vertesia hosts. It is a focused template migration, not a complete SDK breaking-change inventory. Apps still on 1.4 should first follow [the 1.4 migration](migrate-from-1.4.md).

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
`@vertesia/tools-sdk`, `@vertesia/build-tools`, and `@vertesia/plugin-builder`.

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
build. To retain the template's Vertesia appearance, copy its branding configuration: it references
`@vertesia/ui/assets/*`, which the adapter embeds from the installed UI package. Remove the old
`public/logo-light.png`, `public/logo-dark.png`, `public/icon.svg`, and `public/favicon.ico` copies once
no custom code references them. Remove the hardcoded favicon link from `index.html`; the configured
`favicon` now supplies it.

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

Central authentication is the default. The 1.6 bootstrap CLI asks for your region and writes
`VITE_AUTH_SERVER_URL` alongside the Studio, Zeno, and STS URLs in `.env.app`.
Newly generated apps need no manual authentication URL setup. Local browser sign-in additionally
requires a registered public development OAuth client; the template no longer falls back to the
legacy fragment-token broker flow on localhost.

For an existing 1.5 app, add the regional auth setting to its existing `.env.app` when adopting this
wiring (the CLI does not rewrite an already generated app):

| Region | `VITE_AUTH_SERVER_URL` |
| --- | --- |
| US (`us1`) | `https://auth.us1.vertesia.io/` |
| Europe (`eu1`) | `https://auth.eu1.vertesia.io/` |

The CLI's development mode uses `https://auth.dev1.vertesia.io/` with its development API endpoints.
The auth URL selects the central broker; `VITE_VERTESIA_STS_URL` still selects the token service.

The bootstrap CLI uses the same `~/.vertesia/dev` marker file as the Vertesia CLI. When present,
its region menu also offers `dev1` and `dev2`, with their matching API and STS endpoints.
`dev2` currently uses the shared central auth broker. The marker only exposes region choices;
`--dev` remains a separate scaffold option that applies its development dependency and endpoint defaults.

To use direct Firebase authentication, contact Vertesia. Vertesia must configure it for your
deployment and provide the required settings. Central authentication remains the default.

Put these settings in `.env.app.local` for local development, or in Vercel's build environment.
Restart Vite after changing local settings; rebuild and redeploy after changing deployment settings.
`VITE_*` values are public browser configuration, never service-account credentials. Valid gateway
runtime authentication configuration takes precedence over build settings, and embedded apps retain
host-token authentication.

For localhost, ask an account admin to create a public OAuth client in **Apps Accessing Vertesia**
on the selected STS environment, with authorization code + PKCE and `token_endpoint_auth_method=none`.
Allow the app's requested scopes and register its callback. Configure `.env.app.local`:

```dotenv
VITE_OAUTH_CLIENT_ID=my-app-development
VITE_OAUTH_REDIRECT_URI=https://localhost:5173/
```

For Vercel, keep the template's public CIMD endpoint and routing, or set a separate registered public
client ID through `VITE_OAUTH_CLIENT_ID` in the deployment's build environment. Register
`https://your-app.vercel.app/app` as its callback, or set `VITE_OAUTH_REDIRECT_URI` to another
same-origin callback. No client secret belongs in the browser. See the README's standalone
authentication section for the complete hosting matrix, scope settings and preview callback rules.

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

- Standalone OAuth: localhost uses its registered development client; Vercel uses CIMD or its
  registered deployment client. Sign-in and logout preserve the return path. Missing local client
  configuration shows setup instructions instead of starting a legacy broker redirect.
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

## AppGen apps hosted by Vertesia: the sandboxed service runtime

> **Applies only to apps that Vertesia hosts through AppGen**: apps whose versions Vertesia builds and
> publishes with target `service` and serves from the Vertesia app gateway (apps generated with the
> `appgen` module, or with the `service` module and published to Vertesia).
>
> **Skip this section if you host the app yourself.** A tool server deployed to Vercel or your own
> infrastructure, or run with `pnpm dev` on localhost, keeps running on Node with the regular SDK and
> needs none of these steps. Static (UI-only) AppGen versions are unaffected as well. The one 1.6
> addition a self-hosted tool server can adopt is `context.scratch` ([S4](#s4-use-contextscratch-for-temporary-files)).

### Background: what changed

Service versions hosted by Vertesia now run in a sandboxed [workerd](https://github.com/cloudflare/workerd) runtime:
a fresh isolated process for every request, Web-platform APIs only, and no Node.js built-ins. The
caller's credential never enters that process: `context.getClient()` reaches the Vertesia API through
the platform, which applies the caller's identity and permissions. Tools can call public HTTP(S)
services directly with `fetch`.

The publish build now produces a second bundle, `lib/server-sandbox.js`, and validates it in the
pinned workerd before the version is stored. Service versions published from a 1.5 app have no such
bundle and are rejected with `422 Republish this app with the sandbox-compatible service builder`.
Every Vertesia-hosted service app must be rebuilt and republished once.

### S1. Upgrade dependencies

Complete [step 1](#1-upgrade-dependencies-together). The 1.6 `@vertesia/tools-sdk` provides the
`@vertesia/tools-sdk/sandbox` entry point and `context.scratch`.

### S2. Take the template's service builder

The publish pipeline runs **your app's copy** of the service builder with `--sandbox`. A 1.5 copy
ignores that flag, and the build fails because `lib/server-sandbox.js` is missing.

1. Replace `src/modules/service/scripts/build-server-esbuild.mjs` with
   [the current template version](../src/modules/service/scripts/build-server-esbuild.mjs). Its
   `--sandbox` mode bundles `src/tool-server/server.ts` for the browser platform and swaps
   `@vertesia/tools-sdk` for `@vertesia/tools-sdk/sandbox`.
2. Add the script and, to validate locally with the same runtime, the pinned workerd:

```json
{
    "scripts": {
        "build:sandbox": "node src/modules/service/scripts/build-server-esbuild.mjs --sandbox"
    },
    "devDependencies": {
        "workerd": "1.20261002.1"
    }
}
```

Without the dev dependency the publish build provisions the same workerd version itself.

### S3. Make tool-server code sandbox-compatible

Everything reachable from `src/tool-server/server.ts` is bundled into the sandbox. `server-node.ts`
remains the Node entry for local and self-hosted serving and is not part of that bundle.

| 1.5 pattern | 1.6 replacement |
| --- | --- |
| `node:fs`, `node:os` `tmpdir()`, or temp files | `context.scratch` (S4) |
| `Buffer` | `Uint8Array`, `TextEncoder`/`TextDecoder`, `btoa`/`atob` |
| `node:crypto` | Web Crypto: `crypto.subtle`, `crypto.getRandomValues`, `crypto.randomUUID` |
| `eval` or `new Function` | Explicit parsing; code generation from strings is disabled. See the template's [calculator tool](../src/modules/examples/resources/tools/calculator/calculator.ts) |
| `loadToolsFromDirectory`, `loadSkillsFromDirectory` | Static imports and `?skills` imports, as the template's resource indexes do |
| Forwarding `context.token`, or building a `VertesiaClient` from it | `await context.getClient()`; in the sandbox `context.token` is a placeholder, not a credential |
| `process.env` values | Compile non-secret constants into the bundle. Secret credentials are not yet available in the service runtime: keep a tool that needs one on a self-hosted tool server for now |
| Node-only npm packages | Packages that bundle for the browser platform |

`pnpm build:sandbox` fails on an unresolvable Node import; the publish-time validation also rejects
a bundle that cannot load in workerd.

### S4. Use `context.scratch` for temporary files

`context.scratch` is temporary storage private to one request, with the same behavior in the sandbox
and on Node, so the same tool code runs in both:

```ts
async run(payload, context) {
    await context.scratch.put('work/page-1.html', html);
    await context.scratch.putJson('work/state.json', { page: 2 });
    const state = await context.scratch.getJson<{ page: number }>('work/state.json');
    const files = await context.scratch.list(); // [{ key, size, contentType }]
    await context.scratch.delete('work/page-1.html');
}
```

Keys are `/`-separated relative paths. Storage starts empty and is discarded when the request ends;
write anything that must outlive it as an agent artifact or a file through `context.getClient()`.
Failures throw a `ScratchError` with code `quota_exceeded`, `invalid_key`, or `unavailable`. The quota
is 128 MiB by default; on Node, set `VERTESIA_SCRATCH_MAX_BYTES` to match a deployment with another quota.

Unit tests that construct a `ToolExecutionContext` by hand must now supply one:

```ts
import { createMemoryScratch } from '@vertesia/tools-sdk';

const context = { token, payload, getClient: async () => client, scratch: createMemoryScratch() };
```

### S5. Respect the runtime limits

Each request runs under limits set by the deployment, by default a deadline of up to 240 s, 1,024
outbound calls, 16 MiB per outbound request or response body, and 128 MiB of scratch storage. Outbound
`fetch` may use HTTP or HTTPS on any port, but private, loopback, and link-local addresses are
blocked: a tool that calls a service on `localhost` or a private network during development will fail
when hosted. Remote responses must not be compressed; the runtime requests identity encoding.

### S6. Rebuild, republish, and verify

```bash
pnpm service:build
pnpm build:sandbox
```

Confirm that `lib/server-sandbox.js` was produced, then publish a new version with target `service`
and promote it. Exercise each tool through an agent or the app's API: Vertesia API calls, remote
calls, and scratch usage. Earlier service versions keep returning `422` until they are replaced.

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

**Does my Vercel, self-hosted, or localhost tool server need the service runtime changes?**
No. The sandboxed runtime only hosts AppGen service versions on Vertesia. Self-hosted tool servers run
on Node with the regular SDK; upgrading to 1.6 there is only needed for `context.scratch`.

**Why does my existing Vertesia-hosted service version return 422?**
It was built without the sandbox bundle. Follow [the service runtime steps](#appgen-apps-hosted-by-vertesia-the-sandboxed-service-runtime) and republish.
