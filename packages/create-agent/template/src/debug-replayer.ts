import { startDebugReplayer } from "@temporalio/worker";
import { resolveScriptFile } from "@dglabs/agent-runner";

resolveScriptFile("./workflows", import.meta.url).then((p: string) => {
    console.log("Debugging using workflows path", p);
    startDebugReplayer({
        workflowsPath: p
    })
});
