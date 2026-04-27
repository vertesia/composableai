import { Command } from "commander";
import { downloadArtifact, getArtifactUrl, listArtifacts, uploadArtifact } from "./commands.js";

export function registerArtifactsCommand(program: Command) {
    const artifacts = program.command("artifacts")
        .description("Manage agent artifacts. Storage ID can be inferred from VERTESIA_ARTIFACT_STORAGE_ID, VERTESIA_AGENTRUN_ID, or VERTESIA_RUN_ID.");

    artifacts.command("upload [file]")
        .description("Upload an artifact to the current agent run. Use '-' or omit file to read from stdin.")
        .option("--run-id [runId]", "Artifact storage ID (defaults to VERTESIA_ARTIFACT_STORAGE_ID, then VERTESIA_AGENTRUN_ID)")
        .option("--name [name]", "Artifact name (required for stdin, defaults to filename otherwise)")
        .option("--mime [mimeType]", "MIME type of the file")
        .action(async (file: string | undefined, options: Record<string, any>) => {
            await uploadArtifact(program, file, options);
        });

    artifacts.command("download <name>")
        .description("Download an artifact from an agent run")
        .option("--run-id [runId]", "Artifact storage ID (defaults to VERTESIA_ARTIFACT_STORAGE_ID, then VERTESIA_AGENTRUN_ID)")
        .option("-o, --output [path]", "Output file path (defaults to stdout)")
        .action(async (name: string, options: Record<string, any>) => {
            await downloadArtifact(program, name, options);
        });

    artifacts.command("list")
        .description("List artifacts for an agent run")
        .option("--run-id [runId]", "Artifact storage ID (defaults to VERTESIA_ARTIFACT_STORAGE_ID, then VERTESIA_AGENTRUN_ID)")
        .action(async (options: Record<string, any>) => {
            await listArtifacts(program, options);
        });

    artifacts.command("url <name>")
        .description("Get download URL for an artifact")
        .option("--run-id [runId]", "Artifact storage ID (defaults to VERTESIA_ARTIFACT_STORAGE_ID, then VERTESIA_AGENTRUN_ID)")
        .action(async (name: string, options: Record<string, any>) => {
            await getArtifactUrl(program, name, options);
        });
}
