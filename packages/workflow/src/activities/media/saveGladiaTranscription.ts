import { log } from "@temporalio/activity";
import { FetchClient } from "@vertesia/api-fetch-client";
import { AudioMetadata, DSLActivityExecutionPayload, DSLActivitySpec, GladiaConfiguration, SupportedIntegrations, TranscriptSegment, VideoMetadata } from "@vertesia/common";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { TextExtractionResult, TextExtractionStatus } from "../../result-types.js";

export interface SaveGladiaTranscriptionParams {
    gladiaTranscriptionId: string;
}

export interface SaveGladiaTranscription extends DSLActivitySpec<SaveGladiaTranscriptionParams> {
    name: 'SaveGladiaTranscription';
}

const GLADIA_URL = "https://api.gladia.io/v2";

/**
 * Fetches transcription results from Gladia and saves them to the content object.
 * This activity is called after transcribeMedia completes via webhook callback.
 */
export async function saveGladiaTranscription(payload: DSLActivityExecutionPayload<SaveGladiaTranscriptionParams>): Promise<TextExtractionResult> {
    const { params, client, objectId } = await setupActivity<SaveGladiaTranscriptionParams>(payload);

    const gladiaConfig = await client.projects.integrations.retrieve(payload.project_id, SupportedIntegrations.gladia) as GladiaConfiguration | undefined;
    if (!gladiaConfig || !gladiaConfig.enabled) {
        return {
            hasText: false,
            objectId,
            status: TextExtractionStatus.error,
            error: "Gladia integration not enabled",
        };
    }

    const gladiaClient = new FetchClient(gladiaConfig.url ?? GLADIA_URL);
    gladiaClient.withHeaders({ "x-gladia-key": gladiaConfig.api_key });

    log.info(`Fetching transcription result from Gladia`, { objectId, transcriptionId: params.gladiaTranscriptionId });

    const transcriptionResult = await gladiaClient.get(`/transcription/${params.gladiaTranscriptionId}`) as GladiaTranscriptionResult;

    if (transcriptionResult.status === 'error') {
        log.error(`Gladia transcription failed`, { objectId, error: transcriptionResult });
        return {
            hasText: false,
            objectId,
            status: TextExtractionStatus.error,
            error: "Gladia transcription failed",
        };
    }

    if (transcriptionResult.status !== 'done') {
        log.warn(`Gladia transcription not ready`, { objectId, status: transcriptionResult.status });
        return {
            hasText: false,
            objectId,
            status: TextExtractionStatus.error,
            error: `Gladia transcription not ready: ${transcriptionResult.status}`,
        };
    }

    const object = await client.objects.retrieve(objectId, "+text");

    const segments = processUtterances(transcriptionResult.result.transcription.utterances);
    const fullText = transcriptionResult.result.transcription.full_transcript;

    await client.objects.update(objectId, {
        text: fullText,
        text_etag: object.content?.etag,
        transcript: {
            segments,
            etag: object.content?.etag
        },
        metadata: {
            ...object.metadata,
            duration: transcriptionResult.result.metadata.audio_duration,
            languages: transcriptionResult.result.transcription.languages
        } as AudioMetadata | VideoMetadata
    });

    log.info(`Saved transcription for object`, { objectId, textLength: fullText?.length, segmentCount: segments.length });

    return {
        hasText: (fullText?.length ?? 0) > 0,
        objectId,
        status: TextExtractionStatus.success,
        message: `Transcription saved with ${segments.length} segments`
    };
}

function processUtterances(utterances: GladiaUtterance[]): TranscriptSegment[] {
    return utterances.map(u => ({
        start: u.start,
        end: u.end,
        text: u.text,
        speaker: u.speaker,
        confidence: u.confidence,
        language: u.language
    }));
}

// Gladia API response types
interface GladiaTranscriptionResult {
    id: string;
    status: 'queued' | 'processing' | 'done' | 'error';
    result: {
        metadata: {
            audio_duration: number;
            number_of_distinct_channels: number;
            billing_time: number;
            transcription_time: number;
        };
        transcription: {
            full_transcript: string;
            languages: string[];
            utterances: GladiaUtterance[];
        };
    };
}

interface GladiaUtterance {
    language: string;
    start: number;
    end: number;
    confidence: number;
    channel: number;
    speaker: number;
    text: string;
}
