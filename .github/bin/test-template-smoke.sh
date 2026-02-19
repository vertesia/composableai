#!/bin/bash
set -e

# Script to smoke-test published packages by bootstrapping a template and building it.
# Tests against the real npm registry (no verdaccio).
#
# Usage: test-template-smoke.sh --release-type <snapshot|release> [--template <name>] [--wait]
#   --release-type: Determines npm tag (dev for snapshot, latest for release) and template branch
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
  echo "Done."
}

trap cleanup EXIT

wait_for_npm() {
  echo ""
  echo "=== Waiting for npm propagation ==="

  local package="@vertesia/create-plugin"
  for i in $(seq 1 5); do
    echo "Attempt $i/5: Checking ${package}@${NPM_TAG}..."
    VERSION=$(npm view "${package}@${NPM_TAG}" version 2>/dev/null || true)
    if [ -n "$VERSION" ]; then
      echo "Found ${package}@${NPM_TAG} = ${VERSION}"
      return 0
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
    --wait)
      WAIT_FOR_NPM=true
      shift
      ;;
    *)
      echo "Error: Unknown argument '$1'"
      echo "Usage: $0 --release-type <snapshot|release> [--template <name>] [--wait]"
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

bootstrap_template "smoke-test-plugin"
build_project

echo ""
echo "✅ Template smoke test passed!"
