#!/usr/bin/env node
// Writes THIRD-PARTY-NOTICES.txt into the native CLI packages.
//
//   node scripts/write-native-notices.mjs <bun metafile> <package dir>...
//
// `bun build --compile` puts every bundled npm package and the Bun runtime itself into the executable,
// so the notices of both ship beside it. The packages come from the metafile of that build. The Bun
// runtime is described by files kept for the version in .bun-version, which the release installs:
// licenses/BUN-LICENSE.txt (Bun's own LICENSE.md, copied from that release), the full MIT text, and the
// full LGPL-2.0 text that covers the JavaScriptCore and WebCore it links statically, with the WebKit commit
// that release builds from (WEBKIT_VERSION in Bun's scripts/build/deps/webkit.ts). The script refuses to
// run with another Bun, so the notices cannot describe a runtime other than the one embedded.

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
// The WebKit commit each supported Bun release builds JavaScriptCore from.
const WEBKIT_COMMITS = { '1.4.4': 'd6375c72affe0f70222cdcb45012b10f0bf3a9d5' };

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8');
const expectedBun = read('../.bun-version').trim();
const bunVersion = execFileSync('bun', ['--version'], { encoding: 'utf8' }).trim();
if (bunVersion !== expectedBun || !WEBKIT_COMMITS[bunVersion]) {
    console.error(
        `Bun ${bunVersion} is installed, but the notices describe Bun ${expectedBun} (packages/cli/.bun-version). ` +
            'Build with that version, or update .bun-version, licenses/BUN-LICENSE.txt and WEBKIT_COMMITS together.',
    );
    process.exit(1);
}
const webkitCommit = WEBKIT_COMMITS[bunVersion];
const bunSection = [
    '-'.repeat(80),
    `Bun ${bunVersion} (https://bun.sh)`,
    'License: MIT, with JavaScriptCore and WebCore (WebKit) under LGPL-2.0',
    `Source: https://github.com/oven-sh/bun/tree/bun-v${bunVersion}`,
    `WebKit source (JavaScriptCore and WebCore): https://github.com/oven-sh/WebKit/tree/${webkitCommit}`,
    '',
    'This executable embeds the Bun runtime, which links JavaScriptCore statically. Under the LGPL you may',
    'obtain the WebKit source above, and the source of Bun and of this CLI (both published), and relink Bun',
    "as Bun's license describes.",
    '',
    `Bun license (LICENSE.md of Bun ${bunVersion}):`,
    '',
    read('../licenses/BUN-LICENSE.txt').trimEnd(),
    '',
    'MIT License text (Bun):',
    '',
    read('../licenses/MIT-bun.txt').trimEnd(),
    '',
    'GNU Library General Public License, version 2 (JavaScriptCore and WebCore):',
    '',
    read('../licenses/LGPL-2.0.txt').trimEnd(),
    '',
].join('\n');
const notices = `${renderThirdPartyNotices(packages, 'the Vertesia CLI native executable')}${bunSection}\n`;
for (const dir of packageDirs) {
    writeFileSync(path.join(dir, THIRD_PARTY_NOTICES_FILE), notices);
}
console.log(
    `Wrote ${THIRD_PARTY_NOTICES_FILE} (${packages.length} packages and Bun ${bunVersion}) to ${packageDirs.join(', ')}`,
);
