import { ApplicationFailure, log } from '@temporalio/activity';
import { RequestError } from '@vertesia/api-fetch-client';
import type { DSLActivityExecutionPayload, DSLActivitySpec } from '@vertesia/common';
import { setupActivity } from '../../dsl/setup/ActivityContext.js';
import { DocumentNotFoundError } from '../../errors.js';
import { execActivityFile, initializeActivityCommandDeadline, rethrowIfActivityStopped } from './exec.js';

const FFPROBE_MAX_BUFFER = 1024 * 1024; // 1MB is more than enough for stream metadata JSON

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

    // ffprobe reads only the container headers via HTTP range requests.
    // -probesize 32k caps the amount read from the network to ~32 KB.
    // ffprobe emits no frame=/time= progress, so the stall watchdog does not apply here; the shared exec wrapper still
    // propagates Activity cancellation and bounds the read by the Activity deadline, and passing the URL as an argv
    // entry (not a shell string) removes the shell-interpolation surface.
    let stdout: string;
    try {
        ({ stdout } = await execActivityFile(
            'ffprobe',
            ['-v', 'quiet', '-probesize', '32k', '-print_format', 'json', '-show_streams', url],
            { maxBuffer: FFPROBE_MAX_BUFFER },
        ));
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
