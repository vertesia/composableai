import type { ProjectRef } from "../project.js";

export function getTenantId(accountId: string, projectId: string): string {
    //use the last 6 characters of the accountId as the db name
    //as in mongo the last 6 char are an incrementing counter
    const accountLast6 = accountId.slice(-6);
    const projectLast6 = projectId.slice(-6);
    return `${accountLast6}_${projectLast6}`;
}
export function getTenantIdFromProject(project: ProjectRef): string {
    return getTenantId(project.account, project.id);
}
