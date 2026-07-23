import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import { apiServerPlugin } from '@vertesia/build-tools/vite';
import { vertesiaPluginBuilder } from '@vertesia/plugin-builder';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { type ConfigEnv, defineConfig, type Plugin, type UserConfig } from 'vite';
import serveStatic from 'vite-plugin-serve-static';

/**
 * List of dependencies that must be bundled in the plugin bundle
 */
const INTERNALS: (string | RegExp)[] = [];

function isExternal(id: string) {
    // If it matches INTERNALS → bundle it
    if (INTERNALS.some((pattern) => (pattern instanceof RegExp ? pattern.test(id) : id === pattern))) {
        return false;
    }

    // Otherwise → treat all bare imports (node_modules deps) as external
    return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('@/') && !id.startsWith('virtual:');
}

/**
 * if you want to debug vertesia ui sources define a relative path to the vertesia ui package root
 */
const VERTESIA_UI_PATH = '';

const REACT_IMPORT_MAP_PLACEHOLDER = '<!-- vertesia-react-importmap -->';
const STALE_ASSET_RECOVERY_PLACEHOLDER = '<!-- vertesia-stale-asset-recovery -->';
const nodeRequire = createRequire(import.meta.url);
let cachedReactImportMapHtml: string | undefined;

function getPackageVersion(packageName: string): string {
    const packageJsonPath = nodeRequire.resolve(`${packageName}/package.json`);
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version?: string };
    if (!packageJson.version) {
        throw new Error(`Unable to resolve ${packageName} package version`);
    }
    return packageJson.version;
}

function getReactImportMapHtml(): string {
    if (cachedReactImportMapHtml) {
        return cachedReactImportMapHtml;
    }

    const reactVersion = getPackageVersion('react');
    const reactDomVersion = getPackageVersion('react-dom');
    if (reactVersion !== reactDomVersion) {
        throw new Error(
            `React import map requires react and react-dom versions to match; got ${reactVersion} and ${reactDomVersion}`,
        );
    }

    const imports = {
        react: `https://esm.sh/react@${reactVersion}`,
        'react-dom': `https://esm.sh/react-dom@${reactDomVersion}`,
        'react-dom/client': `https://esm.sh/react-dom@${reactDomVersion}/client`,
        'react/jsx-runtime': `https://esm.sh/react@${reactVersion}/jsx-runtime`,
        'react/jsx-dev-runtime': `https://esm.sh/react@${reactVersion}/jsx-dev-runtime`,
    };

    cachedReactImportMapHtml = `<script type="importmap">
${JSON.stringify({ imports }, null, 2)}
  </script>`;
    return cachedReactImportMapHtml;
}

function reactImportMapPlugin(): Plugin {
    return {
        name: 'vertesia-react-import-map',
        transformIndexHtml(html) {
            const importMapHtml = getReactImportMapHtml();
            if (html.includes(REACT_IMPORT_MAP_PLACEHOLDER)) {
                return html.replace(REACT_IMPORT_MAP_PLACEHOLDER, importMapHtml);
            }
            return html.replace('</head>', `  ${importMapHtml}\n</head>`);
        },
    };
}

function getStaleAssetRecoveryHtml(): string {
    return `<script>
    (() => {
      const reloadParam = '__vertesia_reload';
      const storageKey = 'vertesia:stale-asset-reload';

      function reloadOnce() {
        try {
          const url = new URL(window.location.href);
          const reloadKey = window.location.origin + window.location.pathname;
          const alreadyRetried =
            url.searchParams.has(reloadParam) || window.sessionStorage.getItem(storageKey) === reloadKey;

          if (alreadyRetried) return;

          window.sessionStorage.setItem(storageKey, reloadKey);
          url.searchParams.set(reloadParam, String(Date.now()));
          window.location.replace(url.toString());
        } catch (error) {
          console.error('Failed to recover from stale asset load:', error);
        }
      }

      window.addEventListener('vite:preloadError', (event) => {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        reloadOnce();
      });

      window.addEventListener(
        'error',
        (event) => {
          if (event.target && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK')) {
            reloadOnce();
          }
        },
        true,
      );

      window.addEventListener('load', () => {
        try {
          const url = new URL(window.location.href);
          if (!url.searchParams.has(reloadParam)) return;
          url.searchParams.delete(reloadParam);
          window.history.replaceState(window.history.state, document.title, url.pathname + url.search + url.hash);
        } catch (_error) {}
      });
    })();
  </script>`;
}

