import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as browser from './node-request.browser.js';
import * as node from './node-request.js';

describe('the browser build of node-request', () => {
    it('exports every name the Node module exports', () => {
        expect(Object.keys(browser).sort()).toEqual(Object.keys(node).sort());
    });

    it('replaces the Node module in browser bundles', () => {
        const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
        expect(pkg.browser).toEqual({ './lib/store/node-request.js': './lib/store/node-request.browser.js' });
    });

    it('never reports the Node transport as available', () => {
        expect(browser.hasNodeHttp()).toBe(false);
    });

    it('fails loudly if the Node transport is ever called', () => {
        expect(() => browser.nodeRequest()).toThrow('only available in Node.js');
    });
});
