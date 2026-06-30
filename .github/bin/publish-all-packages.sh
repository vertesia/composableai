#!/bin/bash
set -e

# Script to publish all composableai packages to NPM
# Usage: publish-all-packages.sh --ref <ref> --release-type <type> --bump-type <type> [--dry-run [true|false]] [--scope <vertesia|koa-stack>]
#   --ref: Git reference (main for dev builds, release/X.Y for releases, e.g. release/1.4)
#   --release-type: Release type (release, snapshot). Release creates stable versions, snapshot creates dev versions.
#   --bump-type: Bump type (minor, patch, keep). How to change the version.
#   --dry-run: Optional flag for dry run mode (value can be true, false, or omitted which means true)
#   --scope: Optional publish scope (default: vertesia).
#     - vertesia:  @vertesia/* packages (packages/** + libraries/jst), versioned off the root package.json.
#     - koa-stack: @koa-stack/* packages (libraries/koa-stack/*), versioned independently off libraries/koa-stack/router.
#     Both scopes share this script but have a different release cadence and version line.

# =============================================================================
# Functions
# =============================================================================

workspace_package_dirs() {
  local repo_root
  repo_root="$(git rev-parse --show-toplevel)"

  # Use pnpm workspace filtering so pnpm-workspace.yaml exclusions are authoritative.
  # The filter and the allowed-path guard are scope-specific (see configure_scope):
  #   - vertesia:  packages/* + libraries/jst
  #   - koa-stack: libraries/koa-stack/* (independent release cadence)
  pnpm -r "${PKG_FILTERS[@]}" exec pwd | while IFS= read -r pkg_dir; do
    [ -f "${pkg_dir}/package.json" ] || continue

    # Belt-and-suspenders: only keep dirs under the scope's expected subtree, so a
    # stray workspace match can never be published under the wrong release line.
    case "$SCOPE" in
      vertesia)
        case "$pkg_dir" in
          "${repo_root}"/packages/*|"${repo_root}"/libraries/jst) ;;
          *) continue ;;
        esac
        ;;
      koa-stack)
        case "$pkg_dir" in
          "${repo_root}"/libraries/koa-stack/*) ;;
          *) continue ;;
        esac
        ;;
    esac

    # Never publish private packages (e.g. @koa-stack/tests). `npm pkg get private`
    # prints `{}` when the field is absent, so only an explicit `true` is skipped.
    if [ "$(cd "$pkg_dir" && npm pkg get private | tr -d '"')" = "true" ]; then
      continue
    fi

    printf '%s\n' "$pkg_dir"
  done
}

update_package_versions() {
  echo "=== Updating composableai package versions ==="

  # Determine npm tag based on release type
  if [ "$RELEASE_TYPE" = "snapshot" ]; then
    npm_tag="dev"
  else
    npm_tag="latest"
  fi

  # Get current version (from the scope's version source) and strip any existing
  # -dev* suffix to get the base version.
  current_version=$( (cd "$VERSION_SOURCE_DIR" && npm pkg get version) | tr -d '"')
  base_version=$(echo "$current_version" | sed 's/-dev.*//')

  # Apply bump if needed (for both snapshot and release)
  if [ "$BUMP_TYPE" = "minor" ]; then
    # Bump minor version: X.Y.Z -> X.(Y+1).0
    IFS='.' read -r major minor patch <<< "$base_version"
    base_version="${major}.$((minor + 1)).0"
    echo "Bumped minor version to ${base_version}"
  elif [ "$BUMP_TYPE" = "patch" ]; then
    # Bump patch version: X.Y.Z -> X.Y.(Z+1)
    IFS='.' read -r major minor patch <<< "$base_version"
    base_version="${major}.${minor}.$((patch + 1))"
    echo "Bumped patch version to ${base_version}"
  fi

  if [ "$RELEASE_TYPE" = "snapshot" ]; then
    # Snapshot: create dev version with date/time stamp
    date_part=$(date -u +"%Y%m%d")
    time_part=$(date -u +"%H%M%SZ")
    new_version="${base_version}-dev.${date_part}.${time_part}"
    echo "Generating new snapshot version ${new_version}"
  else
    # Release: use base version as-is
    new_version="${base_version}"
    echo "Updating to release version ${new_version}"
  fi

  # Update root package.json (only for the vertesia scope — the root version is
  # @vertesia's source of truth; koa-stack versions live in their own packages).
  if [ "$UPDATE_ROOT_VERSION" = "true" ]; then
    npm version "${new_version}" --no-git-tag-version --workspaces=false
  fi

  # Update every package in the scope's publish set.
  pnpm -r "${PKG_FILTERS[@]}" exec npm version "${new_version}" --no-git-tag-version
}

