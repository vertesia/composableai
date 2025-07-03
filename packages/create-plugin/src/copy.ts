import { promises as fs } from "fs";
import { join } from "path";
import { processVarsInFile } from "./template.js";

/**
 * Recursively copies the contents of a source directory to a target directory using the most optimized method.
 *
 * @param sourceDir - The path to the source directory.
 * @param targetDir - The path to the target directory.
 * @param templateSuffix - Optional suffix to remvoe from file name after copying. Ex: .template, .tmpl
 */
export async function copyTree(sourceDir: string, targetDir: string, template?: {
    suffix?: string, // Suffix to remove from file name after copying
    context: Record<string, any> // Context for template processing
}): Promise<void> {
    // Optimize by using a queue to avoid deep recursion and potential stack overflows
    const queue: { source: string; target: string }[] = [{ source: sourceDir, target: targetDir }];

    while (queue.length > 0) {
        const { source, target } = queue.pop()!;

        // Ensure the target directory exists
        await fs.mkdir(target, { recursive: true });

        // Read all items in the source directory
        const items = await fs.readdir(source, { withFileTypes: true });

        for (const item of items) {
            const isTemplate = template?.suffix ? item.name.endsWith(template.suffix) : false;
            const targetName = isTemplate ? item.name.slice(0, -template!.suffix!.length) : item.name;
            const sourcePath = join(source, item.name);
            const targetPath = join(target, targetName);

            console.log('Generating', targetPath);

            if (item.isDirectory()) {
                // Queue subdirectory for processing
                queue.push({ source: sourcePath, target: targetPath });
            } else if (item.isFile() || item.isSymbolicLink()) {
                // Copy file or symbolic link
                await fs.copyFile(sourcePath, targetPath);
                if (isTemplate) {
                    // Process template if applicable
                    processVarsInFile(targetPath, template!.context);
                }
            }
        }
    }
}
