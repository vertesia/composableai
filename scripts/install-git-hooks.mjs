import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const hookTargets = [
    { cwd: '.', hooksPath: '.githooks', label: 'composableai' },
    { cwd: 'llumiverse', hooksPath: '.githooks', label: 'llumiverse' },
];

for (const target of hookTargets) {
    if (!existsSync(target.cwd) || !existsSync(`${target.cwd}/${target.hooksPath}`)) {
        continue;
    }

    const result = spawnSync('git', ['config', 'core.hooksPath', target.hooksPath], {
        cwd: target.cwd,
        stdio: 'inherit',
    });

    if (result.status === 0) {
        console.log(`[prepare] installed ${target.label} git hooks`);
    }
}
