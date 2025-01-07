import { init } from "./init.js";

async function main(argv: string[]) {
    await init(getPm(argv[1]), argv[2])
}

main(process.argv).catch(err => {
    console.error("Error: ", err);
});

function getPm(script_path: string) {
    if (script_path) {
        script_path = script_path.replaceAll("\\", "/");
        if (script_path.includes("pnpm/dlx")) {
            return "pnpm";
        }
    }
    return "npm";
}