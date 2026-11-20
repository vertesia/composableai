import { type CliOptions, getStringOption } from './utils/options.js';

type RunContextOptions = CliOptions<{
    runId?: string;
    storageId?: string;
}>;

export function getAgentRunId(options: RunContextOptions = {}): string {
    const runId = getStringOption(options.runId) || process.env.VERTESIA_AGENTRUN_ID || process.env.VERTESIA_RUN_ID;

    if (!runId) {
        console.error('Error: Agent run ID not specified. Use --run-id or set VERTESIA_AGENTRUN_ID');
        process.exit(1);
    }

    return runId;
}

/** The artifact storage of the agent run this command runs for, or undefined outside one. */
export function findArtifactStorageId(options: RunContextOptions = {}): string | undefined {
    return (
        getStringOption(options.runId) ||
        getStringOption(options.storageId) ||
        process.env.VERTESIA_ARTIFACT_STORAGE_ID ||
        process.env.VERTESIA_AGENTRUN_ID ||
        process.env.VERTESIA_RUN_ID ||
        undefined
    );
}

export function getArtifactStorageId(options: RunContextOptions = {}): string {
    const storageId = findArtifactStorageId(options);

    if (!storageId) {
        console.error('Error: Artifact storage ID not specified. Use --run-id or set VERTESIA_ARTIFACT_STORAGE_ID');
        process.exit(1);
    }

    return storageId;
}
