# NPM Package Publishing Scripts

This directory contains scripts for publishing packages to NPM with different versioning strategies.

## Overview

The `publish-all-packages.sh` script handles publishing packages with appropriate versioning based on the git branch:

- **llumiverse packages**: Only published on the `main` branch
- **composableai packages**: Published on both `main` and `preview` branches

## Usage

```bash
./publish-all-packages.sh <ref> [dry-run] [version-type]
```

### Parameters

- `ref` (required): Git reference - either `main` or `preview`
- `dry-run` (optional): Boolean (`true`/`false`) for dry run mode. Default: `false`
- `version-type` (optional): Version bump type (`patch`, `minor`, `major`) - only used for preview. Default: `patch`

### Examples

```bash
# Dry run for main branch
./publish-all-packages.sh main true

# Publish preview with patch bump
./publish-all-packages.sh preview false patch

# Publish preview with minor bump
./publish-all-packages.sh preview false minor
```

## Scenarios

### Scenario 1: Publishing from `main` branch

**Purpose**: Publish development versions for testing

**Steps**:
1. Publishes llumiverse packages (`@llumiverse/common`, `@llumiverse/core`, `@llumiverse/drivers`)
   - Version format: `{base-version}-dev-{commit-hash}` (e.g., `0.22.0-dev-87f3fee`)
   - NPM tag: `dev`
2. Updates all composableai package versions to dev format
   - Version format: `{base-version}-dev-{commit-hash}` (e.g., `1.2.0-dev-87f3fee`)
3. Publishes all composableai packages
   - NPM tag: `dev`
   - pnpm automatically resolves `workspace:*` llumiverse dependencies to the dev versions from step 1
4. **Does NOT commit** changes to git (these are temporary dev builds)

**Result**:
- All packages published with `dev` tag
- Consumers can install with: `npm install @vertesia/client@dev`
- Git repository remains unchanged

**Example**:
```bash
# Before (package.json):
# @llumiverse/common: 0.22.0
# @vertesia/client: 1.2.0

# After publishing (on npm):
# @llumiverse/common@0.22.0-dev-87f3fee (tag: dev)
# @vertesia/client@1.2.0-dev-87f3fee (tag: dev)
# └─ dependencies: @llumiverse/common@0.22.0-dev-87f3fee
```

### Scenario 2: Publishing from `preview` branch

**Purpose**: Publish official releases

**Steps**:
1. **Skips** llumiverse publishing (llumiverse only publishes from main)
2. Bumps root `package.json` version
3. Updates all composableai package versions using semantic versioning
   - Bump type: specified by `version-type` parameter (patch/minor/major)
   - Version format: standard semver (e.g., `1.2.0` → `1.2.1` for patch)
4. Publishes all composableai packages
   - NPM tag: `latest`
5. **Commits and pushes** version changes back to the `preview` branch (only if dry-run is false)

**Result**:
- All composableai packages published with `latest` tag
- Consumers can install with: `npm install @vertesia/client` (gets latest)
- Git repository updated with new versions

**Example (patch bump)**:
```bash
# Before (package.json):
# @vertesia/client: 1.2.0

# After publishing (on npm):
# @vertesia/client@1.2.1 (tag: latest)

# Git commit:
# "chore: bump package versions (patch)"
```

### Scenario 3: Dry Run Mode

**Purpose**: Test the publishing process without actually publishing

**Steps**:
- All version updates happen normally
- `npm publish` commands run with `--dry-run` flag
- No actual packages are published to NPM
- No git commits are made (even for preview)

**Usage**:
```bash
# Test main branch publishing
./publish-all-packages.sh main true

# Test preview branch publishing with minor bump
./publish-all-packages.sh preview true minor
```

**Result**:
- Shows what would be published
- Validates package.json files
- Safe to run multiple times
- No side effects

## GitHub Actions Workflow

The script is designed to be run from the `publish-npm.yaml` GitHub Actions workflow:

```yaml
- name: Publish all packages
  run: ./.github/bin/publish-all-packages.sh "${{ inputs.ref }}" "${{ inputs.dry_run }}" "${{ inputs.version_type }}"
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Workflow Inputs

- `ref`: Dropdown to select `main` or `preview`
- `dry_run`: Checkbox (default: true for safety)
- `version_type`: Dropdown for `patch`, `minor`, or `major` (only relevant for preview)

## Key Features

### Version Resolution

pnpm automatically resolves `workspace:*` dependencies during publish:
- When a composableai package references `"@llumiverse/common": "workspace:*"`
- pnpm reads the actual version from `llumiverse/common/package.json`
- The published package will contain the exact version (e.g., `"@llumiverse/common": "0.22.0-dev-87f3fee"`)

### Safety

- Dry run enabled by default in GitHub Actions
- All version updates happen before any publishing (prevents dependency mismatches)
- Portable shell syntax (works on macOS and Linux)

### Requirements

- `GITHUB_SHA` environment variable (for commit hash in dev versions)
- `NODE_AUTH_TOKEN` environment variable (for NPM authentication)
- pnpm workspace setup
- npm 11.5.1 or later
