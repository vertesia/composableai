import { MockActivityEnvironment } from '@temporalio/testing';
import { describe, expect, it } from 'vitest';
import { runTool } from './convert-with-tool.js';

function runNode(script: string): Promise<void> {
    return new MockActivityEnvironment({ startToCloseTimeoutMs: 60_000 }).run(runTool, process.execPath, [
        '-e',
        script,
    ]);
}

describe('runTool', () => {
    it('should finish when the tool writes more output than a pipe holds', async () => {
        // An undrained stderr pipe blocks the child once about 64KB is buffered.
        await expect(runNode("process.stderr.write('w'.repeat(1024 * 1024))")).resolves.toBeUndefined();
    });

    it('should reject with the tool stderr when the tool exits non-zero', async () => {
        await expect(runNode("process.stderr.write('broken object 12'); process.exit(3)")).rejects.toThrow(
            'broken object 12',
        );
    });

    it('should reject when the tool is killed by a signal', async () => {
        await expect(runNode("process.kill(process.pid, 'SIGKILL')")).rejects.toMatchObject({ signal: 'SIGKILL' });
    });
});
