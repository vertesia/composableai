import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import os from "os";
import path from "path";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { NoDocumentFound, WorkflowParamNotFound } from "../../errors.js";
import { saveBlobToTempFile } from "../../utils/blobs.js";
import {
    ImageRenditionParams,
    uploadRenditionPages,
} from "../../utils/renditions.js";

interface GenerateVideoRenditionParams extends ImageRenditionParams {}

export interface GenerateVideoRendition
    extends DSLActivitySpec<GenerateVideoRenditionParams> {
    name: "generateImageRendition";
}

export async function generateVideoRendition(
    payload: DSLActivityExecutionPayload<GenerateVideoRenditionParams>,
) {
    const {
        client,
        objectId,
        params: originParams,
    } = await setupActivity<GenerateVideoRenditionParams>(payload);

    // Fix: Use maxHeightWidth if max_hw is not provided
    const params = {
        ...originParams,
        max_hw:
            originParams.max_hw || (originParams as any).maxHeightWidth || 1024, // Default to 1024 if both are missing
        format:
            originParams.format || (originParams as any).format_output || "png", // Default to png if format is missing
    };

    log.info(`Generating video rendition for ${objectId}`, {
        originParams,
        params,
    });

    const inputObject = await client.objects.retrieve(objectId).catch((err) => {
        log.error(`Failed to retrieve document ${objectId}`, { err });
        if (err.message.includes("not found")) {
            throw new NoDocumentFound(`Document ${objectId} not found`, [
                objectId,
            ]);
        }
        throw err;
    });

    if (!params.format) {
        log.error(`Format not found`);
        throw new WorkflowParamNotFound(`format`);
    }

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new NoDocumentFound(`Document ${objectId} has no source`, [
            objectId,
        ]);
    }

    if (
        !inputObject.content.type ||
        !inputObject.content.type?.startsWith("video/")
    ) {
        log.error(
            `Document ${objectId} is not an image or a video: ${inputObject.content.type}`,
        );
        throw new NoDocumentFound(
            `Document ${objectId} is not a video: ${inputObject.content.type}`,
            [objectId],
        );
    }

    //array of rendition files to upload
    let renditionPages: string[] = [];

    const videoFile = await saveBlobToTempFile(
        client,
        inputObject.content.source,
    );
    const tempOutputDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "video-rendition-"),
    );

    try {
        await new Promise<void>((resolve, reject) => {
            ffmpeg.ffprobe(videoFile, (err, metadata) => {
                if (err) {
                    log.error(`Failed to probe video metadata: ${err.message}`);
                    return reject(err);
                }

                const duration = metadata.format.duration || 0;

                // Calculate optimal number of thumbnails based on video length
                const calculateThumbnailCount = (
                    videoDuration: number,
                ): number => {
                    if (videoDuration <= 60) return 3; // Short videos: 3 thumbnails
                    if (videoDuration <= 300) return 5; // 5min videos: 5 thumbnails
                    if (videoDuration <= 600) return 8; // 10min videos: 8 thumbnails
                    if (videoDuration <= 1800) return 12; // 30min videos: 12 thumbnails
                    if (videoDuration <= 3600) return 16; // 1hr videos: 16 thumbnails
                    return 20; // Longer videos: max 20 thumbnails
                };

                const thumbnailCount = calculateThumbnailCount(duration);

                // Generate evenly spaced timestamps, avoiding very beginning and end
                const timestamps: number[] = [];
                const startOffset = Math.min(duration * 0.05, 5); // Skip first 5% or 5 seconds
                const endOffset = Math.min(duration * 0.05, 5); // Skip last 5% or 5 seconds
                const usableDuration = duration - startOffset - endOffset;

                for (let i = 0; i < thumbnailCount; i++) {
                    const progress = (i + 1) / (thumbnailCount + 1); // Evenly distribute
                    const timestamp = startOffset + usableDuration * progress;
                    timestamps.push(Math.max(timestamp, 1));
                }

                log.info(
                    `Generating ${thumbnailCount} thumbnails for ${duration}s video`,
                    {
                        objectId,
                        duration,
                        thumbnailCount,
                        timestamps: timestamps.map((t) => Math.round(t)),
                    },
                );

                ffmpeg(videoFile)
                    .screenshots({
                        timestamps: timestamps,
                        filename: "thumb_%03d.png", // 001, 002, 003, etc.
                        folder: tempOutputDir,
                        size: `${params.max_hw}x?`,
                    })
                    .on("end", () => {
                        log.info(
                            `Video thumbnail extraction complete for ${objectId}`,
                        );

                        // Collect all generated thumbnails in order
                        const generatedThumbnails = [];
                        for (let i = 1; i <= thumbnailCount; i++) {
                            const thumbnailPath = path.join(
                                tempOutputDir,
                                `thumb_${String(i).padStart(3, "0")}.png`,
                            );
                            if (fs.existsSync(thumbnailPath)) {
                                generatedThumbnails.push(thumbnailPath);
                            }
                        }

                        if (generatedThumbnails.length === 0) {
                            return reject(
                                new Error(
                                    `No thumbnails were generated for video ${objectId}`,
                                ),
                            );
                        }

                        renditionPages.push(...generatedThumbnails);
                        log.info(
                            `Successfully generated ${generatedThumbnails.length} thumbnails for ${objectId}`,
                        );
                        resolve();
                    })
                    .on("error", (err) => {
                        log.error(
                            `Error extracting frames from video: ${err.message}`,
                        );
                        reject(err);
                    });
            });
        });

        if (!renditionPages || renditionPages.length === 0) {
            throw new Error(
                `Failed to generate thumbnails for video ${objectId}`,
            );
        }
    } catch (error) {
        log.error(
            `Error generating thumbnails for video: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw new Error(`Failed to generate thumbnails for video: ${objectId}`);
    }

    // Update the final upload call to handle multiple thumbnails
    const uploaded = await uploadRenditionPages(
        client,
        objectId,
        renditionPages, // Now contains multiple thumbnail paths
        params,
    );

    return {
        uploads: uploaded.map((u) => u),
        format: params.format,
        thumbnailCount: renditionPages.length,
        status: "success",
    };
}
