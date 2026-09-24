import assert from 'node:assert/strict';
import { test } from 'node:test';
import { skippedSourcePr, skipSyncLabel } from './submodule-sync-policy.mjs';

const sha = 'a'.repeat(40);
const merged = {
    number: 123, merged_at: '2026-09-17T00:00:00Z', merge_commit_sha: sha,
    base: { ref: 'main' }, labels: [{ name: skipSyncLabel }],
};

test('labeled source merge suppresses the automatic sync', () => {
    assert.equal(skippedSourcePr([merged], sha, 'main'), merged);
});

test('release branches support the same opt-out', () => {
    const pr = { ...merged, base: { ref: 'release/1.5' } };
    assert.equal(skippedSourcePr([pr], sha, 'release/1.5'), pr);
});

for (const [name, prs] of [
    ['direct push', []],
    ['unlabeled merge', [{ ...merged, labels: [] }]],
    ['different label', [{ ...merged, labels: [{ name: 'backport' }] }]],
    ['open associated PR', [{ ...merged, merged_at: null }]],
    ['different commit', [{ ...merged, merge_commit_sha: 'b'.repeat(40) }]],
    ['different target', [{ ...merged, base: { ref: 'release/1.5' } }]],
]) {
    test(`${name} does not suppress the sync`, () => {
        assert.equal(skippedSourcePr(prs, sha, 'main'), undefined);
    });
}

test('a different associated PR cannot hide the actual source PR', () => {
    assert.equal(skippedSourcePr([{ ...merged, merged_at: null }, merged], sha, 'main'), merged);
});
