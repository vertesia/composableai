#!/usr/bin/env bash
# Real superproject/submodule fixtures; only package installation/schema generation are substituted.
set -euo pipefail
# Every fixture starts with an explicit environment allowlist, including local invocations.
if [[ "${1:-}" != "--isolated-fixture" ]]; then
  exec env -i PATH="$PATH" HOME="$HOME" bash "${BASH_SOURCE[0]}" --isolated-fixture "$@"
fi
shift
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export GIT_ALLOW_PROTOCOL=file
mkdir -p "$work/bin"
cat > "$work/bin/pnpm" <<'JS'
#!/usr/bin/env node
const fs=require('node:fs');
const args=process.argv.slice(2), version=JSON.parse(fs.readFileSync('llumiverse/common/package.json')).dependencies.example;
const files=['api-contract/components.generated.json','store/intake-policy-schema.generated.ts',
 'store/editing-policy-schema.generated.ts','wire-types.generated.ts','wire-types.generated.test.ts','future.generated.ts'];
if(args.includes('--lockfile-only')){
 if(!args.includes('--no-frozen-lockfile'))throw new Error('Lockfile refresh must be explicit');
 fs.writeFileSync('pnpm-lock.yaml','resolved-example: '+version+'\n');
}else if(args[0]==='install'){
 if(!args.includes('--frozen-lockfile')||!fs.readFileSync('pnpm-lock.yaml','utf8').includes(version))throw new Error('Stale lockfile');
}else if(args.includes('gen:schemas')){
 fs.rmSync('packages/common/src/obsolete.generated.ts',{force:true});
 fs.writeFileSync('future-root.generated.json','new-root-output\n');
 for(const file of files)fs.writeFileSync('packages/common/src/'+file,'schema-for-example-'+version+'\n');
}else if(!args.includes('build'))throw new Error('Unexpected pnpm call '+args.join(' '));
JS
chmod +x "$work/bin/pnpm"
export PATH="$work/bin:$PATH"
git init -q -b main "$work/dependency"
git -C "$work/dependency" config user.name Test
git -C "$work/dependency" config user.email test@example.test
mkdir -p "$work/dependency/common"
printf '{"dependencies":{"example":"1.0.0"}}\n' > "$work/dependency/common/package.json"
git -C "$work/dependency" add .
git -C "$work/dependency" commit -qm old
old_dependency="$(git -C "$work/dependency" rev-parse HEAD)"
git init -q -b main "$work/source"
git init -q --bare "$work/remote"
cd "$work/source"
git config user.name Test
git config user.email test@example.test
git submodule add -q "$work/dependency" llumiverse
printf '{"version":"1.6.0-dev"}\n' > package.json
printf 'resolved-example: 1.0.0\n' > pnpm-lock.yaml
paths=(packages/common/src/api-contract/components.generated.json
 packages/common/src/store/intake-policy-schema.generated.ts
 packages/common/src/store/editing-policy-schema.generated.ts
 packages/common/src/wire-types.generated.ts packages/common/src/wire-types.generated.test.ts)
