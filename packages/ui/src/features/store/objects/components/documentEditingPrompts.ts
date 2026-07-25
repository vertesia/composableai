/** Chat notice handing the agent direct editor edits that already exist in the working copy. */
export function createDirectEditsAppliedPrompt(draftPath: string, unifiedDiff: string): string {
    return [
        `Direct edits are already saved to '${draftPath}'. Use this compact unified diff as context only;`,
        'do not re-apply it. The artifact remains the current source of truth.',
        '```diff',
        `--- a/${draftPath}`,
        `+++ b/${draftPath}`,
        unifiedDiff,
        '```',
    ].join('\n');
}
