import colors from 'ansi-colors';
import type { Command } from 'commander';
import enquirer from 'enquirer';
import { getClient } from '../client.js';
import { refreshCurrentProfileAuthentication } from '../profiles/auth.js';
import { config } from '../profiles/index.js';

const { prompt } = enquirer;

interface ProjectChoice {
    id: string;
    name: string;
    account: string;
    restricted?: boolean;
}

export async function listProjects(program: Command) {
    const client = await getClient(program);
    const project = await client.getProject();
    if (!project) {
        console.error('No project id found.');
        process.exit(1);
    }
    const activeProjectId = project.id;
    const projects = await client.projects.list();
    for (const project of projects) {
        const check = activeProjectId === project.id ? ` ${colors.symbols.check}` : '';
        const restricted = project.restricted ? ` ${colors.dim('(restricted)')}` : '';
        console.log(`${project.name} [${project.id}]${restricted}${check}`);
    }
}

export async function useProject(program: Command, projectId?: string) {
    if (!config.current) {
        console.error('No profile is selected. Run `vertesia profiles use <name>` to select a profile');
        process.exit(1);
    }
    const envCredential = readEnvCredentialName();
    if (envCredential) {
        console.error(
            `Cannot switch the current profile project while ${envCredential} is set. ` +
                'Unset it or use profile-backed authentication.',
        );
        process.exit(1);
    }

    const client = await getClient(program);
    const projects = await client.projects.list();
    const selectedProjectId = projectId || (await selectProject(projects));
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (!selectedProject) {
        console.error(`Project ${selectedProjectId} not found or not accessible.`);
        process.exit(1);
    }
    if (selectedProject.restricted) {
        console.error(
            `Project ${selectedProject.name} [${selectedProject.id}] is visible but restricted. Select a project you have direct access to.`,
        );
        process.exit(1);
    }

    await refreshCurrentProfileAuthentication(undefined, undefined, {
        projectId: selectedProject.id,
    });
    console.log(`Selected project ${selectedProject.name} [${selectedProject.id}]`);
}

async function selectProject(projects: ProjectChoice[]): Promise<string> {
    const accessibleProjects = projects.filter((project) => !project.restricted);
    if (!accessibleProjects.length) {
        console.error('No accessible projects found.');
        process.exit(1);
    }

    const response = await prompt<{ project?: string }>({
        type: 'select',
        name: 'project',
        message: 'Select the project to use',
        choices: accessibleProjects.map((project) => ({
            name: project.id,
            message: `${project.name} [${project.id}]`,
        })),
    });
    if (!response.project) {
        console.error('No project selected');
        process.exit(1);
    }
    return response.project;
}

function readEnvCredentialName(): string | undefined {
    if (process.env.VERTESIA_TOKEN) {
        return 'VERTESIA_TOKEN';
    }
    if (process.env.VERTESIA_APIKEY) {
        return 'VERTESIA_APIKEY';
    }
    if (process.env.COMPOSABLE_PROMPTS_APIKEY) {
        return 'COMPOSABLE_PROMPTS_APIKEY';
    }
    return undefined;
}
