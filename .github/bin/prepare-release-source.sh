#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$script_dir/lib-release-cohort.sh"
version="$1" source_sha="$2" requested_dependency="${3:-}"
validate_release_source "$GITHUB_REF_NAME" "$source_sha"
LLUMIVERSE_SHA="${requested_dependency:-$(git ls-tree HEAD llumiverse | awk '{print $3}')}"
export LLUMIVERSE_SHA
[[ "$LLUMIVERSE_SHA" =~ ^[0-9a-f]{40}$ ]]
if git rev-parse --verify "refs/tags/v$version" >/dev/null 2>&1; then
  lock_sha="$(git show "v$version:pnpm-lock.yaml" | shasum -a 256 | awk '{print $1}')"
  RELEASE_IDENTITY="$(node -e 'console.log(JSON.stringify({source_sha:process.argv[1],dependency_sha:process.argv[2],lock_sha256:process.argv[3]}))' "$source_sha" "$LLUMIVERSE_SHA" "$lock_sha")"
  export RELEASE_IDENTITY
  resume_release_tag "$version" "$source_sha"
else
  git -C llumiverse fetch origin "$LLUMIVERSE_SHA"
  git -C llumiverse checkout --detach "$LLUMIVERSE_SHA"
  pnpm install --lockfile-only --no-frozen-lockfile
  pnpm install --frozen-lockfile
  pnpm exec turbo run build --filter=@llumiverse/common
  pnpm --dir packages/common run gen:schemas
fi
prepared="$RUNNER_TEMP/prepared-release-source"
# Capture every generated addition/change/deletion, including files introduced by future generators.
# Comparing against the pinned source also works after resuming an immutable version tag.
node --input-type=module - "$prepared" "$source_sha" <<'JS'
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [target,source]=process.argv.slice(2);
const names=(args)=>execFileSync('git',args,{encoding:'utf8'}).split('\0').filter(Boolean);
const paths=new Set(['pnpm-lock.yaml',
  ...names(['diff','--name-only','--ignore-submodules=all','-z',source,'--']),
  ...names(['ls-files','--others','--exclude-standard','-z'])]);
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
const deleted=[];
for(const file of paths){
  if(!fs.existsSync(file)){deleted.push(file);continue;}
  const destination=path.join(target,file);
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(file,destination);
}
fs.writeFileSync(path.join(target,'release-deleted-files.json'),JSON.stringify(deleted)+'\n');
fs.writeFileSync(path.join(target,'release-generated-files.json'),JSON.stringify([...paths].filter(file=>!deleted.includes(file)))+'\n');
JS
identity="$(release_identity "$source_sha" "$LLUMIVERSE_SHA")"
printf '%s\n' "$identity" > "$prepared/release-inputs.json"
