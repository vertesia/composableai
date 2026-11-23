#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.txt into the native CLI packages.
//
//   node scripts/write-native-notices.mjs <bun metafile> <package dir>...
//
// `bun build --compile` puts every bundled npm package and the Bun runtime itself into the executable,
// so the notices of both ship beside it. The packages come from the metafile of that build; the Bun
// runtime's license, which covers the LGPL JavaScriptCore it links statically, is licenses/BUN-LICENSE.txt.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
    collectThirdPartyLicenses,
    renderThirdPartyNotices,
    resolveMetafileInputs,
    THIRD_PARTY_NOTICES_FILE,
} from '@vertesia/build-tools/licenses';

const [metafilePath, ...packageDirs] = process.argv.slice(2);
if (!metafilePath || packageDirs.length === 0) {
    console.error('Usage: write-native-notices <bun metafile> <package dir>...');
    process.exit(1);
}

const metafile = JSON.parse(readFileSync(metafilePath, 'utf8'));
const packages = collectThirdPartyLicenses(resolveMetafileInputs(metafile.inputs, process.cwd()));
const bunVersion = execFileSync('bun', ['--version'], { encoding: 'utf8' }).trim();
const bunLicense = readFileSync(new URL('../licenses/BUN-LICENSE.txt', import.meta.url), 'utf8');
const bunSection = [
    '-'.repeat(80),
    `Bun ${bunVersion} (https://bun.sh)`,
    'License: MIT, with JavaScriptCore and WebCore (WebKit) under LGPL-2.0',
    `Source: https://github.com/oven-sh/bun/tree/bun-v${bunVersion}`,
    '',
    'This executable embeds the Bun runtime. Bun links JavaScriptCore statically; under the LGPL you may',
    "obtain WebKit's source from https://github.com/oven-sh/WebKit and relink Bun as Bun's license describes.",
    'Bun license (as published with Bun 1.4.4):',
    '',
    bunLicense.trimEnd(),
    '',
].join('\n');
const notices = `${renderThirdPartyNotices(packages, 'the Vertesia CLI native executable')}${bunSection}\n`;
for (const dir of packageDirs) {
    writeFileSync(path.join(dir, THIRD_PARTY_NOTICES_FILE), notices);
}
console.log(
    `Wrote ${THIRD_PARTY_NOTICES_FILE} (${packages.length} packages and Bun ${bunVersion}) to ${packageDirs.join(', ')}`,
);