publish_packages() {
  echo "=== Publishing composableai packages ==="

  while IFS= read -r pkg_dir; do
    pkg_name=$(basename "$pkg_dir")
    cd "$pkg_dir"

      pkg_version=$(npm pkg get version | tr -d '"')

    # Fail if npm_tag is not set (safety check to prevent publishing without explicit tag)
    if [ -z "$npm_tag" ]; then
      echo "Error: npm_tag is not set. This indicates an invalid ref/version-type combination."
      exit 1
    fi

    echo "Publishing ${NPM_SCOPE}/${pkg_name}@${pkg_version} with tag ${npm_tag}"

    # Publish
    if [ -n "$DRY_RUN_FLAG" ]; then
      pnpm publish --access public --tag "${npm_tag}" --no-git-checks ${DRY_RUN_FLAG}
    else
      pnpm publish --access public --tag "${npm_tag}" --no-git-checks
    fi

    cd "$(git rev-parse --show-toplevel)"
  done < <(workspace_package_dirs)
}

write_package_summary_rows() {
  local version="$1"

  while IFS= read -r pkg_dir; do
    pkg_name=$(basename "$pkg_dir")
    if [ "$DRY_RUN" = "true" ]; then
      echo "| \`${NPM_SCOPE}/${pkg_name}\` | ${version} |" >> "$GITHUB_STEP_SUMMARY"
    else
      pkg_url="https://www.npmjs.com/package/${NPM_SCOPE}/${pkg_name}?activeTab=versions"
      echo "| \`${NPM_SCOPE}/${pkg_name}\` | [${version}](${pkg_url}) |" >> "$GITHUB_STEP_SUMMARY"
    fi
  done < <(workspace_package_dirs)
}

