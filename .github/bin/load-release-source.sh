#!/usr/bin/env bash
set -euo pipefail
node --input-type=module - "$RELEASE_SOURCE_SHA" "${LLUMIVERSE_INPUT_SHA:-}" <<'JS'
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const identity=JSON.parse(fs.readFileSync('release-inputs.json','utf8'));
const lock=crypto.createHash('sha256').update(fs.readFileSync('pnpm-lock.yaml')).digest('hex');
if(identity.source_sha!==process.argv[2] || identity.lock_sha256!==lock ||
   !/^[0-9a-f]{40}$/.test(identity.dependency_sha) ||
   (process.argv[3] && identity.dependency_sha!==process.argv[3]))throw new Error('Prepared source identity mismatch');
for(const file of JSON.parse(fs.readFileSync('release-deleted-files.json','utf8'))){
  if(typeof file!=='string' || file.startsWith('/') || file.split('/').includes('.git') ||
     file.split('/').some(part=>part==='..'||part==='.'||!part))throw new Error('Invalid generated file deletion');
  fs.rmSync(file,{force:true});
}
// Stage newly generated files so checking out an existing release tag can restore them.
for(const file of JSON.parse(fs.readFileSync('release-generated-files.json','utf8'))){
  execFileSync('git',['add','--',file],{stdio:'inherit'});
}
fs.appendFileSync(process.env.GITHUB_ENV,`LLUMIVERSE_SHA=${identity.dependency_sha}\n`);
JS
dependency="$(node -p "require('./release-inputs.json').dependency_sha")"
git -C llumiverse fetch origin "$dependency"
git -C llumiverse checkout --detach "$dependency"