for path in "${paths[@]}"; do mkdir -p "$(dirname "$path")"; printf 'old-schema\n' > "$path"; done
printf 'obsolete\n' > packages/common/src/obsolete.generated.ts
git add .
git commit -qm source
source_sha="$(git rev-parse HEAD)"
git remote add origin "$work/remote"
git push -q origin main
printf '{"dependencies":{"example":"2.0.0"}}\n' > "$work/dependency/common/package.json"
git -C "$work/dependency" add .
git -C "$work/dependency" commit -qm new
new_dependency="$(git -C "$work/dependency" rev-parse HEAD)"
version=1.6.0-dev.20261021.123456Z
export GITHUB_REF_NAME=main RUNNER_TEMP="$work/preparation"
bash "$script_dir/prepare-release-source.sh" "$version" "$source_sha" "$new_dependency"
prepared="$RUNNER_TEMP/prepared-release-source"
grep -q '2.0.0' "$prepared/pnpm-lock.yaml"
grep -q 'schema-for-example-2.0.0' "$prepared/${paths[0]}"
# The CLI and publisher consume the SAME resolved lockfile and generated schemas.
for consumer in cli publisher; do
 git clone -q "$work/remote" "$work/$consumer" --branch main
 git -C "$work/$consumer" submodule update -q --init
 cp -R "$prepared/." "$work/$consumer/"
 (cd "$work/$consumer"
  RELEASE_SOURCE_SHA="$source_sha" LLUMIVERSE_INPUT_SHA="$new_dependency" GITHUB_ENV="$work/$consumer-env" bash "$script_dir/load-release-source.sh"
  [[ "$(git -C llumiverse rev-parse HEAD)" == "$new_dependency" ]]
  cmp pnpm-lock.yaml "$prepared/pnpm-lock.yaml"
  cmp "${paths[0]}" "$prepared/${paths[0]}"
  cmp packages/common/src/future.generated.ts "$prepared/packages/common/src/future.generated.ts"
  [[ ! -e packages/common/src/obsolete.generated.ts ]]
  cmp future-root.generated.json "$prepared/future-root.generated.json"
 )
done
# Tampering with a restored lockfile is rejected before the dependency is consumed.
printf 'tampered\n' > "$work/publisher/pnpm-lock.yaml"
if (cd "$work/publisher"; RELEASE_SOURCE_SHA="$source_sha" GITHUB_ENV="$work/rejected-env" bash "$script_dir/load-release-source.sh"); then exit 1; fi
# A tagged retry restores its recorded gitlink instead of building against the checkout's old dependency.
source "$script_dir/lib-release-cohort.sh"
RELEASE_TYPE=snapshot COORDINATED_RELEASE=true LLUMIVERSE_SHA="$new_dependency"
RELEASE_IDENTITY="$(release_identity "$source_sha" "$new_dependency")"
export RELEASE_IDENTITY LLUMIVERSE_SHA
node - "$version" "$source_sha" "$RELEASE_IDENTITY" <<'JS'
const fs=require('node:fs');fs.writeFileSync('package.json',JSON.stringify({version:process.argv[2],gitHead:process.argv[3],releaseIdentity:JSON.parse(process.argv[4])})+'\n');
JS
git add -- packages/common/src future-root.generated.json
persist_release_commit "$version"
# Downloaded new outputs are staged by the loader, so tagged retries can check them out safely.
(cd "$work/cli"
 git fetch -q origin "refs/tags/v$version:refs/tags/v$version"
 source "$script_dir/lib-release-cohort.sh"
 RELEASE_IDENTITY="$(cat release-inputs.json)" LLUMIVERSE_SHA="$new_dependency"
 resume_release_tag "$version" "$source_sha"
 [[ -f future-root.generated.json ]]
)
git checkout -q --detach "$source_sha"
git submodule update -q --init
[[ "$(git -C llumiverse rev-parse HEAD)" == "$old_dependency" ]]
bash "$script_dir/prepare-release-source.sh" "$version" "$source_sha" "$new_dependency"
[[ "$(git -C llumiverse rev-parse HEAD)" == "$new_dependency" ]]
[[ -f "$prepared/packages/common/src/future.generated.ts" ]]
grep -q obsolete.generated.ts "$prepared/release-deleted-files.json"
[[ "$(git ls-tree HEAD llumiverse | awk '{print $3}')" == "$new_dependency" ]]
git checkout -q --detach "$source_sha"
git submodule update -q --init
if bash "$script_dir/prepare-release-source.sh" "$version" "$source_sha"; then
 echo 'A retry without its original dependency override was accepted' >&2; exit 1
fi
echo 'Shared lockfile/schema preparation, CLI/publisher identity, tamper refusal and tagged submodule retry passed'
