import { act, render } from '@testing-library/react';
import type { AudioResult } from '@vertesia/common';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioPanel, pcm16LeToWav } from './AudioPanel.js';

describe('pcm16LeToWav', () => {
    it('adds a WAV header for 16-bit little-endian PCM', async () => {
        const pcm = new Uint8Array([0x01, 0x00, 0xff, 0x7f]).buffer;
        const wav = new DataView(await pcm16LeToWav(pcm, { sampleRate: 24_000, channels: 1 }).arrayBuffer());

        expect(String.fromCharCode(...new Uint8Array(wav.buffer, 0, 4))).toBe('RIFF');
        expect(String.fromCharCode(...new Uint8Array(wav.buffer, 8, 4))).toBe('WAVE');
        expect(wav.getUint16(22, true)).toBe(1);
        expect(wav.getUint32(24, true)).toBe(24_000);
        expect(wav.getUint16(34, true)).toBe(16);
        expect(String.fromCharCode(...new Uint8Array(wav.buffer, 36, 4))).toBe('data');
        expect(wav.getUint32(40, true)).toBe(4);
        expect([...new Uint8Array(wav.buffer, 44)]).toEqual([0x01, 0x00, 0xff, 0x7f]);
    });
});

const { client } = vi.hoisted(() => ({ client: { files: { getDownloadUrl: vi.fn() } } }));
vi.mock('@vertesia/ui/core', () => ({ Spinner: () => null }));
vi.mock('@vertesia/ui/i18n', () => ({ useUITranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => ({ client }) }));

const audio: AudioResult = {
    type: 'audio',
    value: 'artifact:sample.pcm',
    mime_type: 'audio/pcm',
    container: 'raw',
    codec: 'pcm',
    sample_rate: 24000,
    channels: 1,
    sample_encoding: 'int16',
    byte_order: 'little',
};

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    client.files.getDownloadUrl.mockReset();
});

describe('AudioPanel cancellation', () => {
    it('aborts an in-flight PCM download on unmount without reporting an error', async () => {
        let downloadSignal: AbortSignal | undefined;
        const fetchMock = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    downloadSignal = init.signal ?? undefined;
                    downloadSignal?.addEventListener('abort', () => reject(downloadSignal?.reason), { once: true });
                }),
        );
        vi.stubGlobal('fetch', fetchMock);
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const view = render(createElement(AudioPanel, { url: '/sample.pcm', audio }));
        expect(fetchMock).toHaveBeenCalledOnce();

        await act(async () => view.unmount());

        expect(downloadSignal?.aborted).toBe(true);
        expect(log).not.toHaveBeenCalled();
    });

    it('does not start a PCM download when a signed URL resolves after unmount', async () => {
        let resolveUrl!: (value: { url: string }) => void;
        client.files.getDownloadUrl.mockReturnValue(
            new Promise<{ url: string }>((resolve) => {
                resolveUrl = resolve;
            }),
        );
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const view = render(createElement(AudioPanel, { source: audio.value, audio }));
        expect(client.files.getDownloadUrl).toHaveBeenCalledWith(audio.value);
        view.unmount();

        await act(async () => resolveUrl({ url: '/sample.pcm' }));

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
