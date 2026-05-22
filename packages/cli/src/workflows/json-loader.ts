import { DSLWorkflowSpec } from "@vertesia/common";
import { readFile } from "fs/promises";
import { errorMessage } from "../utils/options.js";
import { ValidationError, validateWorkflow } from "./validation.js";

function parseJSON(content: string): DSLWorkflowSpec {
    try {
        return JSON.parse(content);
    } catch (err: unknown) {
        throw new ValidationError("Invalid JSON: " + errorMessage(err));
    }
}

export async function loadJSONWorkflowDefinition(
    file: string,
    skipValidation: boolean = false,
): Promise<DSLWorkflowSpec> {
    return readFile(file, "utf-8").then((content) => {
        return skipValidation ? validateWorkflow(parseJSON(content)) : parseJSON(content);
    });
}
