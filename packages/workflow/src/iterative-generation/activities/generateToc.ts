import { WorkflowExecutionPayload } from "@vertesia/common";
import { getVertesiaClient } from "../../utils/client.js";
import { buildAndPublishMemoryPack } from "../../utils/memory.js";
import {
    IterativeGenerationPayload,
    OutputMemoryMeta,
    Toc,
    TocIndex,
} from "../types.js";
import { executeWithVars, tocIndex } from "../utils.js";
import { parseCompletionResultsToJson } from "@llumiverse/common";

const defaultTocSchema = {
    type: "object",
    properties: {
        sections: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description:
                            "the id of the section, can be a filename if working on a file, a slug if working on a document or path, or a unique identifier if working on a model.",
                    },
                    operation: {
                        type: "string",
                        enum: ["create", "update", "delete"],
                        description:
                            "The operation to perform on the section, create, update or delete. If update, you will be requested later to provide the list of change operation to perform.",
                    },
                    name: {
                        type: "string",
                        description:
                            "The name or title of the section, should be the path in the OpenAPI spec, of the title of the section/part.",
                    },
                    description: {
                        type: "string",
                    },
                    instructions: {
                        type: "string",
                    },
                    parts: {
                        type: "array",
                        description:
                            "when the section is too large, you can split it into parts, each part should have a title and description. Use it to split the section into subsection. When doing an API documentation, you can do one part for each path. When generating code, you can do one part for each method. When generating an OpenAPI spec, you can do one part for each operation.",
                        items: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                    description:
                                        "the id of the part, can be a filename if working on a file, a slug if working on a document or path, or a unique identifier if working on a model.",
                                },
                                name: {
                                    type: "string",
                                    description:
                                        "The name or title of the part, should be the path in the OpenAPI spec, of the title of the section/part.",
                                },
                                /*
                                "description": {
                                    "type": "string"
                                },
                                */
                                instructions: {
                                    type: "string",
                                },
                            },
                            required: ["id", "name"],
                        },
                    },
                },
                required: ["id", "name", "operation"],
            },
        },
    },
    required: ["sections"],
};

export async function it_gen_generateToc(
    payload: WorkflowExecutionPayload,
): Promise<TocIndex> {
    const vars = payload.vars as IterativeGenerationPayload;

    const schema = vars.toc_schema || defaultTocSchema;

    const client = await getVertesiaClient(payload);

    const run = await executeWithVars(
        client,
        vars.interaction,
        vars,
        undefined,
        schema,
    );

    //Parse the CompletionResult[] to get a Toc object
    const jsonResults = parseCompletionResultsToJson(run.result);

    const toc: Toc = {
        sections: jsonResults.sections
    };

    await buildAndPublishMemoryPack(
        client,
        `${vars.memory}/output`,
        async () => {
            return {
                toc,
                lastProcessedPart: undefined, // the part index (a number array)
                previouslyGenerated: "",
            } satisfies OutputMemoryMeta;
        },
    );

    return tocIndex(toc);
}
