import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { build, loadConfigFromFile, preview as servePreview } from 'vite';

const configFile = new URL('../../vite.config.ts', import.meta.url).pathname;

for (const [name, vercel, relative, mount] of [
    ['plain static host', false, false, '/'],
    ['Vercel', true, false, '/app/'],
    ['app gateway', false, true, '/tenants/05948c_98b1eb/apps/example/versions/v1/app/'],
    ['app gateway with Vercel env present', true, true, '/tenants/05948c_98b1eb/apps/example/versions/v1/app/'],
]) {
    test(`${name}: built entry assets resolve at the serving mount`, async () => {
        const previous = { VERCEL: process.env.VERCEL, VITE_RELATIVE_BASE: process.env.VITE_RELATIVE_BASE };
        const root = mkdtempSync(join(tmpdir(), 'template-assets-'));
        try {
            process.env.VERCEL = vercel ? '1' : '0';
            process.env.VITE_RELATIVE_BASE = relative ? '1' : '0';
            const loaded = await loadConfigFromFile({ command: 'build', mode: 'app' }, configFile);
            assert.ok(loaded);
            writeFileSync(
                join(root, 'index.html'),
                '<html><head></head><body><script type="module" src="/main.js"></script></body></html>',
            );
            writeFileSync(join(root, 'main.js'), "import './style.css'; console.log('app');");
            writeFileSync(join(root, 'style.css'), 'body { margin: 0; }');
            await build({
                configFile: false,
                root,
                base: loaded.config.base,
                logLevel: 'silent',
                build: { outDir: 'dist/app' },
            });
            const html = readFileSync(join(root, 'dist/app/index.html'), 'utf8');
            const paths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
            assert.equal(paths.length, 2);
            // The gateway injects this base; Vercel and plain static hosts do not.
            const baseUrl = new URL(relative ? mount : '/app/deep/route', 'https://deployment.example');
            for (const path of paths) {
                const url = new URL(path, baseUrl);
                assert.ok(url.pathname.startsWith(`${mount}assets/`), url.href);
                const file = url.pathname.slice(mount.length);
                assert.ok(readFileSync(join(root, 'dist/app', file)).length > 0);
            }
            const dev = await loadConfigFromFile({ command: 'serve', mode: 'app' }, configFile);
            assert.equal(dev.config.base, '/');
            const preview = await loadConfigFromFile({ command: 'serve', mode: 'app', isPreview: true }, configFile);
            assert.equal(preview.config.base, '/');
            if (!relative) {
                // Exercise real preview routing: assets retain their build mount, while / remains usable.
                const server = await servePreview({
                    configFile: false,
                    root,
                    base: preview.config.base,
                    logLevel: 'silent',
                    build: { outDir: 'dist/app' },
                    preview: { host: '127.0.0.1', port: 0 },
                    plugins: preview.config.plugins.filter((plugin) => plugin?.name === 'vertesia-preview-app-assets'),
                });
                try {
                    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
                    const home = await fetch(origin, { redirect: 'manual' });
                    assert.equal(home.status, 200);
                    const deep = await fetch(`${origin}/app/deep/route`);
                    assert.equal(deep.status, 200);
                    for (const asset of paths) {
                        const response = await fetch(new URL(asset, `${origin}/app/deep/route`));
                        assert.equal(response.status, 200);
                        assert.match(
                            response.headers.get('content-type'),
                            asset.endsWith('.css') ? /css/ : /javascript/,
                        );
                    }
                } finally {
                    await new Promise((resolve, reject) =>
                        server.httpServer.close((error) => (error ? reject(error) : resolve())),
                    );
                }
            }
        } finally {
            for (const [key, value] of Object.entries(previous)) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            rmSync(root, { recursive: true, force: true });
        }
    });
}
