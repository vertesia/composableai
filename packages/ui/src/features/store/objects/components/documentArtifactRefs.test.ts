import { describe, expect, it, vi } from 'vitest';
import { collectRunLocalArtifactRefs, persistRunLocalArtifactRefs } from './documentArtifactRefs.js';

const DOC = [
    '![Chart 1](artifact:documents/abc-123/out/01_chart.png)',
    '![Chart 2](artifact:out/02_chart.png)',
    '![Chart 2 again](artifact:out/02_chart.png)',
    '![Legacy](artifact:agents/run-9/out/03_chart.png)',
    '[data file](artifact:files/data.csv)',
    '![external](https://example.com/x.png)',
].join('\n');

describe('collectRunLocalArtifactRefs', () => {
    it('collects only run-local refs, deduplicated', () => {
        expect(collectRunLocalArtifactRefs(DOC)).toEqual(['out/02_chart.png', 'files/data.csv']);
    });

    it('ignores documents/ and agents/ refs and non-artifact urls', () => {
        expect(collectRunLocalArtifactRefs('![a](artifact:documents/x/y.png) ![b](https://e.com/i.png)')).toEqual([]);
    });
});

describe('persistRunLocalArtifactRefs', () => {
    it('copies each run-local ref once and rewrites all occurrences', async () => {
        const copyFile = vi.fn().mockResolvedValue('ok');
        const result = await persistRunLocalArtifactRefs({ copyFile }, DOC, 'run-1', 'batch-1');

        expect(copyFile).toHaveBeenCalledTimes(2);
        expect(copyFile).toHaveBeenCalledWith('agents/run-1/out/02_chart.png', 'documents/batch-1/out/02_chart.png');
        expect(copyFile).toHaveBeenCalledWith('agents/run-1/files/data.csv', 'documents/batch-1/files/data.csv');

        expect(result.content).toContain('![Chart 2](artifact:documents/batch-1/out/02_chart.png)');
        expect(result.content).toContain('![Chart 2 again](artifact:documents/batch-1/out/02_chart.png)');
        expect(result.content).toContain('[data file](artifact:documents/batch-1/files/data.csv)');
        // Durable and external refs stay untouched
        expect(result.content).toContain('artifact:documents/abc-123/out/01_chart.png');
        expect(result.content).toContain('artifact:agents/run-9/out/03_chart.png');
        expect(result.content).toContain('https://example.com/x.png');
        expect(result.persisted).toHaveLength(2);
        expect(result.failed).toHaveLength(0);
    });

    it('pins failed copies to the explicit run-scoped path', async () => {
        const copyFile = vi.fn().mockRejectedValue(new Error('not found'));
        const result = await persistRunLocalArtifactRefs(
            { copyFile },
            '![Chart 2](artifact:out/02_chart.png)',
            'run-1',
            'batch-1',
        );

        expect(result.content).toBe('![Chart 2](artifact:agents/run-1/out/02_chart.png)');
        expect(result.failed).toEqual(['out/02_chart.png']);
        expect(result.persisted).toHaveLength(0);
    });

    it('returns content unchanged and skips IO when there is nothing to persist', async () => {
        const copyFile = vi.fn();
        const content = '![a](artifact:documents/x/y.png)';
        const result = await persistRunLocalArtifactRefs({ copyFile }, content, 'run-1', 'batch-1');

        expect(copyFile).not.toHaveBeenCalled();
        expect(result.content).toBe(content);
    });
});
