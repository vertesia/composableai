export function getAgentRunId(options: Record<string, unknown> = {}): string {
    const runId =
        getStringOption(options.runId)
        || process.env.VERTESIA_AGENTRUN_ID
        || process.env.VERTESIA_RUN_ID;

    if (!runId) {
        console.error(
            "Error: Agent run ID not specified. Use --run-id or set VERTESIA_AGENTRUN_ID",
        );
        process.exit(1);
    }

    return runId;
}

export function getArtifactStorageId(options: Record<string, unknown> = {}): string {
    const storageId =
        getStringOption(options.runId)
        || getStringOption(options.storageId)
        || process.env.VERTESIA_ARTIFACT_STORAGE_ID
        || process.env.VERTESIA_AGENTRUN_ID
        || process.env.VERTESIA_RUN_ID;

    if (!storageId) {
        console.error(
            "Error: Artifact storage ID not specified. Use --run-id or set VERTESIA_ARTIFACT_STORAGE_ID",
        );
        process.exit(1);
    }

    return storageId;
}

function getStringOption(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
