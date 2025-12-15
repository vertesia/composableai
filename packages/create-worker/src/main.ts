import { init } from "./init.js";

async function main(argv: string[]) {
    await init(argv[2])
}

main(process.argv).catch(err => {
    console.error("Error: ", err);
});
