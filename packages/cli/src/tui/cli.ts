import { AgentMessage, AgentMessageType, ListWorkflowRunsPayload } from '@vertesia/common';
import { Command } from 'commander';
import { getClient } from '../client.js';

/**
 * Register all non-TUI agent CLI commands for programmatic/scriptable use.
 * These output structured JSON for consumption by tools like Claude Code.
 */
export function registerAgentCliCommands(agent: Command) {

    agent.command('list')
        .description('List available agents as JSON')
        .option('--all', 'Include non-agent interactions too')
        .action(async (options: Record<string, any>) => {
            await agentList(options);
        });

    agent.command('run <agent>')
        .description('Launch an agent workflow, wait for completion, output result')
        .option('-d, --data <json>', 'Input data as JSON string')
        .option('-e, --env <envId>', 'Environment ID')
        .option('-m, --model <model>', 'Model to use')
        .option('--tools <tools>', 'Comma-separated tool names')
        .option('--no-wait', 'Return immediately with workflowId/runId')
        .option('--timeout <seconds>', 'Max wait time in seconds', '600')
        .option('--stream', 'Stream messages to stderr while waiting')
        .option('--interactive', 'Enable interactive mode')
        .option('--max-iterations <n>', 'Maximum agent iterations')
        .action(async (agentName: string, options: Record<string, any>) => {
            await agentRun(agentName, options);
        });

    agent.command('status <runId>')
        .description('Check run status (running/completed/failed)')
        .requiredOption('--workflow-id <id>', 'Workflow ID')
        .action(async (runId: string, options: Record<string, any>) => {
            await agentStatus(runId, options);
        });

    agent.command('output <runId>')
        .description('Get messages/output of a run as JSON')
        .requiredOption('--workflow-id <id>', 'Workflow ID')
        .option('--format <format>', 'Output format: json|text|markdown', 'json')
        .option('--types <types>', 'Filter by message types (comma-separated)')
        .action(async (runId: string, options: Record<string, any>) => {
            await agentOutput(runId, options);
        });

    agent.command('artifacts <runId>')
        .description('List artifacts of a run as JSON')
        .action(async (runId: string) => {
            await agentArtifacts(runId);
        });

    agent.command('artifact <runId> <name>')
        .description('Download a specific artifact to stdout or file')
        .option('-o, --output <file>', 'Output file path')
        .action(async (runId: string, name: string, options: Record<string, any>) => {
            await agentArtifact(runId, name, options);
        });

    agent.command('history')
        .description('List recent agent runs as JSON')
        .option('-l, --limit <n>', 'Max results', '20')
        .option('--status <status>', 'Filter by status')
        .option('--interaction <name>', 'Filter by interaction name')
        .action(async (options: Record<string, any>) => {
            await agentHistory(options);
        });
}


async function agentList(options: Record<string, any>) {
    const client = await getClient();
    const interactions = await client.interactions.list();

    const agents = options.all
        ? interactions
        : interactions.filter(i =>
            i.agent_runner_options?.is_agent || i.tags?.includes('agent')
        );

    const result = agents.map(a => ({
        id: a.id,
        name: a.name,
        endpoint: a.endpoint,
        description: a.description,
        tags: a.tags,
        status: a.status,
        model: a.model,
        tools: a.agent_runner_options?.tool_names,
    }));

    console.log(JSON.stringify(result, null, 2));
}


