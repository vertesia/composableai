import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build as buildFunction } from '@vercel/node';

// Runs against the installed, built app produced by the template integration test, not the template tree.
const projectPath = resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'Pass the generated app directory');
const appRequire = createRequire(join(projectPath, 'package.json'));
const builderRequire = createRequire(import.meta.resolve('@vercel/node'));
const { glob, download } = builderRequire('@vercel/build-utils');
const { build: bundleProbe } = appRequire('esbuild');
const config = JSON.parse(await readFile(join(projectPath, 'vercel.json'), 'utf8'));
const origin = 'https://generated-app.vercel.app';
const scratch = await mkdtemp(join(tmpdir(), 'generated-vercel-'));

try {
    const buildPath = join(scratch, 'build');
    await cp(projectPath, buildPath, { recursive: true });
    const html = await readFile(join(projectPath, config.outputDirectory, 'app/index.html'), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
    assert.ok(
        assets.some((asset) => asset.endsWith('.js')),
        'Missing generated entry script',
    );
    assert.ok(
        assets.some((asset) => asset.endsWith('.css')),
        'Missing generated stylesheet',
    );
    for (const asset of assets) {
        const url = new URL(asset, `${origin}/app/deep/route`);
        assert.ok(url.pathname.startsWith('/app/assets/'), `Asset escapes the Vercel mount: ${url}`);
        assert.ok((await readFile(join(projectPath, config.outputDirectory, url.pathname))).length);
    }
    assert.ok(config.rewrites.some((route) => route.source === '/app/(.*)' && route.destination === '/app/index.html'));
    assert.equal(config.redirects.find((route) => route.source === '/').destination, '/app');
    const metadataRoute = config.rewrites.findIndex(
        (route) => route.source === '/.well-known/oauth-client/vertesia-app',
    );
    assert.ok(metadataRoute >= 0 && metadataRoute < config.rewrites.findIndex((route) => route.source === '/api/(.*)'));

    for (const entrypoint of ['api/oauth-client.ts', 'api/index.js']) {
        const built = await buildFunction({
            files: await glob('**', { cwd: projectPath, ignore: ['node_modules/**', '.git/**'] }),
            entrypoint,
            workPath: buildPath,
            config: { projectSettings: { nodeVersion: '24.x', installCommand: '', buildCommand: 'node -e ""' } },
            considerBuildCommand: true,
            meta: {},
        });
        const lambda = built.output;
        assert.equal(lambda.type, 'Lambda');
        const isolatedPath = join(scratch, entrypoint.replaceAll('/', '-'));
        await download(lambda.files, isolatedPath);
        // A fresh process has only Vercel's traced files. Resolving an import from the source
        // checkout or its node_modules would conceal the missing dependency regression.
        const invoke = spawnSync(
            process.execPath,
            [
                '--input-type=module',
                '-e',
                `
            import assert from 'node:assert/strict';
            import { pathToFileURL } from 'node:url';
            const handler = await import(pathToFileURL(process.argv[1]).href);
            const metadata = process.argv[2] === 'metadata';
            const response = await handler.GET(new Request(metadata
                ? '${origin}/.well-known/oauth-client/vertesia-app' : '${origin}/api'));
            assert.equal(response.status, 200);
            const body = await response.json();
            if (metadata) {
                assert.equal(body.client_id, '${origin}/.well-known/oauth-client/vertesia-app');
                assert.deepEqual(body.redirect_uris, ['${origin}/app']);
                assert.equal(body.token_endpoint_auth_method, 'none');
                assert.ok(body.scope.includes('openid'));
            } else assert.equal(body.message, 'Vertesia Tools API');
        `,
                join(isolatedPath, lambda.handler),
                entrypoint.endsWith('.ts') ? 'metadata' : 'api',
            ],
            {
                cwd: isolatedPath,
                env: { ...process.env, NODE_PATH: '', APP_OAUTH_SCOPES: 'openid profile account:member content:read' },
                encoding: 'utf8',
                timeout: 30_000,
            },
        );
        assert.equal(invoke.status, 0, invoke.stderr || invoke.stdout);
        console.log(`Vercel production function executes from its isolated package: ${entrypoint}`);
    }

    for (const mode of ['central', 'firebase']) {
        const publicEnv = {
            DEV: false,
            PROD: true,
            VITE_AUTH_MODE: mode,
            VITE_VERTESIA_STUDIO_URL: 'https://api.example.test',
            VITE_VERTESIA_ZENO_URL: 'https://store.example.test',
            VITE_VERTESIA_STS_URL: 'https://sts.example.test',
            ...(mode === 'central'
                ? { VITE_OAUTH_CLIENT_ID: 'vts_installed_app' }
                : {
                      VITE_FIREBASE_API_KEY: 'test-public-key',
                      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
                      VITE_FIREBASE_PROJECT_ID: 'test',
                      VITE_FIREBASE_APP_ID: 'test-app',
                      VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
                  }),
        };
        const bundled = await bundleProbe({
            absWorkingDir: projectPath,
            stdin: {
                contents: `import { Env } from '@vertesia/ui/env';
                import { validateLocalAuthConfiguration } from './src/ui/env.ts';
                validateLocalAuthConfiguration();
                globalThis.authProbe = { mode: window.AUTH_MODE, oauth: Env.oauth, firebase: Env.firebase };`,
                resolveDir: projectPath,
                loader: 'ts',
            },
            bundle: true,
            write: false,
            format: 'iife',
            platform: 'browser',
            define: { 'import.meta.env': JSON.stringify(publicEnv) },
            plugins: [
                {
                    name: 'host-boundaries',
                    setup(builder) {
                        builder.onResolve(
                            { filter: /^(virtual:vertesia-branding|@vertesia\/ui\/shell)$/ },
                            ({ path }) => ({
                                path,
                                namespace: 'host-boundaries',
                            }),
                        );
                        builder.onLoad({ filter: /.*/, namespace: 'host-boundaries' }, ({ path }) => ({
                            contents: path.startsWith('virtual:')
                                ? 'export default { name: "Generated app" };'
                                : 'export async function requestIframeHostAuthToken() { return undefined; }',
                        }));
                    },
                },
            ],
        });
        const window = { location: new URL(`${origin}/app`) };
        window.parent = window;
        const context = { window, document: {}, URL, console };
        runInNewContext(bundled.outputFiles[0].text, context);
        assert.equal(context.authProbe.mode, mode);
        if (mode === 'central') {
            assert.equal(context.authProbe.oauth.clientId, 'vts_installed_app');
            assert.equal(context.authProbe.oauth.redirectUri, `${origin}/app`);
        } else {
            assert.equal(context.authProbe.oauth, undefined);
            assert.equal(context.authProbe.firebase.projectId, 'test');
        }
        console.log(`Generated app initializes the real SDK from VITE_AUTH_MODE=${mode}`);
    }
    console.log('Generated Vercel app: assets, deep routes, production functions and auth modes passed');
} finally {
    await rm(scratch, { recursive: true, force: true });
}
