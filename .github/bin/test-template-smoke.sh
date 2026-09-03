#!/bin/bash
set -e

# Script to smoke-test published packages by bootstrapping a template and building it.
# Tests against the real npm registry (no verdaccio).
#
# Usage: test-template-smoke.sh --release-type <snapshot|release> [--template <name>] [--package-version <version>] [--wait]
#   --release-type: Determines the track tag and template branch
#   --package-version: Exact published create-plugin/package cohort to test
#   --template: Template name to test (default: "Vertesia Plugin")
#   --wait: Wait for npm propagation before testing (default: false)
#
# Prerequisites:
#   - Node.js and pnpm must be installed
#   - Packages must be published to npm (or use --wait to wait for propagation)
#
# Example:
#   ./.github/bin/test-template-smoke.sh --release-type release
#   ./.github/bin/test-template-smoke.sh --release-type snapshot --wait

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib-template-test.sh"

# =============================================================================
# Functions
# =============================================================================

cleanup() {
  echo ""
  echo "=== Cleanup ==="
  cleanup_test_project
  [ -n "$TEST_PROJECT_DIR_NPM" ] && [ -d "$TEST_PROJECT_DIR_NPM" ] && rm -rf "$TEST_PROJECT_DIR_NPM"
  echo "Done."
}

trap cleanup EXIT

wait_for_npm() {
  echo ""
  echo "=== Waiting for npm propagation ==="

  local package="@vertesia/create-plugin"
  for i in $(seq 1 5); do
    echo "Attempt $i/5: Checking ${package}@${PACKAGE_SPEC}..."
    VERSION=$(npm view "${package}@${PACKAGE_SPEC}" version 2>/dev/null || true)
    if [ -n "$VERSION" ]; then
      echo "Found ${package}@${PACKAGE_SPEC} = ${VERSION}"
      return 0
    fi
    if [ "$i" -eq 5 ]; then
      break
    fi
    DELAY=$((30 * i))
    echo "Not yet available. Waiting ${DELAY}s..."
    sleep $DELAY
  done

  echo "ERROR: Package not available after retries"
  exit 1
}

# =============================================================================
# Argument parsing
# =============================================================================

RELEASE_TYPE=""
TEMPLATE_NAME="Vertesia Plugin"
TEMPLATE_BRANCH=""
PACKAGE_VERSION=""
WAIT_FOR_NPM=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --release-type)
      RELEASE_TYPE="$2"
      shift 2
      ;;
    --template)
      TEMPLATE_NAME="$2"
      shift 2
      ;;
    --branch)
      TEMPLATE_BRANCH="$2"
      shift 2
      ;;
    --package-version)
      PACKAGE_VERSION="$2"
      shift 2
      ;;
    --wait)
      WAIT_FOR_NPM=true
      shift
      ;;
    *)
      echo "Error: Unknown argument '$1'"
      echo "Usage: $0 --release-type <snapshot|release> [--template <name>] [--branch <ref>] [--package-version <version>] [--wait]"
      exit 1
      ;;
  esac
done

validate_release_type
derive_tag_and_branch

# =============================================================================
# Main flow
# =============================================================================

print_config "Template Smoke Test"

if [ "$WAIT_FOR_NPM" = true ]; then
  wait_for_npm
fi

# Minimal scaffold (default) built with pnpm.
echo ""
echo "--- Mode: minimal (default scaffold, pnpm) ---"
bootstrap_template "smoke-test-plugin"
build_project

# Dev scaffold (module-selected examples and UI modules) built with npm.
# Covers both the alternate package manager and the dev module surface so the
# modules can't silently rot.
echo ""
echo "--- Mode: dev (--module dev scaffold, npm) ---"
TEST_PROJECT_DIR_NPM=""
EXTRA_CREATE_ARGS="${EXTRA_CREATE_ARGS:-} --module dev" bootstrap_template "smoke-test-plugin-npm" npm
TEST_PROJECT_DIR_NPM="$TEST_PROJECT_DIR"
build_project_npm

echo ""
echo "Template smoke test passed (minimal + dev)!"