async function agentRun(agentName: string, options: Record<string, any>) {
    const client = await getClient();

    const data = options.data ? JSON.parse(options.data) : undefined;
    const toolNames = options.tools ? options.tools.split(',').map((t: string) => t.trim()) : undefined;
    const maxIterations = options.maxIterations ? parseInt(options.maxIterations, 10) : undefined;

    const payload = {
        type: 'conversation' as const,
        interaction: agentName,
        data,
        config: {
            environment: options.env,
            model: options.model,
        },
        tool_names: toolNames,
        interactive: options.interactive || false,
        max_iterations: maxIterations,
    };

    const { runId, workflowId } = await client.interactions.executeAsync(payload);

    if (options.wait === false) {
        console.log(JSON.stringify({ runId, workflowId }));
        return;
    }

    const timeout = parseInt(options.timeout, 10) * 1000;
    const startTime = Date.now();

    if (options.stream) {
        // Stream messages to stderr, final result to stdout
        const messages: AgentMessage[] = [];

        await Promise.race([
            client.workflows.streamMessages(workflowId, runId, (msg: AgentMessage) => {
                messages.push(msg);
                if (msg.type !== AgentMessageType.STREAMING_CHUNK) {
                    const typeName = AgentMessageType[msg.type] || 'UNKNOWN';
                    process.stderr.write(`[${typeName}] ${msg.message}\n`);
                }
            }),
            new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout waiting for agent completion')), timeout);
            }),
        ]);

        // Output final result
        const details = await client.workflows.getRunDetails(runId, workflowId);
        console.log(JSON.stringify({
            status: details.status,
            result: details.result,
            runId,
            workflowId,
            messages: messages.length,
        }, null, 2));
    } else {
        // Poll for completion
        while (Date.now() - startTime < timeout) {
            const details = await client.workflows.getRunDetails(runId, workflowId);
            const status = String(details.status || '').toLowerCase();

            if (status === 'completed' || status === 'failed' || status === 'terminated' || status === 'canceled') {
                console.log(JSON.stringify({
                    status: details.status,
                    result: details.result,
                    error: details.error,
                    runId,
                    workflowId,
                }, null, 2));
                process.exit(status === 'completed' ? 0 : 1);
                return;
            }

            await sleep(2000);
        }

        console.error('Timeout waiting for agent completion');
        process.exit(1);
    }
}


async function agentStatus(runId: string, options: Record<string, any>) {
    const client = await getClient();
    const details = await client.workflows.getRunDetails(runId, options.workflowId);

    console.log(JSON.stringify({
        status: details.status,
        started_at: details.started_at,
        closed_at: details.closed_at,
        run_id: details.run_id,
        workflow_id: details.workflow_id,
        interaction_name: details.interaction_name,
        topic: details.topic,
    }, null, 2));
}


async function agentOutput(runId: string, options: Record<string, any>) {
    const client = await getClient();
    const messages = await client.workflows.retrieveMessages(options.workflowId, runId);

    let filtered = messages;
    if (options.types) {
        const allowedTypes = options.types.split(',').map((t: string) => {
            const key = t.trim().toUpperCase();
            return AgentMessageType[key as keyof typeof AgentMessageType];
        }).filter((t: number | undefined) => t !== undefined);
        filtered = messages.filter(m => allowedTypes.includes(m.type));
    }

    if (options.format === 'text' || options.format === 'markdown') {
        for (const msg of filtered) {
            const typeName = AgentMessageType[msg.type] || 'UNKNOWN';
            console.log(`[${typeName}] ${msg.message}`);
            if (msg.details) {
                console.log(JSON.stringify(msg.details, null, 2));
            }
            console.log('');
        }
    } else {
        console.log(JSON.stringify(filtered, null, 2));
    }
}


async function agentArtifacts(runId: string) {
    const client = await getClient();
    const artifacts = await client.files.listArtifacts(runId);

    const prefix = `agents/${runId}/`;
    const result = artifacts.map(a => ({
        name: a.startsWith(prefix) ? a.slice(prefix.length) : a,
        path: a,
    }));

    console.log(JSON.stringify(result, null, 2));
}


async function agentArtifact(runId: string, name: string, options: Record<string, any>) {
    const client = await getClient();
    const { Readable } = await import('stream');
    const { pipeline } = await import('stream/promises');

    const stream = await client.files.downloadArtifact(runId, name);
    const nodeStream = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);

    if (options.output) {
        const { createWriteStream } = await import('fs');
        const writeStream = createWriteStream(options.output);
        await pipeline(nodeStream, writeStream);
        process.stderr.write(`Downloaded to: ${options.output}\n`);
    } else {
        await pipeline(nodeStream, process.stdout);
    }
}


async function agentHistory(options: Record<string, any>) {
    const client = await getClient();

    const payload: ListWorkflowRunsPayload = {
        page_size: parseInt(options.limit, 10) || 20,
        status: options.status,
        interaction: options.interaction,
        type: 'conversation',
    };

    const response = await client.workflows.listConversations(payload);

    console.log(JSON.stringify({
        runs: response.runs.map(r => ({
            run_id: r.run_id,
            workflow_id: r.workflow_id,
            status: r.status,
            started_at: r.started_at,
            closed_at: r.closed_at,
            interaction_name: r.interaction_name,
            topic: r.topic,
        })),
        has_more: response.has_more,
    }, null, 2));
}


function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
