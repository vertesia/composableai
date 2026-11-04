import { ApplicationFailure, log } from '@temporalio/activity';
import { RequestError } from '@vertesia/api-fetch-client';
import type { DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../../errors.js';
import { initializeActivityCommandDeadline, rethrowIfActivityStopped } from './exec.js';
import {
    execOnVideoInput,
    type VideoInput,
    VideoSource,
    videoInputLocation,
    videoInputOptions,
} from './videoSource.js';

/**
 * ffprobe arguments that list the streams of `input` as JSON. `-probesize 32k` caps how much is read to find the
 * streams, so over a URL ffprobe reads only the container headers with range requests.
 */
export function buildStreamProbeArgs(input: VideoInput): string[] {
    return [
        '-v',
        'quiet',
        '-probesize',
        '32k',
        '-print_format',
        'json',
        '-show_streams',
        ...videoInputOptions(input),
        videoInputLocation(input),
    ];
}

async function probeStreams(input: VideoInput): Promise<ProbeMediaStreamsResult> {
    const { stdout } = await execOnVideoInput(input, 'ffprobe', buildStreamProbeArgs(input));
    const { streams } = JSON.parse(stdout) as FFProbeOutput;
    return {
        hasVideo: streams.some((s) => s.codec_type === 'video'),
        hasAudio: streams.some((s) => s.codec_type === 'audio'),
    };
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

    // The probe reads the source over a signed URL, and downloads it only when that fails. ffprobe emits no
    // frame=/time= progress, so the stall watchdog does not apply here. The reconnect options and their read timeout
    // bound a stalled connection, the exec wrapper propagates Activity cancellation, and the signed URL is redacted
    // from any error. Passing the URL as an argv entry (not a shell string) removes the shell-interpolation surface.
    const videoSource = await VideoSource.open(client, source);
    let result: ProbeMediaStreamsResult | undefined;
    try {
        result = await videoSource.withFallback(async (input) => {
            const probed = await probeStreams(input);
            // A 32k read over HTTP that finds no stream is confirmed on the download before the file is rejected.
            return input.kind === 'url' && !probed.hasVideo && !probed.hasAudio ? undefined : probed;
        });
    } catch (err: unknown) {
        rethrowIfActivityStopped(err);
        // A failed download keeps its type, such as a non-retryable DocumentNotFoundError.
        if (err instanceof ApplicationFailure) {
            throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        log.error(`ffprobe failed for object ${objectId}: ${message}`);
        throw new Error(`Failed to probe media streams for object ${objectId}: ${message}`);
    } finally {
        await videoSource.dispose();
    }
    // Only a URL probe returns nothing, and it is then repeated on the download, which always returns its result.
    const { hasVideo, hasAudio } = result ?? { hasVideo: false, hasAudio: false };

    log.info(`Media probe result for object ${objectId}`, { hasVideo, hasAudio });

    if (!hasVideo && !hasAudio) {
        throw ApplicationFailure.nonRetryable(`No audio or video streams found in container for object ${objectId}`);
    }

    return { hasVideo, hasAudio };
}
