import type { AppBuildProgress } from '@vertesia/common';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { followAppBuild, scaffoldApp } from './commands.js';

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('../client.js', () => ({ getClient: mocks.getClient }));
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }));

function progress(status: AppBuildProgress['status'], step: string, extra: Partial<AppBuildProgress> = {}) {
    return { status, step, updated_at: '2026-11-25T14:35:00Z', ...extra } as AppBuildProgress;
}

function sequence(...items: AppBuildProgress[]) {
    let index = 0;
    return async () => items[Math.min(index++, items.length - 1)];
}

describe('followAppBuild', () => {
    it('reports each change of step and returns the completed build with its version', async () => {
        const seen: string[] = [];
        const done = await followAppBuild(
            sequence(
                progress('queued', 'queued'),
                progress('queued', 'queued'),
                progress('building', 'building source'),
                progress('completed', 'built', { version_id: 'v1', app_url: 'https://app.example.test/x' }),
            ),
            (update) => seen.push(`${update.status}:${update.step}`),
            0,
        );
        expect(seen).toEqual(['queued:queued', 'building:building source', 'completed:built']);
        expect(done).toMatchObject({ status: 'completed', version_id: 'v1' });
    });

    it('gives up on a build that never leaves the queue', async () => {
        await expect(
            followAppBuild(sequence(progress('queued', 'waiting for workflow worker')), () => undefined, 0, 0),
        ).rejects.toThrow('"waiting for workflow worker" after 0 minutes; it looks stuck');
    });

    it('returns a failed build instead of polling forever', async () => {
        const done = await followAppBuild(
            sequence(progress('building', 'building'), progress('failed', 'failed', { error: 'npm ci exited 1' })),
            () => undefined,
            0,
        );
        expect(done).toMatchObject({ status: 'failed', error: 'npm ci exited 1' });
    });
});

describe('scaffoldApp', () => {
    it('exits with the build error when the initial version build fails', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const build = { workflow_id: 'AppBuild:1', run_id: 'run-1', app_id: 'site' };
        mocks.getClient.mockResolvedValue({
            apps: {
                startScaffold: vi.fn(async () => ({ workflow_id: 'AppScaffold:1', run_id: 'run-0', app_id: 'site' })),
                getBuildProgress: sequence(progress('failed', 'failed', { error: 'tsc found 2 errors' })),
            },
            workflows: {
                streamMessages: vi.fn(async (_workflowId: string, _runId: string, onMessage: (m: object) => void) => {
                    onMessage({
                        details: {
                            app_scaffold_progress: {
                                status: 'completed',
                                step: 'completed; initial version build started',
                                initial_version_build: build,
                            },
                        },
                    });
                }),
            },
        });

        await expect(scaffoldApp(new Command(), 'site', {})).rejects.toThrow(
            'Initial version build failed: tsc found 2 errors',
        );
    });
});
