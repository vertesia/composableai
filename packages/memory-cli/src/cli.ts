import { program } from 'commander';
import { setupMemoCommand } from './command.js';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

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
