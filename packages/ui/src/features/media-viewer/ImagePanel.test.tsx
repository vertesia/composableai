import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ContentObject } from '@vertesia/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagePanel } from './ImagePanel.js';

const { download, rendition } = vi.hoisted(() => ({ download: vi.fn(), rendition: vi.fn() }));
const client = { files: { getDownloadUrl: download }, objects: { getRendition: rendition } };
vi.mock('@vertesia/ui/session', () => ({ useUserSession: () => ({ client }) }));
vi.mock('@vertesia/ui/i18n', () => ({ useUITranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
    download.mockResolvedValue({ url: 'https://example.com/image.png' });
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});

describe('image preview lifecycle', () => {
    it('loads a parameterized MIME original when no rendition is available', async () => {
        rendition.mockResolvedValue({ status: 'missing' });
        const object = {
            id: 'image',
            content: { source: 'gs://bucket/image.png', type: 'IMAGE/PNG; charset=binary' },
        } as ContentObject;
        render(<ImagePanel object={object} />);
        await screen.findByRole('img', { name: 'intakePolicy.option.image' });
        expect(download).toHaveBeenCalledWith('gs://bucket/image.png');
    });

    it('shows a recoverable error when no preview can be resolved', async () => {
        rendition
            .mockResolvedValueOnce({ status: 'missing' })
            .mockResolvedValueOnce({ status: 'found', renditions: ['https://example.com/preview.jpg'] });
        const object = {
            id: 'image',
            content: { source: 'gs://bucket/image.tiff', type: 'image/tiff' },
        } as ContentObject;
        render(<ImagePanel object={object} />);
        await screen.findByRole('alert');
        fireEvent.click(screen.getByRole('button', { name: 'agent.retry' }));
        expect((await screen.findByRole('img', { name: 'intakePolicy.option.image' })).getAttribute('src')).toBe(
            'https://example.com/preview.jpg',
        );
    });

    it('updates direct URLs when the image changes', () => {
        const { rerender } = render(<ImagePanel url="data:image/png;base64,YQ==" />);
        rerender(<ImagePanel url="data:image/webp;base64,Yg==" />);
        expect(screen.getByRole('img').getAttribute('src')).toBe('data:image/webp;base64,Yg==');
    });

    it('discards a signing response for a replaced source', async () => {
        let resolveFirst: ((value: { url: string }) => void) | undefined;
        download.mockImplementationOnce(
            () =>
                new Promise<{ url: string }>((resolve) => {
                    resolveFirst = resolve;
                }),
        );
        const { rerender } = render(<ImagePanel source="gs://bucket/first.png" />);
        await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
        rerender(<ImagePanel source="gs://bucket/second.png" />);
        await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.com/image.png'));
        await act(async () => {
            resolveFirst?.({ url: 'https://example.com/old.png' });
        });
        expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.com/image.png');
    });

    it('handles failed signing and signs a fresh URL on retry', async () => {
        download.mockRejectedValueOnce(new Error('Unavailable'));
        render(<ImagePanel source="gs://bucket/image.png" />);
        await screen.findByRole('alert');
        fireEvent.click(screen.getByRole('button', { name: 'agent.retry' }));
        await screen.findByRole('img', { name: 'intakePolicy.option.image' });
        expect(download).toHaveBeenCalledTimes(2);
    });

    it('handles decoding errors and reloads on retry', async () => {
        render(<ImagePanel url="https://example.com/image.png" />);
        fireEvent.error(screen.getByRole('img'));
        expect(screen.getByRole('alert')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'agent.retry' }));
        expect((await screen.findByRole('img', { name: 'intakePolicy.option.image' })).getAttribute('src')).toBe(
            'https://example.com/image.png',
        );
    });

    it('recovers a replacement image after the previous image failed', () => {
        const { rerender } = render(<ImagePanel url="https://example.com/first.png" />);
        fireEvent.error(screen.getByRole('img'));
        rerender(<ImagePanel url="https://example.com/second.png" />);
        expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.com/second.png');
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
