import type { AppLifecycleHook } from '@vertesia/tools-sdk';

export const uninstall: AppLifecycleHook = async ({ getClient, metadata, payload }) => {
    const projectId = payload.project?.id;
    if (!projectId) {
        throw new Error('The uninstall hook requires a project-scoped token.');
    }

    const client = await getClient();
    const project = await client.projects.retrieve(projectId);

    console.info('[examples] uninstall hook called', {
        appInstallationId: metadata.app_install_id,
        projectId: project.id,
        projectName: project.name,
    });

    return { message: `Example uninstall hook completed for project "${project.name}".` };
};
