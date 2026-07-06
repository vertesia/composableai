/**
 * Mime types the browser can render natively in <img>, <video>, and <audio>.
 */

export const WEB_SUPPORTED_IMAGE_FORMATS = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
];

export const WEB_SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/webm'];

export const WEB_SUPPORTED_AUDIO_FORMATS = [
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
];

/**
 * Format a duration in seconds as `H:MM:SS` (or `M:SS` when under an hour).
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
