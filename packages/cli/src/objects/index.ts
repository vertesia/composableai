import { Command } from "commander";
import {
    createObject,
    deleteObject,
    downloadObjectContent,
    getObject,
    getObjectText,
    listObjects,
    queryObjects,
    searchObjects,
    updateObject,
} from "./commands.js";

export function registerObjectsCommand(program: Command) {

    const store = program.command("content");

    store.command("post <file...>")
        .description("Post a new object to the store. The file can be a s3 or gs uri to attach external blobs to the created object.")
        .option('--name [name]', 'The name of the object to create. If not specified the file name will be used.')
        .option('--type [type]', 'The type of the object to create or "auto" to let the application guess the type. If not specified, one can be selected from the list of existing types.')
        .option('--mime [mime]', 'The mime-type of the file content. If not specified the mime type will be inferred from the file name extension.')
        .option('--path [parentPath]', 'The path of the parent folder where the object is created. If not specified the object will be created in the root of the store.')
        .option('-r, --recursive', 'Recurse directory if the file argument is a directory. The default is to not recurse.')
        .action(async (files: string[], options: Record<string, any>) => {
            await createObject(program, files, options);
        });
    store.command("update <objectId> <type>")
        .description("Update an existing object type given its ID")
        .action(async (objectId: string, type: string, options: Record<string, any>) => {
            await updateObject(program, objectId, type, options);
        });
    store.command('delete <objectId>')
        .description("Delete an existing object given its ID")
        .action(async (objectId: string, options: Record<string, any>) => {
            await deleteObject(program, objectId, options);
        });
    store.command('get <objectId>')
        .description("Get an existing object given its ID")
        .action(async (objectId: string, options: Record<string, any>) => {
            await getObject(program, objectId, options);
        });
    store.command('text <objectId>')
        .description("Get the extracted text for an existing object")
        .option('--json', 'Print raw JSON instead of plain text')
        .action(async (objectId: string, options: Record<string, any>) => {
            await getObjectText(program, objectId, options);
        });
    store.command('download <objectId>')
        .description("Download an object's content to a file")
        .option('-o, --output [path]', 'Output file path (defaults to object name)')
        .action(async (objectId: string, options: Record<string, any>) => {
            await downloadObjectContent(program, objectId, options);
        });
    store.command('list [folderPath]')
        .description("List the objects inside a folder. If no folder is specified all the objects are listed.")
        .option('-l,--limit [limit]', 'Limit the number of objects returned. The default limit is 100. Useful for pagination.')
        .option('-s,--skip [skip]', 'Skip the number of objects to skip. Default is 0. Useful for pagination.')
        .option('--json', 'Print raw JSON')
        .action(async (folderPath: string | undefined, options: Record<string, any>) => {
            await listObjects(program, folderPath, options);
        });
    store.command('search <query>')
        .description("Full-text search across stored content objects")
        .option('-l,--limit [limit]', 'Limit the number of results returned. Default is 20.')
        .option('--type [type]', 'Filter by object type id or code')
        .option('--path [path]', 'Filter by object location/path')
        .option('--select [fields]', 'Selection string for returned fields')
        .option('--json', 'Print raw JSON')
        .action(async (query: string, options: Record<string, any>) => {
            await searchObjects(program, query, options);
        });
    store.command('query')
        .description("Query indexed documents using raw Elasticsearch DSL")
        .option('--dsl [json]', 'Raw Elasticsearch DSL as a JSON string')
        .option('--json', 'Print raw JSON')
        .action(async (options: Record<string, any>) => {
            await queryObjects(program, options);
        });
}
