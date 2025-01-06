import { Command } from "commander";
import { getClient } from "../client.js";

export async function deploy(program: Command, dir: string) {
    const client = getClient(program);
    client.store; //TODO
    console.log("TODO: Deploy NOT IPLEMENTED", dir);
}