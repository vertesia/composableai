import { expect, it, vi } from 'vitest';
import { loadIntakeInteractions } from './intake-policy-catalog.js';

it('lists database and both code sources through the implemented endpoints', async () => {
    const database = { type: 'stored' as const, id: 'db', name: 'Analyzer', tags: ['stable'] };
    const code = { type: 'sys' as const, id: 'sys:AnalyzeImage', name: 'AnalyzeImage', tags: [] };
    const app = { type: 'app' as const, id: 'myapp:Analyzer', name: 'Analyzer', tags: [] };
    const catalog = {
        listStoredInteractions: vi.fn().mockResolvedValue([database]),
        listSysInteractions: vi.fn().mockResolvedValue([code]),
        listAllAppInteractions: vi.fn().mockResolvedValue([app]),
    };
    expect(await loadIntakeInteractions(catalog)).toEqual({ items: [database, code, app], failed: false });
    for (const source of Object.values(catalog)) expect(source).toHaveBeenCalledTimes(1);
});

it('preserves available choices when another source is unavailable', async () => {
    const code = { type: 'sys' as const, id: 'sys:AnalyzeImage', name: 'AnalyzeImage', tags: [] };
    expect(
        await loadIntakeInteractions({
            listStoredInteractions: vi.fn().mockRejectedValue(new Error('unavailable')),
            listSysInteractions: vi.fn().mockResolvedValue([code]),
            listAllAppInteractions: vi.fn().mockResolvedValue([]),
        }),
    ).toEqual({ items: [code], failed: true });
});
