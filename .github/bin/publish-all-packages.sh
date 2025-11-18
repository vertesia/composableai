#!/bin/bash
set -e

# Script to publish all packages to NPM
# Usage: publish-all-packages.sh <ref> [dry-run] [version-type]
#   ref: Git reference (main or preview)
#   dry-run: Optional boolean (true/false) for dry run mode
#   version-type: Optional version bump type (patch, minor, major) - only used for preview

REF=$1
DRY_RUN=${2:-false}
VERSION_TYPE=${3:-patch}

if [ -z "$REF" ]; then
  echo "Error: Missing required argument: ref"
  echo "Usage: $0 <ref> [dry-run] [version-type]"
  exit 1
fi

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: Invalid version type '$VERSION_TYPE'. Must be patch, minor, or major."
  exit 1
fi

# Check if dry run mode is enabled
if [ "$DRY_RUN" = "true" ]; then
  echo "=== DRY RUN MODE ENABLED ==="
  DRY_RUN_FLAG="--dry-run"
else
  DRY_RUN_FLAG=""
fi

# Step 1: Publish llumiverse packages (only for main branch)
if [ "$REF" = "main" ]; then
  echo "=== Publishing llumiverse packages ==="

  # Get llumiverse base version (all packages should have same version)
  llumiverse_base_version=$(cd llumiverse && pnpm pkg get version | tr -d '"' && cd ..)
  llumiverse_dev_version="${llumiverse_base_version}-dev-${GITHUB_SHA::7}"

  echo "Updating llumiverse to dev version ${llumiverse_dev_version}"

  # Update llumiverse root package.json
  cd llumiverse
  npm version ${llumiverse_dev_version} --no-git-tag-version --workspaces=false

  # Update all llumiverse workspace packages
  pnpm -r --filter "./*" exec npm version ${llumiverse_dev_version} --no-git-tag-version

  # Publish all llumiverse packages
  pnpm -r --filter "./*" exec npm publish --access public --tag dev ${DRY_RUN_FLAG}

  cd ..
fi

# Step 2: Update all composableai package versions first (before publishing)
echo "=== Updating composableai package versions ==="

if [ "$REF" = "main" ]; then
  # Main: create dev version
  pkg_version=$(pnpm pkg get version | tr -d '"')
  dev_version="${pkg_version}-dev-${GITHUB_SHA::7}"
  echo "Updating to dev version ${dev_version}"

  # Update root package.json
  npm version ${dev_version} --no-git-tag-version --workspaces=false

  # Update all workspace packages
  pnpm -r --filter "./packages/**" exec npm version ${dev_version} --no-git-tag-version
elif [ "$REF" = "preview" ]; then
  # Preview: bump version
  echo "Bumping ${VERSION_TYPE} version"

  # Update root package.json
  npm version ${VERSION_TYPE} --no-git-tag-version --workspaces=false

  # Update all workspace packages
  pnpm -r --filter "./packages/**" exec npm version ${VERSION_TYPE} --no-git-tag-version
fi

# Step 3: Publish composableai packages (after all versions are updated)
echo "=== Publishing composableai packages ==="

if [ "$REF" = "main" ]; then
  npm_tag="dev"
elif [ "$REF" = "preview" ]; then
  npm_tag="latest"
fi

for pkg_dir in packages/*; do
  if [ -d "$pkg_dir" ] && [ -f "$pkg_dir/package.json" ]; then
    pkg_name=$(basename "$pkg_dir")
    cd "$pkg_dir"

    pkg_version=$(pnpm pkg get version | tr -d '"')
    echo "Publishing ${pkg_name}@${pkg_version} with tag ${npm_tag}"

    # Publish
    if [ -n "$DRY_RUN_FLAG" ]; then
      npm publish --access public --tag ${npm_tag} ${DRY_RUN_FLAG}
    else
      npm publish --access public --tag ${npm_tag}
    fi

    cd ../..
  fi
done

# Step 4: Commit version changes (only for preview + not dry-run)
if [ "$REF" = "preview" ] && [ "$DRY_RUN" = "false" ]; then
  echo "=== Committing version changes ==="

  git config user.email "github-actions[bot]@users.noreply.github.com"
  git config user.name "github-actions[bot]"
  git add .
  git commit -m "chore: bump package versions (${VERSION_TYPE})"
  git push origin ${REF}

  echo "Version changes pushed to ${REF}"
fi

echo "=== Done ==="