update_template_versions() {
  echo "=== Updating create-plugin templateVersions ==="

  # Get the llumiverse version from its root package.json
  llumiverse_version=$(node -e "console.log(JSON.parse(require('fs').readFileSync('llumiverse/package.json', 'utf8')).version)")

  echo "  @vertesia version: ${new_version}"
  echo "  @llumiverse version: ${llumiverse_version}"

  # Write both versions into create-plugin's package.json templateVersions field
  node -e "
    const fs = require('fs');
    const pkgPath = 'packages/create-plugin/package.json';
    const p = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    p.templateVersions = { '@vertesia': '${new_version}', '@llumiverse': '${llumiverse_version}' };
    fs.writeFileSync(pkgPath, JSON.stringify(p, null, 2) + '\n');
  "

  echo "  ✓ Updated packages/create-plugin/package.json templateVersions"

  # Update version in each template's package.json (except worker-template)
  for tpl_dir in templates/*; do
    if [ -d "$tpl_dir" ] && [ -f "$tpl_dir/package.json" ]; then
      tpl_name=$(basename "$tpl_dir")
      if [ "$tpl_name" = "worker-template" ]; then
        echo "  ⏭ Skipping ${tpl_dir} (independent versioning)"
        continue
      fi
      cd "$tpl_dir"
      npm version "${new_version}" --no-git-tag-version
      echo "  ✓ Updated ${tpl_dir}/package.json version to ${new_version}"
      cd ../..
    fi
  done
}

commit_and_push() {
  echo "=== Committing version changes ==="

  # Get the version from the scope's version source.
  version=$( (cd "$VERSION_SOURCE_DIR" && npm pkg get version) | tr -d '"')

  git config user.email "github-actions[bot]@users.noreply.github.com"
  git config user.name "github-actions[bot]"
  git add .

  # Tag the scope in non-default commit messages so koa-stack and @vertesia
  # version bumps stay distinguishable in the shared branch history.
  local scope_label=""
  [ "$SCOPE" != "vertesia" ] && scope_label="${NPM_SCOPE} "

  if [ "$RELEASE_TYPE" = "release" ]; then
    git commit -m "chore: release ${scope_label}${version}"
  else
    git commit -m "chore: snapshot ${scope_label}${version}"
  fi

  git push origin "$REF"

  # Create git tag(s) for release stability. vertesia publishes both the legacy
  # `v${version}` (for backward compatibility) and the namespaced
  # `vertesia/v${version}`; koa-stack uses its own `koa-stack/v${version}` line.
  if [ "$RELEASE_TYPE" = "release" ]; then
    for tag_prefix in "${TAG_PREFIXES[@]}"; do
      tag_name="${tag_prefix}${version}"
      git tag "$tag_name"
      git push origin "$tag_name"
      echo "Created and pushed tag: ${tag_name}"
    done
  fi

  echo "Version changes pushed to ${REF}"
}

write_github_summary() {
  # Skip if not running in GitHub Actions
  if [ -z "$GITHUB_STEP_SUMMARY" ]; then
    echo "Skipping GitHub summary (not running in GitHub Actions)"
    return
  fi

  echo "=== Writing GitHub Summary ==="

  # Get the version from the scope's version source.
  version=$( (cd "$VERSION_SOURCE_DIR" && npm pkg get version) | tr -d '"')

  # Determine title based on dry run mode
  if [ "$DRY_RUN" = "true" ]; then
    title="## 🧪 Dry Run Summary"
  else
    title="## 📦 Published Packages"
  fi

  # Write summary table
  cat >> "$GITHUB_STEP_SUMMARY" << EOF
${title}

| Package | Version |
| ------- | ------- |
EOF

  write_package_summary_rows "$version"

  # Add metadata
  cat >> "$GITHUB_STEP_SUMMARY" << EOF

**NPM Tag:** \`${npm_tag}\`
**Branch:** \`${REF}\`
**Dry Run:** \`${DRY_RUN}\`
EOF
}

# =============================================================================
# Argument parsing and validation
# =============================================================================

# Default values
REF=""
DRY_RUN=false
RELEASE_TYPE=""
BUMP_TYPE=""
SCOPE="vertesia"

# Parse named arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --ref)
      REF="$2"
      shift 2
      ;;
    --dry-run)
      # Check if next argument is a value (true/false) or another flag/end of args
      if [[ -n "$2" && "$2" != --* ]]; then
        if [[ "$2" = "true" ]]; then
          DRY_RUN=true
        elif [[ "$2" = "false" ]]; then
          DRY_RUN=false
        else
          echo "Error: Invalid value for --dry-run '$2'. Must be 'true' or 'false'."
          exit 1
        fi
        shift 2
      else
        # No value provided, default to true
        DRY_RUN=true
        shift
      fi
      ;;
    --release-type)
      RELEASE_TYPE="$2"
      shift 2
      ;;
    --bump-type)
      BUMP_TYPE="$2"
      shift 2
      ;;
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    *)
      echo "Error: Unknown argument '$1'"
      echo "Usage: $0 --ref <ref> --release-type <type> --bump-type <type> [--dry-run [true|false]] [--scope <vertesia|koa-stack>]"
      exit 1
      ;;
  esac
done

# Validate required arguments
if [ -z "$REF" ]; then
  echo "Error: Missing required argument: --ref"
  echo "Usage: $0 --ref <ref> --release-type <type> --bump-type <type> [--dry-run [true|false]]"
  exit 1
fi

if [ -z "$RELEASE_TYPE" ]; then
  echo "Error: Missing required argument: --release-type"
  echo "Usage: $0 --ref <ref> --release-type <type> --bump-type <type> [--dry-run [true|false]]"
  exit 1
fi

if [ -z "$BUMP_TYPE" ]; then
  echo "Error: Missing required argument: --bump-type"
  echo "Usage: $0 --ref <ref> --release-type <type> --bump-type <type> [--dry-run [true|false]]"
  exit 1
fi

# Validate release type
if [[ ! "$RELEASE_TYPE" =~ ^(release|snapshot)$ ]]; then
  echo "Error: Invalid release type '$RELEASE_TYPE'. Must be 'release' or 'snapshot'."
  exit 1
fi

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(minor|patch|keep)$ ]]; then
  echo "Error: Invalid bump type '$BUMP_TYPE'. Must be 'minor', 'patch', or 'keep'."
  exit 1
fi

# Validate scope
if [[ ! "$SCOPE" =~ ^(vertesia|koa-stack)$ ]]; then
  echo "Error: Invalid scope '$SCOPE'. Must be 'vertesia' or 'koa-stack'."
  exit 1
fi

# =============================================================================
# Scope profile
# =============================================================================
# Each scope publishes a disjoint set of packages on its own version line. These
# variables drive every scope-specific decision in the functions above.
#   PKG_FILTERS         pnpm -r filters selecting the publish set
#   NPM_SCOPE           npm scope used in logs / GitHub summary links
#   VERSION_SOURCE_DIR  dir whose package.json holds the canonical base version
#   UPDATE_ROOT_VERSION whether to bump the repo-root package.json
#   UPDATE_TEMPLATES    whether to refresh create-plugin templateVersions
#   TAG_PREFIXES        git tag prefix(es) created on releases (one tag per prefix)
case "$SCOPE" in
  vertesia)
    PKG_FILTERS=(--filter "./packages/**" --filter "./libraries/jst")
    NPM_SCOPE="@vertesia"
    VERSION_SOURCE_DIR="."
    UPDATE_ROOT_VERSION=true
    UPDATE_TEMPLATES=true
    # Keep the legacy `v${version}` tag (create-plugin's template resolver and
    # other scripts rely on it) and add the namespaced `vertesia/v${version}`.
    TAG_PREFIXES=("v" "vertesia/v")
    ;;
  koa-stack)
    PKG_FILTERS=(--filter "./libraries/koa-stack/*")
    NPM_SCOPE="@koa-stack"
    VERSION_SOURCE_DIR="libraries/koa-stack/router"
    UPDATE_ROOT_VERSION=false
    UPDATE_TEMPLATES=false
    TAG_PREFIXES=("koa-stack/v")
    ;;
esac

echo "=== Publishing scope: ${SCOPE} (${NPM_SCOPE}/*) ==="

# Validate that releases can only be published from a release branch (release/X.Y, e.g. release/1.4)
# or a legacy bare-numeric maintenance branch (skip in dry-run)
if [ "$RELEASE_TYPE" = "release" ] && [ "$DRY_RUN" != "true" ] && [[ ! "$REF" =~ ^release/[0-9]+\.[0-9]+$ ]] && [[ ! "$REF" =~ ^[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Release versions can only be published from a 'release/X.Y' branch (e.g. release/1.4) or a maintenance branch."
  echo "Current branch: $REF"
  exit 1
fi

# Set dry run flag
if [ "$DRY_RUN" = "true" ]; then
  echo "=== DRY RUN MODE ENABLED ==="
  DRY_RUN_FLAG="--dry-run"
else
  DRY_RUN_FLAG=""
fi

# =============================================================================
# Main flow
# =============================================================================

update_package_versions

# create-plugin templates embed @vertesia versions only; koa-stack has no templates.
if [ "$UPDATE_TEMPLATES" = "true" ]; then
  update_template_versions
fi

echo "=== Building all packages ==="
pnpm build

if [ "$DRY_RUN" = "false" ]; then
  commit_and_push
fi

publish_packages

write_github_summary

echo "=== Done ==="
