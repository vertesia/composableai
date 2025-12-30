import { DSLActivityExecutionPayload, DSLActivitySpec, GladiaConfiguration, SupportedIntegrations, AUDIO_RENDITION_NAME, VideoMetadata, ContentNature } from "@vertesia/common";
import { activityInfo, CompleteAsyncError, log } from "@temporalio/activity";
import { FetchClient, RequestError } from "@vertesia/api-fetch-client";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { DocumentNotFoundError } from "../../errors.js";
import { TextExtractionResult, TextExtractionStatus } from "../../index.js";


export interface TranscriptMediaParams {
    environmentId?: string;
    force?: boolean;
}

export interface TranscriptMedia extends DSLActivitySpec<TranscriptMediaParams> {
    name: 'TranscribeMedia';
}

export interface TranscriptMediaResult extends TextExtractionResult {
    message?: string;
}

const GLADIA_URL = "https://api.gladia.io/v2";

export async function transcribeMedia(payload: DSLActivityExecutionPayload<TranscriptMediaParams>): Promise<TranscriptMediaResult> {

    const { params, client, objectId } = await setupActivity<TranscriptMediaParams>(payload);

    const gladiaConfig = await client.projects.integrations.retrieve(payload.project_id, SupportedIntegrations.gladia) as GladiaConfiguration | undefined;
    if (!gladiaConfig || !gladiaConfig.enabled) {
        return {
            hasText: false,
            objectId,
            status: TextExtractionStatus.error,
            error: "Gladia integration not enabled",
        }
    }

    const object = await client.objects.retrieve(objectId, "+text");
    const gladiaClient = new FetchClient(gladiaConfig.url ?? GLADIA_URL);
    gladiaClient.withHeaders({ "x-gladia-key": gladiaConfig.api_key });

    if (object.text && !params.force) {
        return { hasText: true, objectId, status: TextExtractionStatus.skipped, message: "text already present and force not enabled" }
    }

    if (!object.content?.source) {
        throw new DocumentNotFoundError(`No source found for object ${objectId}`);
    }

    // Check for audio rendition in video metadata (preferred for videos)
    let mediaSource: string = object.content.source;
    if (object.metadata?.type === ContentNature.Video) {
        const videoMetadata = object.metadata as VideoMetadata;
        const audioRendition = videoMetadata.renditions?.find(r => r.name === AUDIO_RENDITION_NAME);
        if (audioRendition?.content?.source) {
            mediaSource = audioRendition.content.source;
            log.info(`Found audio rendition for video object ${objectId}`, { mediaSource });
        }
    }

    // Get download URL for the media source
    const { url: mediaUrl } = await client.files.getDownloadUrl(mediaSource);

    if (!mediaUrl) {
        throw new DocumentNotFoundError(`Error fetching media URL for ${mediaSource}`);
    }

    log.info(`Using media URL for transcription`, { objectId, mediaUrl: mediaSource });

    const taskToken = Buffer.from(activityInfo().taskToken).toString('base64url');
    const callbackUrl = generateCallbackUrlForGladia(client.store.baseUrl, taskToken, objectId);

    log.info(`Transcribing media ${mediaUrl} with Gladia`, { objectId, callbackUrl });

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

        log.info(`Transcription request sent to Gladia`, { objectId, res });
        throw new CompleteAsyncError();

    } catch (error: any) {
        if (error instanceof RequestError && error.status === 422) {
            return {
                hasText: false,
                objectId,
                status: TextExtractionStatus.error,
                error: `Gladia transcription error: ${error.message}`,
            }
        } else {
            log.error(`Error sending transcription request to Gladia for object ${objectId}`, {
                message: error?.message,
                status: error?.status,
                body: error?.body,
                stack: error?.stack,
            });
            throw error;
        }
    }
}

function generateCallbackUrlForGladia(baseUrl: string, taskToken: string, objectId: string) {
    return `${baseUrl}/webhooks/gladia/${objectId}?task_token=${taskToken}`;
}

interface GladiaTranscriptRequestResponse {
    id: string;
    result_url: string;
}