function staleAssetRecoveryPlugin(enabled: boolean): Plugin {
    return {
        name: 'vertesia-stale-asset-recovery',
        transformIndexHtml(html) {
            return html.replace(STALE_ASSET_RECOVERY_PLACEHOLDER, enabled ? getStaleAssetRecoveryHtml() : '');
        },
    };
}

/**
 * Vite configuration to build the plugin as a library or as a standalone application or to run the application in dev mode.
 * Use `vite build --mode lib` to build a library (plugin)
 * Use `vite build` or `vite build --mode app`to build a standalone application
 * Use `vite dev --mode app` to run the application in dev mode.
 */
export default defineConfig((env) => {
    if (env.mode === 'lib') {
        return defineLibConfig(env);
    } else {
        return defineAppConfig(env);
    }
});

/**
 * Vite configuration to build a library (plugin).
 * @param env - Vite configuration environment
 * @returns
 */
function defineLibConfig({ command }: ConfigEnv): UserConfig {
    const isBuildMode = command === 'build';
    if (!isBuildMode) {
        throw new Error("Library config is only available in 'build' mode. Please use 'lib' mode for library builds.");
    }
    return {
        plugins: [tailwindcss(), react(), vertesiaPluginBuilder({ input: 'src/ui/index.css' })],
        build: {
            outDir: 'dist/lib', // the plugin will be generated in the `dist/lib` directory
            lib: {
                entry: './src/ui/plugin.tsx', // Main entry point of your library
                formats: ['es'], // Build ESM versions
                fileName: 'plugin',
            },
            minify: true,
            sourcemap: true,
            rollupOptions: {
                external: isExternal,
            },
        },
    };
}

/**
 * Vite configuration to run the application in dev mode
 * or to build a standalone application.
 * @returns
 */
function defineAppConfig({ command }: ConfigEnv): UserConfig {
    // Vercel dev proxies to the framework dev server over HTTP — HTTPS would break that.
    const useHttps = !process.env.VERCEL;
    const base = command === 'build' ? '/app/' : '/';
    const isVercelBuild = command === 'build' && process.env.VERCEL === '1';

    return {
        base, // Dev serves the admin UI at /; Vercel serves built app assets from /app/.
        plugins: [
            tailwindcss(),
            react(),
            reactImportMapPlugin(),
            staleAssetRecoveryPlugin(isVercelBuild),
            // HTTPS is required for Firebase auth but must be disabled under vercel dev
            ...(useHttps ? [basicSsl()] : []),
            // serve lib/plugin.js content in dev mode
            serveStatic([
                {
                    pattern: /\/plugin.(js|css)/,
                    resolve: (groups: string[]) => `./dist/lib/plugin.${groups[1]}`,
                },
            ]),
            // Mount the Hono tool server API as middleware (includes import transformers)
            ...apiServerPlugin(),
        ],
        build: {
            outDir: 'dist/app', // App build goes to dist/app/
        },
        // for authentication with Firebase
        server: {
            proxy: {
                '/__/auth': {
                    target: 'https://dengenlabs.firebaseapp.com',
                    changeOrigin: true,
                },
            },
        },
        resolve: {
            // For debug support in vertesia ui sources - link to the vertesia/ui location
            alias: VERTESIA_UI_PATH
                ? {
                      '@vertesia/ui': resolve(`${VERTESIA_UI_PATH}/src`),
                  }
                : undefined,
            // Deduplicate React to prevent multiple instances
            dedupe: ['react', 'react-dom'],
        },
    };
}

function resolve(path: string) {
    return new URL(path, import.meta.url).pathname;
}
