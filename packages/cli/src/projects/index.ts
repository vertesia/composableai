import colors from "ansi-colors";
import { Command } from "commander";
import { getClient } from "../client.js";

export async function listProjects(program: Command) {
    const client = await getClient(program);
    const project = await client.getProject();
    if (!project) {
        console.error('No project id found.');
        process.exit(1);
    }
    const activeProjectId = project.id;
    const projects = await client.projects.list();
    projects.map(project => {
        const check = activeProjectId === project.id ? " " + colors.symbols.check : "";
        console.log(project.name + ` [${project.id}]` + check);
    })
}