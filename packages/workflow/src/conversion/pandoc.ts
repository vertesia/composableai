import { log } from "@temporalio/activity";
import { spawn } from "child_process";
import { PassThrough } from "stream";

export function markdownWithPandoc(buffer: Buffer, fromFormat: string): Promise<string> {
    const fromType = undefined;

    return new Promise((resolve, reject) => {
        log.info(`Converting ${fromType} to markdown`);
        const input = new PassThrough();
        input.end(buffer);

        let result: string[] = [];

        const command = spawn("pandoc", ["-t", "markdown", "-f", fromFormat], {
            stdio: "pipe",
        });
        input.pipe(command.stdin);

        command.stdout.on("data", function (data: string) {
            result.push(data.toString());
        });
        command.on("exit", function (code) {
            if (code) {
                reject(new Error(`pandoc exited with code ${code}`));
            }
        });
        command.on("close", function (code) {
            if (code) {
                reject(new Error(`pandoc exited with code ${code}`));
            } else {
                resolve(result.join(""));
            }
        });

        command.on("error", (err) => {
            reject(err);
        });
    });
}
