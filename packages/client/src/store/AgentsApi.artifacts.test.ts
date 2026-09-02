import { afterEach, describe, expect, it, vi } from 'vitest';
import { escapeArtifactPathDelimiters } from './AgentsApi.js';
import { ZenoClient } from './client.js';

const SERVER_URL = 'https://store.test';
const RUN_ID = 'run-1';

/**
 * A client whose injected fetch records the URL of every request it is handed. The URL is read off
 * the Request object, so the assertions see the path after WHATWG URL parsing — which is where an
 * unescaped `#` was being dropped.
 */
function clientRecordingUrls(body: unknown = { url: 'https://signed', path: 'p' }) {
    const urls: string[] = [];
    const client = new ZenoClient({
        serverUrl: SERVER_URL,
        apikey: 'token',
        fetch: async (input: RequestInfo) => {
            urls.push(input instanceof Request ? input.url : String(input));
            return new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            });
        },
    });
    return { client, urls };
}

/** The artifact path the server reconstructs: the URL path after the route prefix, decoded per segment. */
function serverPath(url: string, prefix: string): string {
    const tail = new URL(url).pathname.split(`/${prefix}/`)[1] ?? '';
    return tail.split('/').map(decodeURIComponent).join('/');
}

describe('escapeArtifactPathDelimiters', () => {
    it('escapes the two characters that truncate a path', () => {
        expect(escapeArtifactPathDelimiters('files/tpl (YYYY-0#).docx')).toBe('files/tpl (YYYY-0%23).docx');
        expect(escapeArtifactPathDelimiters('files/report?v2.docx')).toBe('files/report%3Fv2.docx');
    });

    // Scope guard. Anything this helper touches changes the bytes on the wire for filenames that
    // work today, so it must leave everything except `#` and `?` exactly as it found it.
    it.each([
        ['percent', 'files/100% done.docx'],
        ['spaces', 'files/MHA - Client IQ FSD.docx'],
        ['non-ascii and accents', 'files/café résumé.docx'],
        ['backslash', 'files/back\\slash.docx'],
        ['segment separators', 'files/nested/a b.txt'],
        ['already-encoded sequence', 'files/report%23.md'],
    ])('leaves %s untouched', (_label, path) => {
        expect(escapeArtifactPathDelimiters(path)).toBe(path);
    });
});

describe('AgentsApi artifact paths', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    // A `#` in an uploaded filename used to be parsed as the URL fragment, so the server saw a
    // truncated path and stored the object under a key nothing could read back.
    it('uploadArtifact preserves a path containing #', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(null, { status: 200 })),
        );
        const { client, urls } = clientRecordingUrls();
        const path = 'files/Design Template (YYYY-0#).docx';

        await client.agents.uploadArtifact(RUN_ID, path, 'content');

        expect(urls).toHaveLength(1);
        expect(urls[0]).not.toContain('#');
        expect(serverPath(urls[0], 'artifacts')).toBe(path);
    });

    // The query is concatenated onto the path, so an unescaped delimiter took it down too.
    it.each([
        ['hash', 'files/Design (YYYY-0#).docx'],
        ['question mark', 'files/report?v2.docx'],
    ])('getArtifactUrl round-trips %s and keeps the query intact', async (_label, path) => {
        const { client, urls } = clientRecordingUrls();

        await client.agents.getArtifactUrl(RUN_ID, path, 'attachment', 'download-name.docx');

        const url = new URL(urls[0]);
        expect(serverPath(urls[0], 'artifacts')).toBe(path);
        expect(url.hash).toBe('');
        expect(url.searchParams.get('url')).toBe('1');
        expect(url.searchParams.get('disposition')).toBe('attachment');
        expect(url.searchParams.get('filename')).toBe('download-name.docx');
    });

    // Pins the scope boundary: `%` must go on the wire exactly as it does with no escaping at all.
    it('sends a path containing % exactly as it did before, unescaped', async () => {
        const { client, urls } = clientRecordingUrls();
        const path = 'files/100% done.docx';

        await client.agents.getArtifactUrl(RUN_ID, path);

        const unescaped = new URL(`${SERVER_URL}/api/v1/agents/${RUN_ID}/artifacts/${path}?url=1`);
        expect(new URL(urls[0]).pathname).toBe(unescaped.pathname);
        expect(new URL(urls[0]).pathname).toContain('100%%20done.docx');
    });

    it('getArtifactContent and updateArtifactContent preserve a path containing #', async () => {
        const { client, urls } = clientRecordingUrls({ content: '', generation: '1' });
        const path = 'files/notes (v0#1).md';

        await client.agents.getArtifactContent(RUN_ID, path);
        await client.agents.updateArtifactContent(RUN_ID, path, { content: 'x', generation: '1' });

        expect(urls).toHaveLength(2);
        for (const url of urls) {
            expect(serverPath(url, 'artifact-content')).toBe(path);
        }
    });
});
