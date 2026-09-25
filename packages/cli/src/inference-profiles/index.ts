import { getOptions, type ModelOptions, Providers } from '@llumiverse/common';
import type {
    CreateInferenceProfilePayload,
    ProjectInferenceProfiles,
    UpdateInferenceProfilePayload,
} from '@vertesia/common';
import type { Command } from 'commander';
import { getClient } from '../client.js';

function print(value: unknown) {
    console.log(JSON.stringify(value, null, 2));
}
function objectInput<T>(input: string): T {
    const parsed: unknown = JSON.parse(input);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object');
    return parsed as T;
}

export function registerInferenceProfilesCommand(program: Command) {
    const command = program
        .command('inference-profiles')
        .description('Manage model inference presets (distinct from CLI authentication profiles). All output is JSON.');
    command.command('list').action(async () => print(await (await getClient(program)).inferenceProfiles.list()));
    command
        .command('get <id>')
        .action(async (id: string) => print(await (await getClient(program)).inferenceProfiles.retrieve(id)));
    command
        .command('create <json>')
        .description(
            'Create from a JSON object with name, environment, optional model and model_options. Discover parameters first.',
        )
        .action(async (json: string) =>
            print(
                await (await getClient(program)).inferenceProfiles.create(
                    objectInput<CreateInferenceProfilePayload>(json),
                ),
            ),
        );
    command
        .command('update <id> <json>')
        .description('Update supplied fields; null clears model or model_options.')
        .action(async (id: string, json: string) =>
            print(
                await (await getClient(program)).inferenceProfiles.update(
                    id,
                    objectInput<UpdateInferenceProfilePayload>(json),
                ),
            ),
        );
    command
        .command('delete <id>')
        .description('Delete the profile and clear its references. Inspect usage first.')
        .action(async (id: string) => print(await (await getClient(program)).inferenceProfiles.delete(id)));
    command
        .command('usage <id>')
        .option('--search <text>')
        .option('--kind <kind>', 'stored, system, or app')
        .option('--offset <number>', 'Results to skip', '0')
        .option('--limit <number>', 'Page size (1–100)', '25')
        .action(
            async (
                id: string,
                options: { search?: string; kind?: 'stored' | 'system' | 'app'; offset: string; limit: string },
            ) => {
                const offset = Number(options.offset),
                    limit = Number(options.limit);
                if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
                    throw new Error('Invalid offset or limit');
                if (options.kind && !['stored', 'system', 'app'].includes(options.kind))
                    throw new Error('Invalid kind');
                print(await (await getClient(program)).inferenceProfiles.usage(id, { ...options, offset, limit }));
            },
        );
    command
        .command('parameters <environment> [model]')
        .description(
            'Discover provider/model parameter metadata. Refresh with current options after changing a refresh-marked parameter.',
        )
        .option('--model-options <json>', 'Current model options for conditional parameter discovery')
        .action(async (environment: string, model: string | undefined, options: { modelOptions?: string }) => {
            const env = await (await getClient(program)).environments.retrieve(environment);
            const provider = Object.values(Providers).find((value) => value === env.provider);
            if (!provider) throw new Error('Select a concrete provider environment to discover parameters');
            const selected = model ?? env.default_model;
            if (!selected) throw new Error('Specify a model');
            print({
                environment,
                provider,
                model: selected,
                ...getOptions(
                    selected,
                    provider,
                    options.modelOptions ? objectInput<ModelOptions>(options.modelOptions) : undefined,
                ),
            });
        });
    command
        .command('assign <interaction> <profile>')
        .description('Persist an assignment using an interaction Mongo ID or sys:/app: catalog ID; use null to clear.')
        .action(async (interaction: string, profile: string) => {
            const client = await getClient(program);
            const inference_profile = profile === 'null' ? null : profile;
            print(
                /^[a-fA-F0-9]{24}$/.test(interaction)
                    ? await client.interactions.update(interaction, { inference_profile })
                    : await client.interactionConfigurations.update(interaction, { inference_profile }),
            );
        });
    command
        .command('assignment <interaction>')
        .description('Read the persisted profile assignment for a stored or code interaction.')
        .action(async (interaction: string) => {
            const client = await getClient(program);
            print(
                /^[a-fA-F0-9]{24}$/.test(interaction)
                    ? ((await client.interactions.retrieve(interaction)).inference_profile ?? null)
                    : await client.interactionConfigurations.retrieve(interaction),
            );
        });
    command
        .command('defaults [json]')
        .description(
            'Read project inference defaults, or replace them with an explicit JSON object (default_profile, system, modality).',
        )
        .action(async (json?: string) => {
            const client = await getClient(program);
            const project = await client.getProject();
            if (!project?.id) throw new Error('No current project');
            print(
                json === undefined
                    ? ((await client.projects.retrieve(project.id)).configuration?.inference ?? {})
                    : await client.projects.updateConfiguration(project.id, {
                          inference: objectInput<ProjectInferenceProfiles>(json),
                      }),
            );
        });
}
