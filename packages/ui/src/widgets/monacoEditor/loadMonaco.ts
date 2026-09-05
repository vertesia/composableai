/**
 * Single entry point for pulling in the Monaco React wrapper, and the single place that pins the
 * Monaco runtime version.
 *
 * Two rules this module exists to enforce:
 *
 *   1. `@monaco-editor/react` must never be reachable from an app's *static* startup graph. It was
 *      imported at the top of composable-ui's `main.tsx` (only to call `loader.config`), which put
 *      it in the entry chunk and therefore in the generated `<link rel="modulepreload">` closure —
 *      every page load fetched the Monaco wrapper, including the ones that never open an editor.
 *   2. Whichever code path loads Monaco first must apply the version pin, because
 *      `@monaco-editor/loader` is a process-wide singleton and `config()` is only honored before
 *      its `init()`. Routing every consumer through {@link loadMonacoReact} makes the pin travel
 *      with the import instead of depending on a boot-time side effect.
 *
 * A consumer that already holds the module (a static `import { Editor } from '@monaco-editor/react'`
 * in a route chunk, where the deferred-loading rule above does not apply) calls
 * {@link configureMonacoLoader} with its own `loader` instead, so both paths share this version.
 */

/**
 * Pin the Monaco runtime to 0.55.1 to match the locally-installed `monaco-editor` types. The
 * default loader (@monaco-editor/loader@1.5.0) hardcodes 0.52.2, which lacks the top-level
 * `monaco.json` / `monaco.css` namespaces those types reference — editors that set up JSON Schema
 * diagnostics via `monaco.json.jsonDefaults` fail at runtime with "Cannot read properties of
 * undefined (reading 'jsonDefaults')".
 */
const MONACO_VS_URL = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs';

/** The slice of `@monaco-editor/loader` this module needs, kept structural to avoid an import. */
interface MonacoLoader {
    config(params: { paths: { vs: string } }): unknown;
}

let configured = false;

/**
 * Point the Monaco loader at the pinned runtime. Idempotent: `config()` is a no-op once the loader
 * has initialized, so repeat calls from several consumers must not fight over it.
 */
export function configureMonacoLoader(loader: MonacoLoader): void {
    if (configured) return;
    configured = true;
    loader.config({ paths: { vs: MONACO_VS_URL } });
}

let monacoReact: Promise<typeof import('@monaco-editor/react')> | undefined;

/**
 * Import `@monaco-editor/react` on demand with the version pin applied before the module is handed
 * out, so no caller can mount an `Editor` against the unpinned default. The promise is memoized:
 * concurrent callers share one module instance and one `config()` call.
 *
 * A failed import is not memoized -- a transient chunk or CDN error would otherwise make every
 * later attempt fail instantly for the rest of the session, with nothing left to retry. Note that
 * this only restores retries for direct callers: `MonacoEditor` reaches this through React's
 * `lazy()`, which keeps a rejection cache of its own that a remount does not clear.
 */
export function loadMonacoReact(): Promise<typeof import('@monaco-editor/react')> {
    monacoReact ??= import('@monaco-editor/react').then(
        (mod) => {
            configureMonacoLoader(mod.loader);
            return mod;
        },
        (err) => {
            monacoReact = undefined;
            throw err;
        },
    );
    return monacoReact;
}
