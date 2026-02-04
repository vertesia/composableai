# NPM Package Publishing Scripts

The file `publish-all-packages.sh` contains logic for publishing vertesia packages to NPM with different versioning strategies.

## Overview

The `publish-all-packages.sh` script handles publishing packages with appropriate versioning based on the git branch:

- **`@vertesia/*` packages**: Publish on both `main` and `preview` branches
- **`@llumiverse/*` packages**: out of scope. They are handled by another GitHub Actions workflow, defined in their GitHub repository "vertesia/llumiverse".

## Usage

```bash
./publish-all-packages.sh \
    --ref <ref> \
    --release-type <type> \
    --bump-type <type> \
    --dry-run <value>
```

### Parameters

- `--ref` (required): Git reference - `main` for dev builds, `preview` for releases. Publishing releases outside of `preview` branch is forbidden.
- `--release-type` (required): The type of the version, either "release" or "snapshot". A "release" means this is a stable version. A "snapshot" means this is a development version.
  - "release" creates a stable version respecting semantic versioning, such as `1.0.0`. Release can only be performed from the `preview` branch.
  - "snapshot" creates a new development version in format `{base}-dev.{date}.{time}`, such as `1.0.0-dev.20260128.144200Z`. Note that the time part contains 'Z', which means that the time is in UTC; it also allows NPM to use leading zeros, as it turns the segment into alphanumeric.
- `--bump-type` (required): The strategy for changing the version (`minor`, `patch`, `keep`)
  - `minor` increases the minor version in the package version
  - `patch` increases the patch version in the package version
  - `keep` keeps using the current base version.
- `--dry-run` (optional): Flag to enable dry run mode. The value can be `true`, `false` or no value (which means `true`). If not specified, it means that it is not a dry-run.

### Examples

```bash
# Dry run for main branch
./publish-all-packages.sh \
    --ref main \
    --release-type snapshot \
    --bump-type keep \
    --dry-run true

# Publish snapshot without bump from main
# (ex: 1.0.0-dev.20260203.000000Z -> 1.0.0-dev.20260204.000000Z)
./publish-all-packages.sh \
    --ref main \
    --release-type snapshot \
    --bump-type keep

# Publish release with 'patch' bump from preview
# (ex: 0.24.0-dev.20260203.164053Z -> 0.24.1)
# (ex: 0.24.0 -> 0.24.1)
./publish-all-packages.sh \
    --ref preview \
    --release-type release \
    --bump-type patch

# Publish release with minor bump from preview
# (ex: 0.24.0-dev.20260203.164053Z -> 0.25.0)
# (ex: 0.24.0 -> 0.25.0)
./publish-all-packages.sh \
    --ref preview \
    --release-type release \
    --bump-type minor
```

### NPM Tags

* `dev` tag is used when changing a snapshot version on main.
* `latest` tag is used when changing a release version (minor, patch)

## Scenarios

### Scenario 1: Publishing from `main` branch

**Purpose**: Publish snapshot versions for testing

**Steps**:

1. Updates all composableai package versions to dev format
   - Version format: `{base}-dev.{date}.{time}` (e.g., `1.0.0-dev.20260128.144200Z`)
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

**Example**:

```bash
# ==========
# Example 1: we had a release version
# -----
# params: ref=main, release_type=snapshot, bump_type=minor
# ==========
#
# Before publishing (package.json):
#
# @llumiverse/common: 1.1.0-dev.20260203.000000Z (i.e. llumiverse was already published)
# @vertesia/client:   1.0.0

# After publishing (on npm):
#
# @llumiverse/common: 1.1.0-dev.20260203.000000Z
# @vertesia/client:   1.1.0-dev.20260203.000000Z (tag: dev)
# └─ dependencies: @llumiverse/common@1.0.0-dev.20260203.000000Z


# ==========
# Example 2: we had a snapshot version
# -----
# params: ref=main, release_type=snapshot, bump_type=keep
# ==========
#
# Before publishing (package.json):
#
# @llumiverse/common: 1.0.0-dev.20260128.144200Z
# @vertesia/client:   1.0.0-dev.20260128.144200Z

# After publishing (on npm):
#
# @llumiverse/common: 1.0.0-dev.20260128.144200Z
# @vertesia/client:   1.0.0-dev.20260204.000000Z (tag: dev)
# └─ dependencies: @llumiverse/common@1.0.0-dev.20260128.144200Z
```

