import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [moduleUrl, directory, counter] = process.argv.slice(2);
const { withProfileAuthLock } = await import(moduleUrl);
process.stdout.write('ready\n');
while (true) {
    try {
        await access(join(directory, 'start'));
        break;
    } catch {
        await delay(10);
    }
}
await withProfileAuthLock(
    'shared-profile',
    async () => {
        const previous = Number(await readFile(counter, 'utf8'));
        await delay(200);
        await writeFile(counter, String(previous + 1));
    },
    directory,
);
