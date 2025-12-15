/**
 * Debug replayer for workflow testing.
 *
 * This tool allows you to replay workflows locally for debugging purposes.
 * See https://docs.temporal.io/develop/typescript/debugging for more information.
 */
import { startDebugReplayer } from "@temporalio/worker";
import { resolveScriptFile } from "@dglabs/worker";

resolveScriptFile("./workflows", import.meta.url).then((p: string) => {
    console.log("Debugging using workflows path", p);
    startDebugReplayer({
        workflowsPath: p,
    });
});
