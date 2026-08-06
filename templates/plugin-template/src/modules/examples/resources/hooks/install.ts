import type { AppLifecycleHook } from '@vertesia/tools-sdk';

export const install: AppLifecycleHook = async ({ getClient, metadata, payload }) => {
    const projectId = payload.project?.id;
    if (!projectId) {
        throw new Error('The install hook requires a project-scoped token.');
    }

    const client = await getClient();
    const project = await client.projects.retrieve(projectId);

    console.info('[examples] install hook called', {
        appInstallationId: metadata.app_install_id,
        projectId: project.id,
        projectName: project.name,
    });

    return { message: `Example install hook completed for project "${project.name}".` };
};
