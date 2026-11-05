import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as requestBrowser from './node-request.browser.js';
import * as request from './node-request.js';
import * as sessionsBrowser from './node-sessions.browser.js';
import * as sessions from './node-sessions.js';

describe('the browser builds of the Node-only upload modules', () => {
    it.each([
        ['node-request', request, requestBrowser],
        ['node-sessions', sessions, sessionsBrowser],
    ])('%s: exports every name the Node module exports', (_name, node, browser) => {
        expect(Object.keys(browser).sort()).toEqual(Object.keys(node).sort());
    });

    it('replace the Node modules in browser bundles', () => {
        const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
        expect(pkg.browser).toEqual({
            './lib/store/node-request.js': './lib/store/node-request.browser.js',
            './lib/store/node-sessions.js': './lib/store/node-sessions.browser.js',
        });
    });

    it('never report the Node transport as available', () => {
        expect(requestBrowser.hasNodeHttp()).toBe(false);
    });

    it('fail loudly if a Node transport is ever called', () => {
        expect(() => requestBrowser.nodeRequest()).toThrow('only available in Node.js');
        expect(() => sessionsBrowser.uploadGcsResumable()).toThrow('only available in Node.js');
        expect(() => sessionsBrowser.uploadAzureBlocks()).toThrow('only available in Node.js');
    });
});
