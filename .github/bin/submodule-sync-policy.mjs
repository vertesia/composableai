import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const skipSyncLabel = 'skip-submodule-sync';

// Associated PRs include open PRs and merges into other branches. Only the PR
// whose merge produced this exact commit on this target can opt out of sync.
export function skippedSourcePr(prs, sha, branch) {
    return prs.find((pr) => pr.merged_at && pr.merge_commit_sha === sha
        && pr.base.ref === branch && pr.labels.some((label) => label.name === skipSyncLabel));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const { SOURCE_REPOSITORY: repo, SOURCE_SHA: sha, TARGET_BRANCH: branch } = process.env;
    if (!['vertesia/composableai', 'vertesia/llumiverse'].includes(repo) || !/^[a-f0-9]{40}$/.test(sha)) {
        throw new Error('Invalid submodule sync source');
    }
    // A lookup error stops the automatic update; it must not silently ignore an opt-out.
    const pages = JSON.parse(execFileSync('gh', [
        'api', '--paginate', '--slurp', `repos/${repo}/commits/${sha}/pulls?per_page=100`,
    ], { encoding: 'utf8' }));
    const skipped = skippedSourcePr(pages.flat(), sha, branch);
    appendFileSync(process.env.GITHUB_OUTPUT, `should_sync=${!skipped}\n`);
    if (skipped) {
        const message = `Submodule sync skipped: ${repo}#${skipped.number} has the ${skipSyncLabel} label. `
            + 'The coordinated downstream PR is responsible for updating the submodule.\n';
        console.log(message);
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, message);
    }
}
