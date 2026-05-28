import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { hasErrorCode } from './options.js';

export async function readStdin() {
    const chunks = [];
    const stdin = process.stdin;
    stdin.resume();
    for await (const buf of stdin) {
        if (buf) {
            chunks.push(buf.toString());
        }
    }
    return chunks.join('');
}

export function readFile(file: string) {
    return readFileSync(file, 'utf8');
}

export function writeFile(file: string, data: string) {
    return writeFileSync(file, data, 'utf8');
}

export function readJsonFile(file: string) {
    return JSON.parse(readFile(file));
}

export function writeJsonFile(file: string, data: object) {
    return writeFile(file, JSON.stringify(data, null, 4));
}

export function makeDir(dir: string) {
    try {
        return mkdirSync(dir, { recursive: true });
    } catch (err: unknown) {
        if (!hasErrorCode(err, 'EEXIST')) {
            throw err;
        }
    }
}
