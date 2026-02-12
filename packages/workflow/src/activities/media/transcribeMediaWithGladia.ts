import { activityInfo, CompleteAsyncError, log } from "@temporalio/activity";
import { FetchClient, RequestError } from "@vertesia/api-fetch-client";
import { AUDIO_RENDITION_NAME, ContentNature, DSLActivityExecutionPayload, DSLActivitySpec, GladiaConfiguration, SupportedIntegrations, VideoMetadata } from "@vertesia/common";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { DocumentNotFoundError } from "../../errors.js";
import { TextExtractionResult, TextExtractionStatus } from "../../index.js";
import { hasText } from "../../utils/text-ref-utils.js";


export interface TranscriptMediaParams {
    environmentId?: string;
    force?: boolean;
    output_storage_path?: string;
}

export interface TranscriptMedia extends DSLActivitySpec<TranscriptMediaParams> {
    name: 'TranscribeMedia';
}

export interface TranscriptMediaResult extends TextExtractionResult {
    message?: string;
    /**
     * Gladia transcription ID for fetching results in a follow-up activity.
     * Present when async media transcription completes successfully.
     */
    gladiaTranscriptionId?: string;
}

const GLADIA_URL = "https://api.gladia.io/v2";

export async function transcribeMedia(payload: DSLActivityExecutionPayload<TranscriptMediaParams>): Promise<TranscriptMediaResult> {

    const context = await setupActivity<TranscriptMediaParams>(payload);
    const { params, client, inputType } = context;

    const gladiaConfig = await client.projects.integrations.retrieve(payload.project_id, SupportedIntegrations.gladia) as GladiaConfiguration | undefined;
    if (!gladiaConfig || !gladiaConfig.enabled) {
        return {
            hasText: false,
            objectId: inputType === 'objectIds' ? context.objectId : undefined,
            status: TextExtractionStatus.error,
            error: "Gladia integration not enabled",
        }
    }

    const gladiaClient = new FetchClient(gladiaConfig.url ?? GLADIA_URL);
    gladiaClient.withHeaders({ "x-gladia-key": gladiaConfig.api_key });

    let mediaSource: string;
    let storageId: string;

    if (inputType === 'objectIds') {
        // Object mode: fetch from object store
        const objectId = context.objectId;
        const object = await client.objects.retrieve(objectId, "+text");

        if (hasText(object) && !params.force) {
            return { hasText: true, objectId, status: TextExtractionStatus.skipped, message: "text already present and force not enabled" }
        }

        if (!object.content?.source) {
            throw new DocumentNotFoundError(`No source found for object ${objectId}`);
        }

        // Check for audio rendition in video metadata (preferred for videos)
        mediaSource = object.content.source;
        if (object.metadata?.type === ContentNature.Video) {
            const videoMetadata = object.metadata as VideoMetadata;
            const audioRendition = videoMetadata.renditions?.find(r => r.name === AUDIO_RENDITION_NAME);
            if (audioRendition?.content?.source) {
                mediaSource = audioRendition.content.source;
                log.info(`Found audio rendition for video object ${objectId}`, { mediaSource });
            }
        }

        storageId = objectId;
    } else {
        // File mode: use file input
        const file = context.file;
        if (!params.output_storage_path) {
            throw new DocumentNotFoundError("output_storage_path is required when using file input");
        }

        mediaSource = file.url;
        storageId = params.output_storage_path;
    }

    // Get download URL for the media source
    const { url: mediaUrl } = await client.files.getDownloadUrl(mediaSource);

    if (!mediaUrl) {
        throw new DocumentNotFoundError(`Error fetching media URL for ${mediaSource}`);
    }

    log.info(`Using media URL for transcription`, { storageId, mediaUrl: mediaSource });

    const taskToken = Buffer.from(activityInfo().taskToken).toString('base64url');
    const callbackUrl = generateCallbackUrlForGladia(client.store.baseUrl, taskToken);

    log.info(`Transcribing media ${mediaUrl} with Gladia`, { storageId, callbackUrl });

    try {
        const res = await gladiaClient.post("/transcription", {
            payload: {
                audio_url: mediaUrl,
                callback_url: callbackUrl,
                diarization_enhanced: true,
                enable_code_switching: true,
                subtitles: true,
                subtitles_config: {
                    formats: ["vtt"],
                }
            }
        }) as GladiaTranscriptRequestResponse;
        log.info(`Transcription request sent to Gladia`, { storageId, res });
    } catch (error: any) {
        if (error instanceof RequestError && error.status === 422) {
            return {
                hasText: false,
                objectId: storageId,
                status: TextExtractionStatus.error,
                error: `Gladia transcription error: ${error.message}`,
            }
        }
        log.error(`Error sending transcription request to Gladia for storage ${storageId}`, { error });
        throw error;
    }

    throw new CompleteAsyncError();
}

function generateCallbackUrlForGladia(baseUrl: string, taskToken: string) {
    return `${baseUrl}/webhooks/gladia?task_token=${taskToken}`;
}

interface GladiaTranscriptRequestResponse {
    id: string;
    result_url: string;
}
