import { log } from "@temporalio/activity";
import { imageResizer } from "../conversion/image.js";
import fs from "fs";
import { VertesiaClient } from "@vertesia/client";
import { NodeStreamSource } from "@vertesia/client/node";
import { ImageRenditionFormat } from "@vertesia/common";

export interface ImageRenditionParams {
  max_hw: number; //maximum size of the longest side of the image
  format: ImageRenditionFormat;
}

/**
 * Get the path for all files for a rendition
 * @param objectId
 * @param params
 * @param pageNumber
 * @returns
 */
export function getRenditionsPath(
  objectId: string,
  params: ImageRenditionParams,
) {
  //if format isn't supported, throw
  if (!Object.values(ImageRenditionFormat).includes(params.format)) {
    throw new Error("Unsupported format: " + params.format);
  }

  const path = `renditions/${objectId}/${params.max_hw}`;
  return path;
}

/**
 * Get a specific page path for a rendition
 */
export function getRenditionPagePath(
  objectId: string,
  params: ImageRenditionParams,
  pageNumber: number = 1,
) {
  const path = getRenditionsPath(objectId, params);
  const pagePath = `${path}/${pageNumber}.${params.format}`;
  return pagePath;
}

/**
 * Upload Rendition page to the cloud
 */
export async function uploadRenditionPages(
  client: VertesiaClient,
  objectId: string,
  files: string[],
  params: ImageRenditionParams,
) {
  log.info(
    `Uploading rendition for ${objectId} with ${files.length} pages (max_hw: ${params.max_hw}, format: ${params.format})`,
    { files },
  );
  const uploads = files.map(async (file, i) => {
    const pageId = getRenditionPagePath(objectId, params);
    let resizedImagePath = null;

    try {
      log.info(`Resizing image for ${objectId} page ${i}`, { file, params });
      // Resize the image using ImageMagick
      resizedImagePath = await imageResizer(file, params.max_hw, params.format);

      // Create a read stream from the resized image file
      const fileStream = fs.createReadStream(resizedImagePath);
      const format = "image/" + params.format;
      const fileId = pageId.split("/").pop() ?? pageId;
      const source = new NodeStreamSource(fileStream, fileId, format, pageId);

      log.info(
        `Uploading rendition for ${objectId} page ${i} with max_hw: ${params.max_hw} and format: ${params.format}`,
        {
          resizedImagePath,
          fileId,
          format,
          pageId,
        },
      );

      const result = await client.files.uploadFile(source).catch((err) => {
        log.error(`Failed to upload rendition for ${objectId} page ${i}`, {
          error: err,
          errorMessage: err.message,
          stack: err.stack,
        });
        return Promise.reject(`Upload failed: ${err.message}`);
      });
      log.info(`Rendition uploaded for ${objectId} page ${i}`, { result });

      return result;
    } catch (err: any) {
      log.error(`Failed to upload rendition for ${objectId} page ${i}`, {
        error: err,
      });
      return Promise.reject(`Upload failed: ${err.message}`);
    }
  });

  return Promise.all(uploads);
}
