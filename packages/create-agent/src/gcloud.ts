import { spawnSync } from "node:child_process";
import hasbin from "hasbin";
import enquirer from "enquirer";

const { prompt } = enquirer;

export function registryAuth(cmd: string) {
    console.log("Authenticating with Vertesia npm registry");
    spawnSync(cmd, ["run", "registry-auth"], {
        stdio: 'inherit'
    })
}

export async function gcloudAuth() {
    const hasGcloud = await new Promise((resolve, reject) => {
        try {
            hasbin("gcloud", (result: boolean) => {
                resolve(result);
            });
        } catch (err: any) {
            reject(err)
        }
    });

    if (!hasGcloud) {
        console.log("You must install the gcloud application to login with vertesia private npm repository.\nSee https://cloud.google.com/sdk/docs/install");
        process.exit(1);
    }
    const answer: any = await prompt({
        name: "auth",
        type: "confirm",
        initial: true,
        message: "You must login with Google Cloud to be able to access the Vertesia private package repository. Do you want to proceed?"
    })

    if (!answer.auth) {
        console.log('Bye.');
        process.exit(2);
    }
    spawnSync("gcloud", ["auth", "login"], {
        stdio: 'inherit'
    });
}
