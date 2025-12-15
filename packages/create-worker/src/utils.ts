import { spawnSync } from "node:child_process";

export function runCommand(cmd: string, args: string[]) {
    spawnSync(cmd, args, {
        stdio: 'inherit'
    });
}
