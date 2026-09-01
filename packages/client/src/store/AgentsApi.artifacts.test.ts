import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeArtifactPath } from './AgentsApi.js';
import { ZenoClient } from './client.js';

const SERVER_URL = 'https://store.test';
const RUN_ID = 'run-1';

/**
 * A client whose injected fetch records the URL of every request it is handed. The URL is read
 * off the Request object, so the assertions see the path after WHATWG URL parsing — which is
 * where an unencoded `#` was being dropped.
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

describe('encodeArtifactPath', () => {
    it('encodes the URL-significant characters that truncate a path', () => {
        expect(encodeArtifactPath('files/tpl (YYYY-0#).docx')).toBe('files/tpl%20(YYYY-0%23).docx');
        expect(encodeArtifactPath('files/report?v2.docx')).toBe('files/report%3Fv2.docx');
        expect(encodeArtifactPath('files/100% done.docx')).toBe('files/100%25%20done.docx');
    });

    it('keeps the segment separators intact so the server splat still matches', () => {
        expect(encodeArtifactPath('files/nested/a b.txt')).toBe('files/nested/a%20b.txt');
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

    it('getArtifactUrl preserves a path containing #', async () => {
        const { client, urls } = clientRecordingUrls();
        const path = 'files/Design Template (YYYY-0#).docx';

        await client.agents.getArtifactUrl(RUN_ID, path);

        expect(serverPath(urls[0], 'artifacts')).toBe(path);
        expect(new URL(urls[0]).searchParams.get('url')).toBe('1');
    });

    it.each([
        ['question mark', 'files/report?v2.docx'],
        ['percent', 'files/100% done.docx'],
        ['plain spaces', 'files/MHA - Client IQ FSD.docx'],
        ['non-ascii whitespace and accents', 'files/café résumé.docx'],
    ])('getArtifactUrl round-trips %s', async (_label, path) => {
        const { client, urls } = clientRecordingUrls();

        await client.agents.getArtifactUrl(RUN_ID, path);

        expect(serverPath(urls[0], 'artifacts')).toBe(path);
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
