import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { program } from 'commander';
import { setupMemoCommand } from './command.js';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

let _package: unknown;
function getPackage() {
    if (_package === undefined) {
        _package = JSON.parse(readFileSync(`${packageDir}/package.json`, 'utf8'));
    }
    return _package;
}
function getVersion() {
    return getPackage().version;
}

program.version(getVersion());
setupMemoCommand(program);
program.parse();
