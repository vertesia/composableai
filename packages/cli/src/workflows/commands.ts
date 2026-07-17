import fs from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { DSLWorkflowSpec, ExecuteWorkflowPayload } from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { type CliOptions, getStringOption, isRecord } from '../utils/options.js';
import { loadJSONWorkflowDefinition } from './json-loader.js';
import { streamRun } from './streams.js';
import { loadTsWorkflowDefinition } from './ts-loader.js';
import { ValidationError } from './validation.js';

type WorkflowFileOptions = CliOptions<{
    file?: string;
    tags?: string[];
    skipValidation?: boolean;
}>;

type WorkflowExecuteOptions = CliOptions<{
    objectId?: string[];
    vars?: string;
    config?: Record<string, unknown>;
    file?: string;
    stream?: boolean;
    interactive?: boolean;
    output?: string;
    outputFile?: string;
    queue?: string;
}>;

type WorkflowOutputOptions = CliOptions<{
    file?: string;
}>;

type TranspileWorkflowOptions = CliOptions<{
    out?: string;
}>;

type WorkflowActionOptions = CliOptions<{
    reason?: string;
}>;

type WorkflowSignalOptions = CliOptions<{
    data?: string;
}>;

/** Terminate a running workflow (forceful stop, no cleanup handlers run). */
export async function terminateWorkflowRun(
    program: Command,
    workflowId: string,
    runId: string,
    options: WorkflowActionOptions,
) {
    const client = await getClient(program);
    const res = await client.workflows.terminate(workflowId, runId, options.reason);
    console.log(res.message ?? `Workflow ${runId} terminated`);
}

/** Request cancellation of a running workflow (graceful; cleanup/cancellation handlers run). */
export async function cancelWorkflowRun(
    program: Command,
    workflowId: string,
    runId: string,
    options: WorkflowActionOptions,
) {
    const client = await getClient(program);
    const res = await client.workflows.cancel(workflowId, runId, options.reason);
    console.log(res.message ?? `Workflow ${runId} cancellation requested`);
}

/** Send a named signal (with an optional JSON payload) to a running workflow. */
export async function signalWorkflowRun(
    program: Command,
    workflowId: string,
    runId: string,
    signal: string,
    options: WorkflowSignalOptions,
) {
    const client = await getClient(program);
    const payload = options.data ? parseJsonObject(options.data) : undefined;
    const res = await client.workflows.sendSignal(workflowId, runId, signal, payload);
    console.log(JSON.stringify(res, null, 2));
}

export async function executeWorkflowByName(program: Command, workflowName: string, options: WorkflowExecuteOptions) {
    const { objectId, vars, file, stream, interactive, output: outputFile } = options;
    console.debug('Executing interaction in workflow', workflowName, 'with options', options);

    const mergedConfig = {
        objectIds: normalizeStringArray(objectId),
        vars: parseJsonObject(vars || '{}'),
    } as ExecuteWorkflowPayload;

    if (file) {
        const payload = parseJsonObject(fs.readFileSync(file, 'utf-8'));
        Object.assign(mergedConfig, payload);
    }

    if (options.queue) {
        mergedConfig.task_queue = options.queue;
    }

    const client = await getClient(program);
    const res = await client.workflows.execute(workflowName, {
        ...mergedConfig,
        unique: true,
    });
    if (!res[0]) {
        console.error('Workflow execution failed');
        process.exit(1);
    }

    const { workflow_id: workflowId, run_id: runId } = res[0];
    console.log('Workflow ID:', workflowId);
    console.log('Run ID:', runId);

    if (stream || interactive) {
        console.debug('Streaming messages for workflow run');
        await streamRun(workflowId, runId, program, { ...options, outputFile });
    }

    // Save the result to a file if outputFile is specified
    if (outputFile && runId) {
        const runDetails = await client.workflows.getRunDetails(runId, workflowId);
        const output = isRecord(runDetails.result) ? runDetails.result.output : undefined;
        let outputContent: string;
        if (!output) {
            console.error('No output found for workflow run', runId);
            process.exit(1);
        }
        if (typeof output === 'object') {
            outputContent = JSON.stringify(output, null, 2);
        } else {
            outputContent = output.toString();
        }

        fs.writeFileSync(outputFile, outputContent);
        console.log(`Workflow execution result saved to ${outputFile}`);
        process.exit(0);
    }
}

export async function transpileWorkflow(_program: Command, files: string[], options: TranspileWorkflowOptions) {
    if (!files?.length) {
        console.log('A .ts file argument is required.');
        process.exit(1);
    }
    const out = options.out ? resolve(options.out) : undefined;
    let saveToDir = false;
    try {
        if (out && fs.lstatSync(out).isDirectory()) {
            saveToDir = true;
        }
    } catch {
        //ignore
    }
    if (files.length > 1 && !saveToDir) {
        console.log('When multiple files are specified the output must be a directory.');
        process.exit(1);
    }
    for (const file of files) {
        const json = await loadTsWorkflowDefinition(file);
        if (!out) {
            console.log(JSON.stringify(json, null, 2));
        } else {
            let outFile: string;
            if (saveToDir) {
                let fileName = basename(file);
                fileName = fileName.replace('.ts', '.json');
                outFile = join(out, fileName);
            } else {
                // save to file
                outFile = out;
            }
            console.log('Generating file', outFile);
            fs.writeFileSync(outFile, JSON.stringify(json, null, 2));
        }
    }
}

export async function createOrUpdateWorkflowDefinition(
    program: Command,
    workflowId: string | undefined,
    options: WorkflowFileOptions,
) {
    const { file, tags, skipValidation } = options;

    if (!file) {
        console.log('A file with the workflow definition is required. Use --file argument');
        process.exit(1);
    }

    const isTs = file.endsWith('.ts');
    const loadWorkflow = isTs ? loadTsWorkflowDefinition : loadJSONWorkflowDefinition;
    let json: DSLWorkflowSpec;
    try {
        if (isTs) {
            console.log(`Transpiling file ${file} ...`);
        }
        json = await loadWorkflow(file, skipValidation);
    } catch (err: unknown) {
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

    const client = await getClient(program);
    if (workflowId) {
        const res = await client.workflows.definitions.update(workflowId, json);
        console.log('Updated workflow', res.id);
        return;
    } else {
        const res = await client.workflows.definitions.create(json);
        console.log('Created workflow', res.id);
    }
}

export async function listWorkflowsDefinition(program: Command, _options: Record<string, unknown>) {
    const client = await getClient(program);
    const res = await client.workflows.definitions.list();
    console.log(res);
}

export async function getWorkflowDefinition(program: Command, objectId: string, options: WorkflowOutputOptions) {
    const client = await getClient(program);
    const res = await client.workflows.definitions.retrieve(objectId);
    const pretty = JSON.stringify(res, null, 2);

    if (options.file) {
        fs.writeFileSync(options.file, pretty);
        console.log('Workflow definition saved to', options.file);
    } else {
        console.log(pretty);
    }
}

export async function deleteWorkflowDefinition(program: Command, objectId: string, _options: Record<string, unknown>) {
    const client = await getClient(program);
    const res = await client.workflows.definitions.delete(objectId);
    console.log(res);
}

function parseJsonObject(content: string): Record<string, unknown> {
    const value = JSON.parse(content);
    if (!isRecord(value)) {
        console.error('Expected a JSON object.');
        process.exit(1);
    }
    return value;
}

function normalizeStringArray(value: string[] | string | undefined): string[] | undefined {
    if (Array.isArray(value)) {
        return value;
    }
    const option = getStringOption(value);
    return option ? [option] : undefined;
}
