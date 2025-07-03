import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { exec } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { DocumentNotFoundError, WorkflowParamNotFoundError } from "../../errors.js";
import { saveBlobToTempFile } from "../../utils/blobs.js";
import {
    ImageRenditionParams,
    uploadRenditionPages,
} from "../../utils/renditions.js";

const execAsync = promisify(exec);

interface GenerateVideoRenditionParams extends ImageRenditionParams { }

export interface GenerateVideoRendition
    extends DSLActivitySpec<GenerateVideoRenditionParams> {
    name: "generateImageRendition";
}

interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
}

async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
    try {
        const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
        const { stdout } = await execAsync(command);
        const metadata = JSON.parse(stdout);

        const videoStream = metadata.streams.find(
            (stream: any) => stream.codec_type === "video",
        );
        const duration = parseFloat(metadata.format.duration) || 0;
        const width = videoStream?.width || 0;
        const height = videoStream?.height || 0;

        return { duration, width, height };
    } catch (error) {
        log.error(
            `Failed to get video metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw new Error(
            `Failed to probe video metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}

async function generateThumbnail(
    videoPath: string,
    outputDir: string,
    timestamp: number,
    maxSize: number,
): Promise<string | undefined> {
    //pad timestamp to 5 digits as filename
    const outputFile = path.join(
        outputDir,
        `thumb-${timestamp.toString().padStart(5, "0")}.jpg`,
    );

    // FFmpeg command to extract thumbnail at specific timestamp
    // Use proper scale filter syntax: scale=w:h:force_original_aspect_ratio=decrease
    const scaleFilter = `scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease`;

    const command = [
        "ffmpeg",
        "-y", // Overwrite output files
        "-ss",
        timestamp.toString(), // Seek to timestamp
        "-i",
        `"${videoPath}"`, // Input file
        "-vframes",
        "1", // Extract only 1 frame
        "-vf",
        `"${scaleFilter}"`, // Scale maintaining aspect ratio
        "-q:v",
        "2", // High quality
        `"${outputFile}"`,
    ].join(" ");
    log.info(`Generating thumbnail at ${timestamp}s`), { command };
    try {
        const { stderr } = await execAsync(command);

        // Log any warnings from ffmpeg
        if (stderr && !stderr.includes("frame=")) {
            log.debug(
                `FFmpeg stderr for thumbnail at ${timestamp}s: ${stderr}`,
            );
        }

        // Verify the file was created
        if (fs.existsSync(outputFile)) {
            log.debug(`Generated thumbnail at ${timestamp}s`);
            return outputFile;
        } else {
            log.warn(`Thumbnail not generated for timestamp ${timestamp}s`);
            return undefined;
        }
    } catch (error) {
        log.error(
            `Failed to generate thumbnail at ${timestamp}s: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        return undefined;
    }
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
            throw new DocumentNotFoundError(`Document ${objectId} not found`, [
                objectId,
            ]);
        }
        throw err;
    });

    if (!params.format) {
        log.error(`Format not found`);
        throw new WorkflowParamNotFoundError(`format`);
    }

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new DocumentNotFoundError(`Document ${objectId} has no source`, [
            objectId,
        ]);
    }

    if (
        !inputObject.content.type ||
        !inputObject.content.type?.startsWith("video/")
    ) {
        log.error(
            `Document ${objectId} is not a video: ${inputObject.content.type}`,
        );
        throw new DocumentNotFoundError(
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
        // Get video metadata using command line ffprobe
        const metadata = await getVideoMetadata(videoFile);
        const duration = metadata.duration;

        // Calculate optimal number of thumbnails based on video length
        const calculateThumbnailCount = (videoDuration: number): number => {
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
                tempOutputDir,
            },
        );

        // Generate thumbnails using command line ffmpeg
        const generatedThumbnails = await Promise.all(
            timestamps.map(async (timestamp) => {
                return await generateThumbnail(
                    videoFile,
                    tempOutputDir,
                    timestamp,
                    params.max_hw,
                );
            }),
        );

        if (generatedThumbnails.length === 0) {
            log.info(`No thumbnails were generated for video ${objectId}`, {
                objectId,
                thumbnailCount,
                tempOutputDir,
            });
            throw new Error(
                `No thumbnails were generated for video ${objectId}`,
            );
        }

        renditionPages.push(
            ...generatedThumbnails.filter(
                (thumbnail) => thumbnail !== undefined,
            ),
        );
        log.info(
            `Successfully generated ${generatedThumbnails.length} thumbnails for ${objectId}`,
            {
                objectId,
                generatedCount: generatedThumbnails.length,
                requestedCount: thumbnailCount,
            },
        );
    } catch (error) {
        log.error(
            `Error generating thumbnails for video: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw new Error(`Failed to generate thumbnails for video: ${objectId}`);
    } finally {
        // Clean up temporary video file
        try {
            if (fs.existsSync(videoFile)) {
                fs.unlinkSync(videoFile);
            }
        } catch (cleanupError) {
            log.warn(`Failed to cleanup temporary video file: ${videoFile}`);
        }
    }

    if (!inputObject.content?.etag) {
        log.warn(`Document ${objectId} has no etag, using object id as etag`);
    }
    const etag = inputObject.content.etag ?? inputObject.id;

    // Update the final upload call to handle multiple thumbnails
    const uploaded = await uploadRenditionPages(
        client,
        etag,
        renditionPages,
        params,
    );

    return {
        uploads: uploaded.map((u) => u),
        format: params.format,
        thumbnailCount: renditionPages.length,
        status: "success",
    };
}
