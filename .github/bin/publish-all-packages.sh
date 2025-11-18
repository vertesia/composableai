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
  pnpm -r --filter "./*" exec pnpm publish --access public --tag dev --no-git-checks ${DRY_RUN_FLAG}

  cd ..

  # Update workspace links after llumiverse version changes
  echo "=== Updating workspace links ==="
  pnpm install --frozen-lockfile --force
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

  # Get the new version from root
  new_version=$(pnpm pkg get version | tr -d '"')
  echo "Setting all packages to version ${new_version}"

  # Set all workspace packages to the same version as root
  pnpm -r --filter "./packages/**" exec npm version ${new_version} --no-git-tag-version
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
      pnpm publish --access public --tag ${npm_tag} --no-git-checks ${DRY_RUN_FLAG}
    else
      pnpm publish --access public --tag ${npm_tag} --no-git-checks
    fi

    cd ../..
  fi
done

# Step 4: Verify published packages (only dry-run mode)
if [ "$DRY_RUN" = "true" ]; then
  echo "=== Verifying package tarballs ==="

  # Array to track failed packages
  failed_packages=()

  # Verify llumiverse packages (only for main branch)
  if [ "$REF" = "main" ]; then
    echo ""
    echo "=== Verifying llumiverse packages ==="
    cd llumiverse
    for pkg in common core drivers; do
      if [ -d "$pkg" ]; then
        cd "$pkg"
        pkg_name="llumiverse-${pkg}"

        echo "Packing ${pkg_name}..."
        pnpm pack --pack-destination . > /dev/null 2>&1
        tarball=$(ls -t *.tgz 2>/dev/null | head -1)

        if [ -n "$tarball" ] && [ -f "$tarball" ]; then
          echo "Checking ${pkg_name}:"
          packed_json=$(tar -xzOf "$tarball" package/package.json)

          # Check version
          packed_version=$(echo "$packed_json" | grep '"version":' | head -1 | sed 's/.*: "\(.*\)".*/\1/')
          has_issues=false

          if [ "$packed_version" = "${llumiverse_dev_version}" ]; then
            echo "  ✓ Version: ${packed_version}"
          else
            echo "  ✗ WARNING: Version mismatch (expected: ${llumiverse_dev_version}, got: ${packed_version})"
            has_issues=true
          fi

          # Extract dependencies section
          deps_section=$(echo "$packed_json" | sed -n '/"dependencies":/,/^  [}]/p')

          # Check for @llumiverse dependencies
          llumiverse_deps=$(echo "$deps_section" | grep '"@llumiverse/' || true)
          if [ -n "$llumiverse_deps" ]; then
            echo "$llumiverse_deps"
            if echo "$llumiverse_deps" | grep -q "${llumiverse_dev_version}"; then
              echo "  ✓ llumiverse dependencies: ${llumiverse_dev_version}"
            else
              echo "  ✗ WARNING: llumiverse dependencies version mismatch"
              has_issues=true
            fi
          fi

          # Add to failed packages if there were issues
          if [ "$has_issues" = true ]; then
            failed_packages+=("${pkg_name}")
          fi

          # Clean up tarball
          rm -f "$tarball"
        fi

        cd ..
      fi
    done
    cd ..
    echo ""
  fi

  echo "=== Verifying composableai packages ==="

  for pkg_dir in packages/*; do
    if [ -d "$pkg_dir" ] && [ -f "$pkg_dir/package.json" ]; then
      pkg_name=$(basename "$pkg_dir")
      cd "$pkg_dir"

      # Pack the package to create tarball (pnpm resolves workspace:* during pack)
      echo "Packing ${pkg_name}..."
      pnpm pack --pack-destination . > /dev/null 2>&1
      tarball=$(ls -t *.tgz 2>/dev/null | head -1)

      if [ -n "$tarball" ] && [ -f "$tarball" ]; then
        # Extract package.json from tarball
        echo "Checking dependencies in ${pkg_name}:"
        packed_json=$(tar -xzOf "$tarball" package/package.json)

        # Extract dependencies section
        deps_section=$(echo "$packed_json" | sed -n '/"dependencies":/,/^  [}]/p')

        # Show all @llumiverse and @vertesia dependencies
        echo "$deps_section" | grep -E '"@(llumiverse|vertesia)/' | head -20 || echo "  (no llumiverse or vertesia dependencies)"

        # Track if this package has issues
        has_issues=false

        # Verify llumiverse dependencies (only for main branch)
        llumiverse_deps=$(echo "$deps_section" | grep '"@llumiverse/' || true)
        if [ "$REF" = "main" ] && [ -n "$llumiverse_deps" ]; then
          if echo "$llumiverse_deps" | grep -q "${llumiverse_dev_version}"; then
            echo "  ✓ llumiverse dependencies: ${llumiverse_dev_version}"
          else
            echo "  ✗ WARNING: llumiverse dependencies version mismatch"
            has_issues=true
          fi
        fi

        # Verify vertesia dependencies
        vertesia_deps=$(echo "$deps_section" | grep '"@vertesia/' || true)
        if [ -n "$vertesia_deps" ]; then
          if [ "$REF" = "main" ]; then
            expected_version="${dev_version}"
          else
            # For preview, get the actual version from package.json
            expected_version=$(pnpm pkg get version | tr -d '"')
          fi

          if echo "$vertesia_deps" | grep -q "${expected_version}"; then
            echo "  ✓ vertesia dependencies: ${expected_version}"
          else
            echo "  ✗ WARNING: vertesia dependencies version mismatch"
            has_issues=true
          fi
        fi

        # Add to failed packages if there were issues
        if [ "$has_issues" = true ]; then
          failed_packages+=("${pkg_name}")
        fi

        # Clean up tarball
        rm -f "$tarball"
      fi

      cd ../..
    fi
  done

  # Print summary
  echo ""
  echo "=== Verification Summary ==="
  if [ ${#failed_packages[@]} -eq 0 ]; then
    echo "✓ All packages passed verification"
  else
    echo "✗ ${#failed_packages[@]} package(s) failed verification:"
    for pkg in "${failed_packages[@]}"; do
      echo "  - ${pkg}"
    done
  fi
fi

# Step 5: Commit version changes (only for preview + not dry-run)
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
