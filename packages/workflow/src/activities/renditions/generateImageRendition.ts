import { log } from "@temporalio/activity";
import { DSLActivityExecutionPayload, DSLActivitySpec } from "@vertesia/common";
import { setupActivity } from "../../dsl/setup/ActivityContext.js";
import { DocumentNotFoundError, WorkflowParamNotFoundError } from "../../errors.js";
import { saveBlobToTempFile } from "../../utils/blobs.js";
import {
    ImageRenditionParams,
    uploadRenditionPages,
} from "../../utils/renditions.js";

interface GenerateImageRenditionParams extends ImageRenditionParams { }

export interface GenerateImageRendition
    extends DSLActivitySpec<GenerateImageRenditionParams> {
    name: "generateImageRendition";
}

export async function generateImageRendition(
    payload: DSLActivityExecutionPayload<GenerateImageRenditionParams>,
) {
    const {
        client,
        objectId,
        params: originParams,
    } = await setupActivity<GenerateImageRenditionParams>(payload);

    // Fix: Use maxHeightWidth if max_hw is not provided
    const params = {
        ...originParams,
        max_hw: originParams.max_hw || (originParams as any).maxHeightWidth || 1596, // Default to 1596 if both are missing
        format: originParams.format || (originParams as any).format_output || "png", // Default to png if format is missing
    };

    log.debug(`Generating image rendition for ${objectId}`, {
        originParams,
        params,
    });

    const inputObject = await client.objects.retrieve(objectId).catch((err) => {
        log.error(`Failed to retrieve document ${objectId}`, { err });
        if (err.message.includes("not found")) {
            throw new DocumentNotFoundError(`Document ${objectId} not found`, [objectId]);
        }
        throw err;
    });

    if (!inputObject) {
        log.error(`Document ${objectId} not found`);
        throw new DocumentNotFoundError(`Document ${objectId} not found`, [objectId]);
    }

    if (!params.format) {
        log.error(`Format not found`);
        throw new WorkflowParamNotFoundError(`format`);
    }

    if (!inputObject.content?.source) {
        log.error(`Document ${objectId} has no source`);
        throw new DocumentNotFoundError(`Document ${objectId} has no source`, [objectId]);
    }

    if (
        !inputObject.content.type ||
        !inputObject.content.type?.startsWith("image/")
    ) {
        log.error(
            `Document ${objectId} is not an image or a video: ${inputObject.content.type}`,
        );
        throw new DocumentNotFoundError(
            `Document ${objectId} is not an image or a video: ${inputObject.content.type}`,
            [objectId],
        );
    }

    //array of rendition files to upload
    let renditionPages: string[] = [];

    const imageFile = await saveBlobToTempFile(
        client,
        inputObject.content.source,
    );
    log.debug(`Image ${objectId} copied to ${imageFile}`);
    renditionPages.push(imageFile);


    //IF no etag, log and use use object id as etag
    if (!inputObject.content.etag) {
        log.warn(`Document ${objectId} has no etag, using object id as etag`);
    }
    const contentEtag = inputObject.content.etag ?? inputObject.id;

    const uploaded = await uploadRenditionPages(
        client,
        contentEtag,
        [imageFile],
        params,
    );

    if (!uploaded || !uploaded.length || !uploaded[0]) {
        log.error(`Failed to upload rendition for ${objectId}`, { uploaded });
        throw new Error(
            `Failed to upload rendition for ${objectId} - upload object is empty`,
        );
    }

    return {
        uploads: uploaded.map((u) => u),
        format: params.format,
        status: "success",
    };
}
