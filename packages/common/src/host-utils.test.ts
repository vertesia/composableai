import { describe, expect, it } from 'vitest';
import {
    hostFromUrl,
    hostMatchesAny,
    isLocalhostOrVertesiaHost,
    isLocalhostOrVertesiaUrl,
    normalizeHost,
    normalizeHostList,
    urlMatchesAnyHost,
} from './host-utils.js';

describe('host-utils', () => {
    it('normalizes hosts, URLs, wildcards, ports, and IPv6 brackets', () => {
        expect(normalizeHost(' HTTPS://App.Example.COM:443/login ')).toBe('app.example.com');
        expect(normalizeHost('*.example.com')).toBe('example.com');
        expect(normalizeHost('localhost:3000')).toBe('localhost');
        expect(normalizeHost('[::1]:3000')).toBe('::1');
    });

    it('rejects empty and malformed hosts', () => {
        expect(normalizeHost('')).toBeUndefined();
        expect(normalizeHost('bad host')).toBeUndefined();
        expect(normalizeHost('example.com:bad')).toBeUndefined();
    });

    it('extracts hosts only from absolute URLs', () => {
        expect(hostFromUrl('https://science.nasa.gov/exoplanets')).toBe('science.nasa.gov');
        expect(hostFromUrl('science.nasa.gov/exoplanets')).toBeUndefined();
        expect(hostFromUrl('/exoplanets', 'https://science.nasa.gov/search')).toBe('science.nasa.gov');
    });

    it('deduplicates normalized host lists', () => {
        expect(normalizeHostList(['example.com', 'https://example.com/login', 'bad host'])).toEqual(['example.com']);
    });

    it('matches exact hosts and subdomains but fails closed for malformed hosts', () => {
        expect(hostMatchesAny('login.example.com', ['example.com'])).toBe(true);
        expect(hostMatchesAny('example.com', ['example.com'])).toBe(true);
        expect(hostMatchesAny('evil-example.com', ['example.com'])).toBe(false);
        expect(hostMatchesAny('bad host', ['example.com'])).toBe(false);
        expect(hostMatchesAny('bad host', [])).toBe(true);
    });

    it('matches URLs against host allowlists', () => {
        expect(urlMatchesAnyHost('https://login.example.com/path', ['example.com'])).toBe(true);
        expect(urlMatchesAnyHost('/settings', ['example.com'], 'https://login.example.com/home')).toBe(true);
        expect(urlMatchesAnyHost('http://[::1]:3000/app', ['::1'])).toBe(true);
        expect(urlMatchesAnyHost('not a url', ['example.com'])).toBe(false);
    });

    it('identifies localhost and Vertesia hosts for browser auth', () => {
        expect(isLocalhostOrVertesiaHost('localhost')).toBe(true);
        expect(isLocalhostOrVertesiaHost('[::1]')).toBe(true);
        expect(isLocalhostOrVertesiaUrl('http://[::1]:3000/app')).toBe(true);
        expect(isLocalhostOrVertesiaUrl('https://studio.vertesia.io')).toBe(true);
        expect(isLocalhostOrVertesiaUrl('https://evilvertesia.io')).toBe(false);
        expect(isLocalhostOrVertesiaUrl('not a url')).toBe(false);
    });
});
