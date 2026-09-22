import { describe, expect, it } from 'vitest';
import { pcm16LeToWav } from './AudioPanel.js';

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
