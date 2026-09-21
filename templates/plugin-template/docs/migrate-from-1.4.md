# Migrating a release/1.4 template app to iframe hosting and configurable auth

Audience: apps generated with `npm create @vertesia/plugin` from the release/1.4 template line
(`@vertesia/ui` 1.4.x). Scope: the minimal changes to make such an app (a) embeddable by Studio in
an iframe with host-provided auth and (b) correctly configured per environment/region for
authentication. It does not cover the wider 1.5 template restructure (`src/ui/app/` →
`src/ui/shell/` + `src/modules/app/`, generated wiring, hooks/subscriptions) — an app can adopt
this migration without moving files.

## Background: what changed and where auth URLs live

- **Iframe auth handshake** — `@vertesia/ui` 1.5 adds `requestIframeHostAuthToken` and the
  `vertesia:iframe-*` postMessage protocol (`@vertesia/ui/shell`), plus the `Env.authTokenProvider`
  hook (`@vertesia/ui/env`). When the app runs inside a trusted Studio host iframe, it asks the
  parent window for a Vertesia token instead of redirecting through Central Auth. Standalone
  (top-level) it resolves `undefined` and the normal sign-in flow runs unchanged. None of this
  exists in `@vertesia/ui` 1.4.x, so **the dependency upgrade is a hard prerequisite**.
- **The Central Auth UI URL is not app configuration.** It is defined inside
  `@vertesia/ui/session` (login redirect and logout). `Env.endpoints` has no `auth` entry. When
  `internal-auth.vertesia.app` is replaced by `auth.<region>.vertesia.io`, the change ships in
  `@vertesia/ui`; apps pick it up by upgrading the dependency and rebuilding. Note the consequence:
  already-published bundles keep the URL they were built with, so the old auth hostname must keep
  answering until affected apps are rebuilt.
- **What IS app configuration is the STS endpoint.** The Central Auth redirect carries
  `?sts=<Env.endpoints.sts>`, and all API/auth traffic targets `Env.endpoints.*`. The 1.5 template
  makes these required build-time inputs (`VITE_VERTESIA_STUDIO_URL`, `VITE_VERTESIA_ZENO_URL`,
  `VITE_VERTESIA_STS_URL`) with no hardcoded production fallback — a misconfigured build fails at
  bootstrap instead of silently talking to the wrong region.
- **Default hosting mode flipped** from `isolation: 'shadow'` (host page loads
  `/lib/plugin.js` into a shadow root, sharing the host session) to `isolation: 'iframe'` (host
  embeds the standalone `/app/` build; auth arrives via the postMessage handshake).

## Migration steps

### 1. Upgrade `@vertesia/*` dependencies to the 1.5 line

In `package.json`, bump every `@vertesia/*` dependency the 1.4 template pinned
(`@vertesia/ui`, `@vertesia/client`, `@vertesia/common`, `@vertesia/tools-sdk`,
`@vertesia/tools-admin-ui`, and the dev deps `@vertesia/build-tools`, `@vertesia/plugin-builder`)
to the same 1.5 release line, then reinstall. Keep them on one line — mixing 1.4 and 1.5 packages
is not supported.

### 2. `src/ui/env.ts` — required endpoints + iframe token provider

Replace the 1.4 pattern (hardcoded production fallbacks, `VITE_STUDIO_URL` names, no token
provider) with:

```ts
import { Env } from '@vertesia/ui/env';
import { requestIframeHostAuthToken } from '@vertesia/ui/shell';

const CONFIG__PLUGIN_TITLE = 'My App';

document.title = CONFIG__PLUGIN_TITLE;

function requiredEnv(name: 'VITE_VERTESIA_STUDIO_URL' | 'VITE_VERTESIA_ZENO_URL' | 'VITE_VERTESIA_STS_URL'): string {
    const value = import.meta.env[name];
    if (!value) {
        throw new Error(`${name} is required at build time. Set it in .env.app or .env.app.local.`);
    }
    return value;
}

Env.init({
    name: CONFIG__PLUGIN_TITLE,
    version: '1.0.0',
    isLocalDev: true,
    isDocker: true,
    type: 'development',
    endpoints: {
        studio: requiredEnv('VITE_VERTESIA_STUDIO_URL'),
        zeno: requiredEnv('VITE_VERTESIA_ZENO_URL'),
        sts: requiredEnv('VITE_VERTESIA_STS_URL'),
    },
    authTokenProvider: requestIframeHostAuthToken,
});
```

