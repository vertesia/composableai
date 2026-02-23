import { ApplicationFailure, log } from "@temporalio/activity";
import {
  ContentObjectTypeItem,
  CreateContentObjectTypePayload,
  DSLActivityExecutionPayload,
  DSLActivitySpec,
  ImageRenditionFormat,
} from "@vertesia/common";
import {
  ActivityContext,
  setupActivity,
} from "../dsl/setup/ActivityContext.js";
import { TruncateSpec, truncByMaxTokens } from "../utils/tokens.js";
import {
  InteractionExecutionParams,
  executeInteractionFromActivity,
} from "./executeInteraction.js";

const INT_SELECT_DOCUMENT_TYPE = "sys:SelectDocumentType";
const INT_GENERATE_METADATA_MODEL = "sys:GenerateMetadataModel";

export interface GenerateOrAssignContentTypeParams
  extends InteractionExecutionParams {
  typesHint?: string[];
  /**
   * truncate the input doc text to the specified max_tokens
   */
  truncate?: TruncateSpec;

  /**
   * The name of the interaction to execute
   * @default SelectDocumentType
   */
  interactionNames?: {
    selectDocumentType?: string;
    generateMetadataModel?: string;
  };
}

export interface GenerateOrAssignContentType
  extends DSLActivitySpec<GenerateOrAssignContentTypeParams> {
  name: "generateOrAssignContentType";
}

export async function generateOrAssignContentType(
  payload: DSLActivityExecutionPayload<GenerateOrAssignContentTypeParams>,
) {
  const context =
    await setupActivity<GenerateOrAssignContentTypeParams>(payload);
  const { params, client, objectId } = context;

  const interactionName =
    params.interactionNames?.selectDocumentType ?? INT_SELECT_DOCUMENT_TYPE;

  log.debug("SelectDocumentType for object: " + objectId, { payload });

  const object = await client.objects.retrieve(objectId, "+text");

  //Expects object.type to be null on first ingestion of content
  //User initiated Content Type change via the Composable UI,
  //sets object.type to null when they let Composable choose for them.
  //sets object.type to chosen type (thus non-null) when user picks a type.
  if (object.type) {
    log.warn(`Object ${objectId} has already a type. Skipping type creation.`);
    return {
      status: "skipped",
      message: "Object already has a type: " + object.type.name,
    };
  }

  if (
    !object ||
    (!object.text &&
      !object.content?.type?.startsWith("image/") &&
      !object.content?.type?.startsWith("application/pdf"))
  ) {
    log.info(`Object ${objectId} not found or text is empty and not an image`, {
      object,
    });
    return { status: "failed", error: "no-text" };
  }

  const types = await client.types.catalog.list({
    schema: true,
  });

  //make a list of all existing types, and add hints if any
  const existing_types = types.filter(
    (t) => !["DocumentPart", "Rendition"].includes(t.name),
  );
  const content = object.text
    ? truncByMaxTokens(object.text, params.truncate || 30000)
    : undefined;

  const getImage = async () => {
    if (
      object.content?.type?.includes("pdf") &&
      object.text?.length &&
      object.text?.length < 100
    ) {
      return "store:" + objectId;
    }
    if (!object.content?.type?.startsWith("image/")) {
      return undefined;
    }
    const res = await client.objects.getRendition(objectId, {
      format: ImageRenditionFormat.jpeg,
      generate_if_missing: true,
    });
    if (!res.renditions?.length && res.status === "generating") {
      //throw to try again
      throw new Error(`Rendition for object ${objectId} is in progress`);
    } else if (res.renditions) {
      return "store:" + objectId;
    }
  };

  const fileRef = await getImage();

  log.info(
    "Execute SelectDocumentType interaction on content with \nexisting types - passing full types: " +
    existing_types.filter((t) => !t.tags?.includes("system")),
  );

  let res;
  try {
    res = await executeInteractionFromActivity(
      client,
      interactionName,
      params,
      {
        existing_types,
        content,
        image: fileRef,
      },
    );
  } catch (error: any) {
    log.error(`Failed to select document type`, { error, retryable: error.retryable });
    
    const isRetryable = error.retryable !== undefined 
      ? error.retryable !== false
      : undefined;
    
    if (isRetryable !== undefined) {
      if (isRetryable) {
        throw ApplicationFailure.create({
          message: `Document type selection failed: ${error.message}`,
          nonRetryable: false,
        });
      } else {
        throw ApplicationFailure.create({
          message: `Non-retryable document type selection failed: ${error.message}`,
          nonRetryable: true,
        });
      }
    }
    
    throw error;
  }

  const jsonResult = res.result.object();

  log.info("Selected Content Type Result: " + JSON.stringify(jsonResult));


  //if type is not identified or not present in the database, generate a new type
  let selectedType: { id: string; name: string } | undefined = undefined;

  selectedType = types.find((t) => t.name === jsonResult.document_type);

  if (!selectedType) {
    log.warn("Document type not identified: starting type generation");
    const newType = await generateNewType(
      context,
      existing_types,
      content,
      fileRef,
    );
    selectedType = { id: newType.id, name: newType.name };
  }

  if (!selectedType) {
    log.error("Type not found: ", res.result);
    throw new Error("Type not found: " + jsonResult.document_type);
  }

  //update object with selected type
  await client.objects.update(objectId, {
    type: selectedType.id,
  });

  return {
    id: selectedType.id,
    name: selectedType.name,
    isNew: !types.find((t) => t.name === selectedType.name),
  };
}

async function generateNewType(
  context: ActivityContext<GenerateOrAssignContentTypeParams>,
  existing_types: ContentObjectTypeItem[],
  content?: string,
  fileRef?: string,
) {
  const { client, params } = context;

  const project = await context.fetchProject();
  const interactionName =
    params.interactionNames?.generateMetadataModel ??
    INT_GENERATE_METADATA_MODEL;

  let genTypeRes;
  try {
    genTypeRes = await executeInteractionFromActivity(
      client,
      interactionName,
      params,
      {
        existing_types,
        content: content,
        human_context: project?.configuration?.human_context ?? undefined,
        image: fileRef ? fileRef : undefined,
      },
    );
  } catch (error: any) {
    log.error(`Failed to generate new document type`, { error, retryable: error.retryable });
    
    const isRetryable = error.retryable !== undefined 
      ? error.retryable !== false
      : undefined;
    
    if (isRetryable !== undefined) {
      if (isRetryable) {
        throw ApplicationFailure.create({
          message: `Document type generation failed: ${error.message}`,
          nonRetryable: false,
        });
      } else {
        throw ApplicationFailure.create({
          message: `Non-retryable document type generation failed: ${error.message}`,
          nonRetryable: true,
        });
      }
    }
    
    throw error;
  }

  const jsonResult = genTypeRes.result.object();

  if (!jsonResult.document_type) {
    log.error("No name generated for type", genTypeRes);
    throw new Error("No name generated for type");
  }

  log.info("Generated schema for type", jsonResult.metadata_schema);
  const typeData: CreateContentObjectTypePayload = {
    name: jsonResult.document_type,
    description: jsonResult.document_type_description,
    object_schema: jsonResult.metadata_schema,
    is_chunkable: jsonResult.is_chunkable,
    table_layout: jsonResult.table_layout,
  };

  const type = await client.types.create(typeData);

  return type;
}