### Scenario 2: Publishing official releases

**Purpose**: Publish official releases from `preview`

**Steps**:
1. Bumps root `package.json` version and all composableai package versions using semantic versioning
   - Bump type: specified by `bump-type` parameter (patch/minor/keep)
   - Verify that the release type is "release" and is not "snapshot".
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
# ==========
# Example 1: we had a snapshot version
# -----
# params: ref=preview, release_type=release, bump_type=keep
# ==========

# Before (package.json):
# @vertesia/client: 1.2.0-dev.20260204.000000Z

# After publishing (on npm):
# @vertesia/client@1.2.0 (tag: latest)

# Git commit:
# "chore: release 1.2.0"


# ==========
# Example 2: we had a release version
# -----
# params: ref=preview, release_type=release, bump_type=patch
# ==========

# Before (package.json):
# @vertesia/client: 1.2.0

# After publishing (on npm):
# @vertesia/client@1.2.1 (tag: latest)

# Git commit:
# "chore: release 1.2.1"
```

### Scenario 3: Dry Run Mode

**Purpose**: Test the publishing process without actually publishing

**Steps**:
- All version updates happen normally
- `npm publish` commands run with `--dry-run` flag
- Package tarballs are created and verified
- No actual packages are published to NPM
- No git commits are made

**Usage**:

```bash
# Test publishing logic on main
./publish-all-packages.sh --ref main --dry-run --release-type snapshot --bump-type keep

# Test publishing logic on preview
./publish-all-packages.sh --ref preview --dry-run --release-type release --bump-type minor
./publish-all-packages.sh --ref preview --dry-run --release-type release --bump-type patch
./publish-all-packages.sh --ref preview --dry-run --release-type snapshot --bump-type keep
```

**Result**:
- Shows what would be published
- Validates package versions and dependencies
- Safe to run multiple times
- No side effects

## GitHub Actions Workflow

The script is designed to be run from the `publish-npm.yaml` GitHub Actions workflow:

```yaml
- name: Publish all packages
  run: |
    ./.github/bin/publish-all-packages.sh \
        --ref "${{ inputs.ref }}" \
        --release-type "${{ inputs.release_type }}" \
        --bump-type "${{ inputs.bump_type }}" \
        --dry-run "${{ inputs.dry_run }}"
```

### Workflow Inputs

- `ref`: Text input for git reference (inferred from the Git event) → maps to `--ref`
- "Release Type" (`release_type`): Dropdown for `release` and `snapshot`.
- "Version Bump" (`bump_type`): Dropdown for `patch`, `minor`, or `keep` → maps to `--bump-type`
- "Dry Run" (`dry_run`): Checkbox (default: true for safety) → maps to `--dry-run true` or `--dry-run false`

## Key Features

### Version Resolution

pnpm automatically resolves `workspace:*` dependencies during publish:
- When a composableai package references `"@llumiverse/common": "workspace:*"`
- pnpm reads the actual version from `llumiverse/common/package.json`
- The published package will contain the exact version

### Verification (Dry Run)

In dry run mode, the script:
- Packs each package into a tarball
- Extracts and verifies the version matches expected
- Checks that internal dependencies point to correct versions
- Reports any mismatches

### Safety

- Dry run enabled by default in GitHub Actions
- All version updates happen before any publishing
- Changes push to GitHub before publishing to prevent Git conflicts
- Restrict publishing from the `preview` branch
- Portable shell syntax (works on macOS and Linux)

### Requirements

- pnpm workspace setup
- npm 11.5.1 or later