The two changes that matter:

- `authTokenProvider: requestIframeHostAuthToken` — enables host-token auth when iframed; a no-op
  when standalone.
- Required, renamed endpoint vars — do not keep `https://api.vertesia.io` /
  `https://sts.vertesia.io` fallbacks. A build for another region that silently falls back to
  production surfaces as CORS/401 in the browser; failing at bootstrap is deliberate. The
  `VITE_VERTESIA_*` names align with what the appgen pipeline injects.

### 3. Rename the env vars everywhere they appear

- `.env.app` (and any `.env.app.local`): `VITE_STUDIO_URL` → `VITE_VERTESIA_STUDIO_URL`,
  `VITE_ZENO_URL` → `VITE_VERTESIA_ZENO_URL`, `VITE_STS_URL` → `VITE_VERTESIA_STS_URL`. Set them
  to your region's endpoints (there is no default anymore).
- `src/ui/vite-env.d.ts`: rename the three `ImportMetaEnv` fields to match.
- Any CI/deploy configuration (e.g. Vercel project env vars) that sets the old names.

### 4. Chrome-less rendering in the host content slot

When Studio embeds the app it appends `?__vertesia_slot=content`; the host provides navigation
chrome, so the app must skip its own `PluginLayout`. In the standalone entry (1.4: `src/ui/main.tsx`),
wrap the app route:

```tsx
import { IFRAME_APP_CONTENT_SLOT, IFRAME_APP_SLOT_PARAM, StandaloneApp, VertesiaShell } from '@vertesia/ui/shell';

const isCompositeContent =
    new URLSearchParams(window.location.search).get(IFRAME_APP_SLOT_PARAM) === IFRAME_APP_CONTENT_SLOT;

// in the 'app/*' route component:
<StandaloneApp name={appName} AccessDenied={PluginAccessDenied}>
    {isCompositeContent ? (
        <div className="h-dvh min-h-0 overflow-hidden">
            <App />
        </div>
    ) : (
        <PluginLayout>
            <App />
        </PluginLayout>
    )}
</StandaloneApp>
```

Keep `<VertesiaShell preserveSignInPath>` as in 1.4.

### 5. Switch the tool server to iframe isolation

In `src/tool-server/config.ts`, change `uiConfig`:

```ts
uiConfig: {
    isolation: 'iframe',   // was: 'shadow'
    src: '/app/',          // was: '/lib/plugin.js'
    available_in: ['app_portal', 'composite_app'],
    navigation: uiNavItems,
},
```

The 1.4 template already produced the standalone app build (`vite build --mode app` →
`dist/app`, routed by `vercel.json`), so no build/deploy plumbing changes — the host now loads
that build in an iframe instead of injecting the library bundle.

### 6. Rebuild, redeploy, verify

- `pnpm build` (or your PM equivalent), redeploy.
- Standalone: open the deployed app top-level — sign-in must still round-trip through Central Auth
  and land back on the deep link.
- Embedded: open the app from Studio (app portal / composite app) — it must render without its own
  sidebar/chrome and become authenticated **without any redirect** (the token arrives over
  postMessage from the Studio host).
- Local dev note: the trusted-origin check only accepts a loopback parent when the app itself runs
  on loopback, and otherwise only Studio UI hostnames over HTTPS — you cannot test the iframe
  handshake by embedding a deployed app in a local host page or vice versa across origins that
  don't meet those rules.

## FAQ

**Do I need to configure the new `auth.<region>.vertesia.io` URL in my app?**
No. The Central Auth UI location lives in `@vertesia/ui`; when the platform switches hostnames you
upgrade `@vertesia/ui` (within the supported line) and rebuild. Your app-level auth configuration
is limited to `VITE_VERTESIA_STS_URL`, which must point at your region's STS.

**Does an iframed app ever hit the auth redirect?**
Not in normal operation: the host token handshake resolves first. If the host doesn't answer
(timeout ~5s) the app falls back to the regular sign-in flow.
