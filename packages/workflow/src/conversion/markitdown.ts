import { log } from "@temporalio/activity";
import { spawn } from "child_process";
import fs from "fs";
import tmp from "tmp";

export function markdownWithMarkitdown(buffer: Buffer, ext?: string): Promise<string> {
    const inputFile = tmp.fileSync({ postfix: ext });
    const targetFileName = tmp.tmpNameSync({ postfix: ".md" });

    fs.writeSync(inputFile.fd, buffer);

    return new Promise((resolve, reject) => {
        const tool = "markitdown";
        log.info(`Converting document to markdown with ${tool}`, { inputFile: inputFile.name, targetFileName });

        const command = spawn(tool, [inputFile.name, "-o", targetFileName]);

        command.on("exit", function (code) {
            if (code) {
                reject(new Error(`${tool} exited with code ${code}`));
            }
        });

        command.on("close", function (code) {
            if (code) {
                reject(new Error(`${tool} exited with code ${code}`));
            } else {
                return fs.readFile(targetFileName, "utf8", (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    return resolve(data);
                });
            }
        });

        command.on("error", (err) => {
            reject(err);
        });
    });
}
