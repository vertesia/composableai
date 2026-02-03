# NPM Package Publishing Scripts

The file `publish-all-packages.sh` contains logic for publishing vertesia packages to NPM with different versioning strategies.

## Overview

The `publish-all-packages.sh` script handles publishing packages with appropriate versioning based on the git branch:

- **`@vertesia/*` packages**: Publish on both `main` and `preview` branches
- **`@llumiverse/*` packages**: out of scope. They are handled by another GitHub Actions workflow, defined in their GitHub repository "vertesia/llumiverse".

## Usage

```bash
./publish-all-packages.sh --ref <ref> --version-type <strategy> [--version <value>] [--dry-run <value>]
```

### Parameters

- `--ref` (required): Git reference - `main` for dev builds, `preview` for releases. Publishing releaess outside of `preview` branch is forbidden.
- `version-type` (required): Version bump type (`patch`, `minor`, `dev`)
   - `minor` increases the minor version in the package version
   - `patch` increases the patch version in the package version
   - `dev` creates a new development version in format `{base-version}-dev.{date}.{time}`, such as `1.0.0-dev.20260128.144200Z`
- `dry-run` (optional): option to enable/disable dry run mode. The value can be `true`, `false` or no value (which means `true`). If not specified, it means that it is not a dry-run.

### Examples

```bash
# Dry run for main branch
./publish-all-packages.sh --ref main --dry-run --version-type dev
./publish-all-packages.sh --ref main --dry-run true --version-type dev

# Publish preview with patch bump
./publish-all-packages.sh --ref preview --dry-run --version-type patch

# Publish preview with minor bump
./publish-all-packages.sh --ref preview --version-type minor
```

## Scenarios

### Scenario 1: Publishing from `main` branch

**Purpose**: Publish development versions for testing

**Steps**:

1. Updates all composableai package versions to dev format
   - Version format: `{base-version}-dev.{date}.{time}` (e.g., `1.0.0-dev.20260128.144200Z`)
   - Version value: try to align with the package version defined in the llumiverse root package.json (`./llumiverse/package.json`).
     - If the value is a dev version, determine whether the date corresponds to the current date. If yes, use the same date. If the llumiverse version is already used by composableai (`./package.json`), it means that another dev version had been published earlier today, so don't use it again, generate a new version instead.
     - If the value is not a dev version, abort the script and raise an error.
2. Commit and push changes to Git if dry-run is false (rationale: it persists the value for the next version change)
3. Publishes all composableai packages
   - NPM tag: `dev`
   - pnpm automatically resolves `workspace:*` llumiverse dependencies to the dev versions
   - **IMPORTANT** exclude all the `@llumiverse/*` packages (`./llumiverse/*`) from the publishing logic

**Result**:
- All `@vertesia/*` packages published with `dev` tag
- Consumers can install with: `npm install @vertesia/{pkg}@dev` or `npm install @vertesia/{pkg}@{dev-version}`
- Git repository remains unchanged

**Example**:

```bash
# -----
# Example 1: publish both llumiverse and composableai
# -----
# Before publishing (package.json):
#
# @llumiverse/common: 1.0.0-dev.20260203.000000Z (i.e. we are in the middle of the publishing)
# @vertesia/client:   1.0.0-dev.20260128.144200Z

# After publishing (on npm):
#
# @llumiverse/common: 1.0.0-dev.20260203.000000Z
# @vertesia/client:   1.0.0-dev.20260203.000000Z (tag: dev)
# └─ dependencies: @llumiverse/common@1.0.0-dev.20260203.000000Z


# -----
# Example 2: publish composableai only (llumiverse unchanged)
# -----
# Before publishing (package.json):
#
# @llumiverse/common: 1.0.0-dev.20260128.144200Z
# @vertesia/client:   1.0.0-dev.20260128.144200Z

# After publishing (on npm):
#
# @llumiverse/common: 1.0.0-dev.20260128.144200Z
# @vertesia/client:   1.0.0-dev.20260203.000000Z (tag: dev)
# └─ dependencies: @llumiverse/common@1.0.0-dev.20260128.144200Z

```

### Scenario 2: Publishing from `preview` branch

**Purpose**: Publish official releases

**Steps**:
1. Bumps root `package.json` version and all composableai package versions using semantic versioning
   - Bump type: specified by `version-type` parameter (patch/minor/major)
   - Version format: standard semver (e.g., `1.2.0` → `1.2.1` for patch)
2. **Commits and pushes** version changes back to the `preview` branch (only if dry-run is false)
3. Publishes all composableai packages
   - NPM tag: `latest`

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
