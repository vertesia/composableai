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
    max_hw: originParams.max_hw || (originParams as any).maxHeightWidth || 1024, // Default to 1024 if both are missing
    format: originParams.format || (originParams as any).format_output || "png", // Default to png if format is missing
  };

  log.info(`Generating video rendition for ${objectId}`, {
    originParams,
    params,
  });

  const inputObject = await client.objects.retrieve(objectId).catch((err) => {
    log.error(`Failed to retrieve document ${objectId}`, { err });
    if (err.message.includes("not found")) {
      throw new NoDocumentFound(`Document ${objectId} not found`, [objectId]);
    }
    throw err;
  });

  if (!params.format) {
    log.error(`Format not found`);
    throw new WorkflowParamNotFound(`format`);
  }

  if (!inputObject.content?.source) {
    log.error(`Document ${objectId} has no source`);
    throw new NoDocumentFound(`Document ${objectId} has no source`, [objectId]);
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
  const thumbnailPath = path.join(tempOutputDir, "thumbnail.png");

  try {
    // Extract a frame at 10% of the video duration
    await new Promise<void>((resolve, reject) => {
      ffmpeg.ffprobe(videoFile, (err, metadata) => {
        if (err) {
          log.error(`Failed to probe video metadata: ${err.message}`);
          return reject(err);
        }

        const duration = metadata.format.duration || 0;
        const timestamp = Math.max(0.1 * duration, 1);

        ffmpeg(videoFile)
          .screenshots({
            timestamps: [timestamp],
            filename: "thumbnail.png",
            folder: tempOutputDir,
            size: `${params.max_hw}x?`,
          })
          .on("end", () => {
            log.info(`Video frame extraction complete for ${objectId}`);
            resolve();
          })
          .on("error", (err) => {
            log.error(`Error extracting frame from video: ${err.message}`);
            reject(err);
          });
      });
    });

    if (fs.existsSync(thumbnailPath)) {
      renditionPages.push(thumbnailPath);
    } else {
      throw new Error(`Failed to generate thumbnail for video ${objectId}`);
    }
  } catch (error) {
    log.error(
      `Error generating image rendition for video: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    throw new Error(
      `Failed to generate image rendition for video: ${objectId}`,
    );
  }

  if (!renditionPages || !renditionPages.length) {
    log.error(`Failed to generate rendition for ${objectId}`);
    throw new Error(`Failed to generate rendition for ${objectId}`);
  }

  const uploaded = await uploadRenditionPages(
    client,
    objectId,
    [thumbnailPath],
    params,
  );

  return {
    uploads: uploaded.map((u) => u),
    format: params.format,
    status: "success",
  };
}
