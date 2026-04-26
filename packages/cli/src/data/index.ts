import { Command } from "commander";
import { importData, listDataStores } from "./commands.js";

export function registerDataCommand(program: Command) {
    const data = program.command("data")
        .description("Manage analytical data stores and imports");

    data.command("list")
        .description("List data stores in the current project")
        .option("--json", "Output full JSON instead of tab-separated text")
        .action(async (options: Record<string, any>) => {
            await listDataStores(program, options);
        });

    data.command("import <storeId> <tableName> [input]")
        .description("Import local files, stdin, or remote URIs directly into a data store table")
        .option("--mode [mode]", "Import mode: append or replace", "append")
        .option("--format [format]", "Input format: csv, json, or parquet. Inferred from filename when omitted.")
        .option("--message [message]", "Version history message for the import")
        .option("--name [name]", "Uploaded filename to use when reading from stdin or overriding a local filename")
        .option("--mime [mimeType]", "MIME type for uploads from local files or stdin")
        .option("--prefix [pathPrefix]", "Custom staging prefix in project storage for uploaded local files")
        .option("--json", "Output full JSON instead of a short summary")
        .action(async (storeId: string, tableName: string, input: string | undefined, options: Record<string, any>) => {
            await importData(program, storeId, tableName, input, options);
        });
}
