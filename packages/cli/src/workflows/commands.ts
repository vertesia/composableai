import { ExecuteWorkflowPayload, WorkflowRuleInputType } from "@vertesia/common";
import { Command } from "commander";
import fs from "fs";
import { resolve, join, basename } from "path";
import { getClient } from "../client.js";
import { loadJSONWorkflowDefinition } from "./json-loader.js";
import { loadTsWorkflowDefinition } from "./ts-loader.js";
import { ValidationError } from "./validation.js";
import { streamRun } from "./streams.js";

export async function createWorkflowRule(program: Command, options: Record<string, any>) {
    const { name, on, run, inputType } = options;
    if (!name) {
        console.log("A name for the worklow is required. Use --name argument");
        process.exit(1);
    }
    if (!on) {
        console.log("An event to trigger the workflow is required. Use --on argument");
        process.exit(1);
    }
    if (!run) {
        console.log("A workflow to run is required. Use --run argument");
        process.exit(1);
    }
    const [event_name, object_type] = on.split(":");
    const workflow = await getClient(program).workflows.rules.create({
        name,
        endpoint: run,
        input_type: inputType ?? WorkflowRuleInputType.single,
        match: {
            event_name,
            object_type,
        },
    });
    console.log("Created workflow", workflow.id);
}

export async function createOrUpdateWorkflowRule(program: Command, options: Record<string, any>) {
    const { file, tags } = options;

    if (!file) {
        console.log("A file with the workflow definition is required. Use --file argument");
        process.exit(1);
    }

    const payload = fs.readFileSync(file, "utf-8");
    const json = JSON.parse(payload);
    if (tags) {
        json.tags = tags;
    }

    const rule = await getClient(program).workflows.rules.create(json);

    console.log("Applied workflow rule", rule.id);
}

export async function deleteWorkflowRule(program: Command, objectId: string, _options: Record<string, any>) {
    const res = await getClient(program).workflows.rules.delete(objectId);
    console.log(res);
}

export async function getWorkflowRule(program: Command, objectId: string, options: Record<string, any>) {
    const res = await getClient(program).workflows.rules.retrieve(objectId);
    const pretty = JSON.stringify(res, null, 2);

    if (options.file) {
        fs.writeFileSync(options.file, pretty);
        console.log("Workflow definition saved to", options.file);
    } else {
        console.log(pretty);
    }
}

export async function executeWorkflowByName(program: Command, workflowName: string, options: Record<string, any>) {
    const { objectId, vars, file, stream } = options;
    console.debug("Executing interaction in workflow", workflowName, "with options", options);

    let mergedConfig = {
        objectIds: objectId ? objectId : [],
        vars: JSON.parse(vars) || {},
    } as ExecuteWorkflowPayload;

    if (file) {
        const payload = JSON.parse(fs.readFileSync(file, "utf-8"));
        Object.assign(mergedConfig, payload);
    }

    if (options.queue) {
        mergedConfig.task_queue = options.queue;
    }

    const res = await getClient(program).workflows.execute(workflowName, mergedConfig);
    const wfRunId = res.runIds[0];
    console.log("Workflow run ID:", wfRunId);

    if (stream) {
        console.debug("Streaming messages for workflow run", wfRunId);
        await streamRun(wfRunId, program, options); // ⬅️ use the shared function
    }
}

export async function executeWorkflowRule(program: Command, workflowId: string, options: Record<string, any>) {
    console.log("Executing workflow", workflowId, options);
    const { objectId, config, file } = options;

    let mergedConfig = config
        ? {
              ...config,
          }
        : {};

    if (file) {
        const payload = JSON.parse(fs.readFileSync(file, "utf-8"));
        mergedConfig = {
            ...payload,
            ...config,
        };
    }

    const res = await getClient(program).workflows.rules.execute(workflowId, objectId, mergedConfig);
    console.log(res);
}

export async function listWorkflowsRule(program: Command, _options: Record<string, any>) {
    const res = await getClient(program).workflows.rules.list();
    console.log(res);
}

export async function transpileWorkflow(_program: Command, files: string[], options: Record<string, any>) {
    if (!files || !files.length) {
        console.log("A .ts file argument is required.");
        process.exit(1);
    }
    const out = options.out ? resolve(options.out) : undefined;
    let saveToDir = false;
    try {
        if (out && fs.lstatSync(out).isDirectory()) {
            saveToDir = true;
        }
    } catch (err) {
        //ignore
    }
    if (files.length > 1 && !saveToDir) {
        console.log("When multiple files are specified the output must be a directory.");
        process.exit(1);
    }
    for (const file of files) {
        const json = await loadTsWorkflowDefinition(file);
        if (!out) {
            console.log(JSON.stringify(json, null, 2));
        } else {
            let outFile;
            if (saveToDir) {
                let fileName = basename(file);
                fileName = fileName.replace(".ts", ".json");
                outFile = join(out, fileName);
            } else {
                // save to file
                outFile = out;
            }
            console.log("Generating file", outFile);
            fs.writeFileSync(outFile, JSON.stringify(json, null, 2));
        }
    }
}

export async function createOrUpdateWorkflowDefinition(
    program: Command,
    workflowId: string | undefined,
    options: Record<string, any>,
) {
    const { file, tags, skipValidation } = options;

    if (!file) {
        console.log("A file with the workflow definition is required. Use --file argument");
        process.exit(1);
    }

    const isTs = file.endsWith(".ts");
    const loadWorkflow = isTs ? loadTsWorkflowDefinition : loadJSONWorkflowDefinition;
    let json: any;
    try {
        if (isTs) {
            console.log(`Transpiling file ${file} ...`);
        }
        json = await loadWorkflow(file, skipValidation);
    } catch (err: any) {
        if (err instanceof ValidationError) {
            console.log(err.message);
            process.exit(1);
        } else {
            throw err;
        }
    }
    if (tags) {
        json.tags = tags;
    }

    if (workflowId) {
        const res = await getClient(program).workflows.definitions.update(workflowId, json);
        console.log("Updated workflow", res.id);
        return;
    } else {
        const res = await getClient(program).workflows.definitions.create(json);
        console.log("Created workflow", res.id);
    }
}

export async function listWorkflowsDefinition(program: Command, _options: Record<string, any>) {
    const res = await getClient(program).workflows.definitions.list();
    console.log(res);
}

export async function getWorkflowDefinition(program: Command, objectId: string, options: Record<string, any>) {
    const res = await getClient(program).workflows.definitions.retrieve(objectId);
    const pretty = JSON.stringify(res, null, 2);

    if (options.file) {
        fs.writeFileSync(options.file, pretty);
        console.log("Workflow definition saved to", options.file);
    } else {
        console.log(pretty);
    }
}

export async function deleteWorkflowDefinition(program: Command, objectId: string, _options: Record<string, any>) {
    const res = await getClient(program).workflows.definitions.delete(objectId);
    console.log(res);
}
