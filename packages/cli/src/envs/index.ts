import type { AIModel, ModelSearchPayload } from '@llumiverse/common';
import type { ExecutionEnvironment } from '@vertesia/common';
import colors from 'ansi-colors';
import type { Command } from 'commander';
import { getClient } from '../client.js';
import { getBooleanOption, getStringOption } from '../utils/options.js';

interface ModelCommandOptions {
    text?: string;
    type?: string;
    json?: boolean;
}

interface JsonCommandOptions {
    json?: boolean;
}

export function registerEnvsCommand(program: Command) {
    const envs = program
        .command('envs [envId]')
        .description('List the environments you have access to')
        .action((envId: string | undefined, options: Record<string, unknown>) =>
            listEnvironments(program, envId, options),
        );

    envs.command('models <envId>')
        .description('List provider-available models for an environment')
        .option('--text <text>', 'Filter models by text')
        .option('--type <type>', 'Filter models by type')
        .option('--json', 'Print raw JSON')
        .action((envId: string, options: ModelCommandOptions) => listEnvironmentModels(program, envId, options));

    envs.command('enabled-models <envId>')
        .description('List enabled models for an environment')
        .option('--json', 'Print raw JSON')
        .action((envId: string, options: JsonCommandOptions) => listEnabledModels(program, envId, options));

    envs.command('enable-model <envId> <modelId>')
        .description('Enable one model in an environment')
        .option('--json', 'Print raw JSON')
        .action((envId: string, modelId: string, options: JsonCommandOptions) =>
            enableEnvironmentModel(program, envId, modelId, options),
        );

    envs.command('disable-model <envId> <modelId>')
        .description('Disable one model in an environment')
        .option('--json', 'Print raw JSON')
        .action((envId: string, modelId: string, options: JsonCommandOptions) =>
            disableEnvironmentModel(program, envId, modelId, options),
        );
}

export async function listEnvironments(program: Command, envId: string | undefined, options: Record<string, unknown>) {
    const client = await getClient(program);
    if (envId) {
        const env = await client.environments.retrieve(envId);
        printEnv(env, options);
    } else {
        const environments = await client.environments.list();
        for (const env of environments) {
            console.log(`${env.name} [${env.id}]`);
        }
    }
}

function printEnv(env: ExecutionEnvironment, _options: Record<string, unknown>) {
    console.log(`${colors.bold(env.name)} [${env.id}]`);
    console.log(colors.bold('Provider:'), env.provider);
    console.log(colors.bold('Description:'), env.description || 'n/a');
    console.log(colors.bold('Default Model:'), env.default_model);
    console.log(
        colors.bold('Enabled Models:'),
        env.enabled_models && env.enabled_models.length > 0
            ? env.enabled_models.map((model) => model.name).join(', ')
            : 'n/a',
    );
}

async function listEnvironmentModels(program: Command, envId: string, options: ModelCommandOptions) {
    const client = await getClient(program);
    const payload = getModelSearchPayload(options);
    const models = await client.environments.listModels(envId, payload);
    printModels(models, options);
}

async function listEnabledModels(program: Command, envId: string, options: JsonCommandOptions) {
    const client = await getClient(program);
    const env = await client.environments.retrieve(envId);
    printModels(env.enabled_models ?? [], options);
}

async function enableEnvironmentModel(program: Command, envId: string, modelId: string, options: JsonCommandOptions) {
    const client = await getClient(program);
    const env = await client.environments.enableModel(envId, { model_id: modelId });
    if (getBooleanOption(options.json)) {
        console.log(JSON.stringify(env, null, 2));
        return;
    }

    const model = env.enabled_models?.find((candidate) => candidate.id === modelId);
    console.log(`Enabled model: ${formatModel(model ?? { id: modelId, name: modelId, provider: env.provider })}`);
}

async function disableEnvironmentModel(program: Command, envId: string, modelId: string, options: JsonCommandOptions) {
    const client = await getClient(program);
    const env = await client.environments.disableModel(envId, modelId);
    if (getBooleanOption(options.json)) {
        console.log(JSON.stringify(env, null, 2));
        return;
    }

    console.log(`Disabled model: ${modelId}`);
    console.log(`Enabled models: ${env.enabled_models?.length ?? 0}`);
}

function getModelSearchPayload(options: ModelCommandOptions): ModelSearchPayload | undefined {
    const text = getStringOption(options.text);
    const type = getStringOption(options.type) as ModelSearchPayload['type'] | undefined;
    if (!text && !type) {
        return undefined;
    }
    return {
        text: text ?? '',
        ...(type ? { type } : {}),
    };
}

function printModels(models: AIModel[], options: JsonCommandOptions) {
    if (getBooleanOption(options.json)) {
        console.log(JSON.stringify(models, null, 2));
        return;
    }

    if (models.length === 0) {
        console.log('No models found.');
        return;
    }

    for (const model of models) {
        console.log(formatModel(model));
    }
}

function formatModel(model: AIModel): string {
    const details = [model.type, model.status].filter(Boolean).join(', ');
    return details ? `${model.name} [${model.id}] (${details})` : `${model.name} [${model.id}]`;
}
