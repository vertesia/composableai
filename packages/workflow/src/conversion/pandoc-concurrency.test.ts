import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { markdownWithPandoc } from './pandoc.js';

vi.mock('@temporalio/activity', () => ({ log: { debug: vi.fn() } }));

const originalPath = process.env.PATH;
const originalLog = process.env.PANDOC_TEST_LOG;
let testDirectory: string;
let logPath: string;

async function lines(): Promise<string[]> {
    try {
        return (await readFile(logPath, 'utf8')).trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

async function waitForLine(expected: string): Promise<void> {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
        if ((await lines()).includes(expected)) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${expected}`);
}

async function resetLog(): Promise<void> {
    await writeFile(logPath, '');
}

describe('markdownWithPandoc concurrency', () => {
    beforeAll(async () => {
        testDirectory = await mkdtemp(join(tmpdir(), 'pandoc-concurrency-'));
        logPath = join(testDirectory, 'events.log');
        const executable = join(testDirectory, 'pandoc');
        await writeFile(
            executable,
            `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
    const [behavior, id] = input.trim().split(':');
    const record = (event) => appendFileSync(process.env.PANDOC_TEST_LOG, event + ':' + id + '\\n');
    if (behavior === 'running') {
        const keepAlive = setInterval(() => {}, 1_000);
        process.on('SIGTERM', () => {
            record('signal');
            setTimeout(() => {
                clearInterval(keepAlive);
                record('close');
                process.exit(143);
            }, 100);
        });
        record('start');
        return;
    }
    record('start');
    if (behavior === 'unicode') {
        const output = Buffer.from('A😀B');
        process.stdout.write(output.subarray(0, 3));
        setTimeout(() => {
            process.stdout.write(output.subarray(3));
            record('close');
        }, 10);
        return;
    }
    setTimeout(() => {
        record('close');
        if (behavior === 'error') {
            process.exit(2);
            return;
        }
        process.stdout.write(id);
    }, behavior === 'slow' ? 100 : 0);
});
`,
        );
        await chmod(executable, 0o755);
        process.env.PATH = `${testDirectory}:${originalPath ?? ''}`;
        process.env.PANDOC_TEST_LOG = logPath;
    });

    afterAll(async () => {
        process.env.PATH = originalPath;
        if (originalLog === undefined) delete process.env.PANDOC_TEST_LOG;
        else process.env.PANDOC_TEST_LOG = originalLog;
        await rm(testDirectory, { recursive: true, force: true });
    });

    it('runs only one Pandoc process at a time', async () => {
        await resetLog();
        const first = markdownWithPandoc(Buffer.from('slow:first'), 'plain');
        await waitForLine('start:first');
        const second = markdownWithPandoc(Buffer.from('fast:second'), 'plain');

        await expect(first).resolves.toBe('first');
        await expect(second).resolves.toBe('second');
        expect(await lines()).toEqual(['start:first', 'close:first', 'start:second', 'close:second']);
    });

    it('decodes UTF-8 characters split across stdout chunks', async () => {
        await resetLog();
        await expect(markdownWithPandoc(Buffer.from('unicode:unicode'), 'plain')).resolves.toBe('A😀B');
    });

    it('does not spawn work canceled while queued', async () => {
        await resetLog();
        const first = markdownWithPandoc(Buffer.from('slow:first'), 'plain');
        await waitForLine('start:first');
        const controller = new AbortController();
        const queued = markdownWithPandoc(Buffer.from('fast:queued'), 'plain', controller.signal);
        const rejection = queued.catch((error: unknown) => error);
        controller.abort();

        await first;
        await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
        expect(await lines()).toEqual(['start:first', 'close:first']);
    });

    it('waits for a canceled child to close before releasing the slot', async () => {
        await resetLog();
        const controller = new AbortController();
        const running = markdownWithPandoc(Buffer.from('running:running'), 'plain', controller.signal);
        const rejection = running.catch((error: unknown) => error);
        await waitForLine('start:running');
        controller.abort();
        const after = markdownWithPandoc(Buffer.from('fast:after'), 'plain');

        await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
        await expect(after).resolves.toBe('after');
        expect(await lines()).toEqual([
            'start:running',
            'signal:running',
            'close:running',
            'start:after',
            'close:after',
        ]);
    });

    it('releases the slot after a failed child closes', async () => {
        await resetLog();
        const failing = markdownWithPandoc(Buffer.from('error:failing'), 'plain');
        const rejection = failing.catch((error: unknown) => error);
        await waitForLine('start:failing');
        const after = markdownWithPandoc(Buffer.from('fast:after'), 'plain');

        await expect(rejection).resolves.toMatchObject({ message: 'pandoc exited with code 2' });
        await expect(after).resolves.toBe('after');
        expect(await lines()).toEqual(['start:failing', 'close:failing', 'start:after', 'close:after']);
    });
});
