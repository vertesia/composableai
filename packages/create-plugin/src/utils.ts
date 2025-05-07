import { spawnSync } from "node:child_process";

export function runCommand(cmd: string, args: string[]) {
    console.log('>>>>>>>>>>>>>', cmd, args.join(' '));
    spawnSync(cmd, args, {
        stdio: 'inherit'
    });
}
