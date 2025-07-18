import { program } from 'commander';
import { setupMemoCommand } from './command.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

let _package: any;
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
