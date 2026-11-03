import { ApplicationFailure, log } from '@temporalio/activity';
import { RequestError } from '@vertesia/api-fetch-client';
import type { DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../../errors.js';
import { initializeActivityCommandDeadline, rethrowIfActivityStopped } from './exec.js';
import { execOnVideoInput, type VideoInput, videoInputOptions } from './videoSource.js';

/**
 * ffprobe arguments that list the streams of `input` as JSON. `-probesize 32k` caps how much is read to find the
 * streams, so over a URL ffprobe reads only the container headers with range requests.
 */
export function buildStreamProbeArgs(input: Extract<VideoInput, { kind: 'url' }>): string[] {
    return [
        '-v',
        'quiet',
        '-probesize',
        '32k',
        '-print_format',
        'json',
        '-show_streams',
        ...videoInputOptions(input),
        input.url,
    ];
}

export interface ProbeMediaStreamsResult {
    hasVideo: boolean;
    hasAudio: boolean;
}

export type ProbeMediaStreamsParams = Record<string, never>;

export interface ProbeMediaStreams extends DSLActivitySpec<ProbeMediaStreamsParams> {
    name: 'probeMediaStreams';
}

interface FFProbeStream {
    codec_type: string;
}

interface FFProbeOutput {
    streams: FFProbeStream[];
}

export async function probeMediaStreams(
    payload: DSLActivityExecutionPayload<ProbeMediaStreamsParams>,
): Promise<ProbeMediaStreamsResult> {
    initializeActivityCommandDeadline();
    const { client, objectId } = await setupActivity<ProbeMediaStreamsParams>(payload);

    const inputObject = await client.objects.retrieve(objectId).catch((err: unknown) => {
        log.error(`Failed to retrieve object ${objectId}`, { err });
        if (err instanceof RequestError && err.status === 404) {
            throw new DocumentNotFoundError(`Object ${objectId} not found`, [objectId]);
        }
        throw err;
    });

    const source = inputObject.content?.source;
    if (!source) {
        throw new DocumentNotFoundError(`Object ${objectId} has no source`, [objectId]);
    }

    const { url } = await client.files.getDownloadUrl(source);
    if (!url) {
        throw new DocumentNotFoundError(`Failed to get download URL for object ${objectId}`);
    }

    // ffprobe emits no frame=/time= progress, so the stall watchdog does not apply here. The reconnect options and
    // their read timeout bound a stalled connection, the exec wrapper propagates Activity cancellation, and the signed
    // URL is redacted from any error. Passing the URL as an argv entry (not a shell string) removes the
    // shell-interpolation surface.
    const input = { kind: 'url', url } as const;
    let stdout: string;
    try {
        ({ stdout } = await execOnVideoInput(input, 'ffprobe', buildStreamProbeArgs(input)));
    } catch (err: unknown) {
        rethrowIfActivityStopped(err);
        const message = err instanceof Error ? err.message : String(err);
        log.error(`ffprobe failed for object ${objectId}: ${message}`);
        throw new Error(`Failed to probe media streams for object ${objectId}: ${message}`);
    }

    const { streams } = JSON.parse(stdout) as FFProbeOutput;
    const hasVideo = streams.some((s) => s.codec_type === 'video');
    const hasAudio = streams.some((s) => s.codec_type === 'audio');

    log.info(`Media probe result for object ${objectId}`, { hasVideo, hasAudio });

    if (!hasVideo && !hasAudio) {
        throw ApplicationFailure.nonRetryable(`No audio or video streams found in container for object ${objectId}`);
    }

    return { hasVideo, hasAudio };
}
