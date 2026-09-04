#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib-package-channel.sh"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$REPO_ROOT"

PACKAGES=(body router server)
REF=""
RELEASE_TYPE=""
BUMP_TYPE=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      REF="$2"
      shift 2
      ;;
    --release-type)
      RELEASE_TYPE="$2"
      shift 2
      ;;
    --bump-type)
      BUMP_TYPE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="$2"
      shift 2
      ;;
    *)
      echo "Error: Unknown argument '$1'" >&2
      exit 1
      ;;
  esac
done

if [ -z "$REF" ] || [[ ! "$RELEASE_TYPE" =~ ^(release|snapshot)$ ]] || [[ ! "$BUMP_TYPE" =~ ^(minor|patch|keep)$ ]]; then
  echo "Usage: $0 --ref <ref> --release-type <release|snapshot> --bump-type <minor|patch|keep> --dry-run <true|false>" >&2
  exit 1
fi
if [[ ! "$DRY_RUN" =~ ^(true|false)$ ]]; then
  echo "Error: --dry-run must be true or false." >&2
  exit 1
fi
if [ "$RELEASE_TYPE" = "release" ] && [ "$DRY_RUN" = "false" ] && [[ ! "$REF" =~ ^release/[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Releases must be published from a release/X.Y branch." >&2
  exit 1
fi

source_sha=$(git rev-parse HEAD)
npm_tag=$(resolve_package_channel "$REF" "$RELEASE_TYPE" "$source_sha")
current_version=$(node -p "require('./libraries/koa-stack/body/package.json').version")
base_version=$(printf '%s\n' "$current_version" | sed 's/-dev.*//')
IFS='.' read -r major minor patch <<< "$base_version"
case "$BUMP_TYPE" in
  minor) base_version="${major}.$((minor + 1)).0" ;;
  patch) base_version="${major}.${minor}.$((patch + 1))" ;;
esac
if [ "$RELEASE_TYPE" = "snapshot" ]; then
  new_version="${base_version}-dev.$(date -u +'%Y%m%d.%H%M%SZ')"
else
  new_version="$base_version"
fi

echo "Publishing Koa cohort ${new_version} from ${REF} under ${npm_tag}"
for package in "${PACKAGES[@]}"; do
  npm --prefix "libraries/koa-stack/${package}" version "$new_version" --no-git-tag-version
done

pnpm --filter "./libraries/koa-stack/**" build

commit_version_changes() {
  git config user.email "github-actions[bot]@users.noreply.github.com" &&
    git config user.name "github-actions[bot]" &&
    git add \
      libraries/koa-stack/body/package.json \
      libraries/koa-stack/router/package.json \
      libraries/koa-stack/server/package.json &&
    git commit -m "chore: ${RELEASE_TYPE} koa-stack ${new_version}" &&
    git push origin "$REF"
}

push_status="not-required"
if [ "$DRY_RUN" = "false" ] && [ "$RELEASE_TYPE" = "release" ]; then
  commit_version_changes
  push_status="pushed-before-npm"
fi

for package in "${PACKAGES[@]}"; do
  publish_args=(--access public --tag "$npm_tag" --no-git-checks)
  [ "$DRY_RUN" = "true" ] && publish_args+=(--dry-run)
  pnpm --dir "libraries/koa-stack/${package}" publish "${publish_args[@]}"
done

# Snapshot publication is the useful result. Keep its version commit as best-effort
# bookkeeping so a git push failure cannot prevent or misreport a successful npm cohort.
if [ "$DRY_RUN" = "false" ] && [ "$RELEASE_TYPE" = "snapshot" ]; then
  if commit_version_changes; then
    push_status="pushed-after-npm"
  else
    push_status="failed-after-npm"
    echo "Warning: Koa snapshot ${new_version} was published, but its version commit could not be pushed." >&2
  fi
elif [ "$DRY_RUN" = "true" ]; then
  push_status="dry-run"
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "version=${new_version}" >> "$GITHUB_OUTPUT"
  echo "npm_tag=${npm_tag}" >> "$GITHUB_OUTPUT"
fi

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## Koa-stack package publish"
    echo
    echo "- Version: \`${new_version}\`"
    echo "- NPM tag: \`${npm_tag}\`"
    echo "- Dry run: \`${DRY_RUN}\`"
    echo "- Version commit: \`${push_status}\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi
