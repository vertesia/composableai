#!/bin/bash
set -eo pipefail

# Script to test template integration using a local verdaccio registry.
# Publishes all built packages to verdaccio, bootstraps a template, and builds it.
#
# Usage: test-template-integration.sh --release-type <snapshot|release> [--template <name>]
#   --release-type: Determines npm tag (dev for snapshot, latest for release) and template ref
#   --template: Template name to test (default: "Vertesia Plugin")
#
# Prerequisites:
#   - All packages must be built (run `pnpm build` first)
#   - Node.js and pnpm must be installed
#
# Example:
#   pnpm build
#   ./.github/bin/test-template-integration.sh --release-type snapshot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib-template-test.sh"

# =============================================================================
# Configuration
# =============================================================================

VERDACCIO_PORT=4873
VERDACCIO_URL="http://localhost:${VERDACCIO_PORT}"
VERDACCIO_DIR="/tmp/verdaccio-$$"
VERDACCIO_PID=""

# =============================================================================
# Functions
# =============================================================================

cleanup() {
  echo ""
  echo "=== Cleanup ==="

  # Stop verdaccio
  if [ -n "$VERDACCIO_PID" ]; then
    echo "Stopping verdaccio (pid: ${VERDACCIO_PID})..."
    kill "$VERDACCIO_PID" 2>/dev/null || true
    wait "$VERDACCIO_PID" 2>/dev/null || true
  fi

  cleanup_test_project

  # Remove verdaccio data
  if [ -d "$VERDACCIO_DIR" ]; then
    echo "Removing verdaccio data: ${VERDACCIO_DIR}"
    rm -rf "$VERDACCIO_DIR"
  fi

  echo "Done."
}

# Always clean up on exit
trap cleanup EXIT

start_verdaccio() {
  echo "=== Starting verdaccio local registry ==="

  # Check if verdaccio is installed
  if ! command -v verdaccio &> /dev/null; then
    echo "Installing verdaccio..."
    npm install -g verdaccio
  fi

  # Create verdaccio config
  mkdir -p "${VERDACCIO_DIR}/storage"
  cat > "${VERDACCIO_DIR}/config.yaml" << 'VCONFIG'
storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 100
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
packages:
  '@vertesia/*':
    access: $all
    publish: $all
  '@llumiverse/*':
    access: $all
    publish: $all
    proxy: npmjs
  '@dglabs/*':
    access: $all
    publish: $all
    proxy: npmjs
  '**':
    access: $all
    proxy: npmjs
max_body_size: 20mb
server:
  keepAliveTimeout: 180
listen: 0.0.0.0:4873
log:
  type: stdout
  format: pretty
  level: warn
VCONFIG

  # Start verdaccio in background
  verdaccio --config "${VERDACCIO_DIR}/config.yaml" &
  VERDACCIO_PID=$!

  # Wait for verdaccio to be ready
  echo "Waiting for verdaccio to start..."
  for i in $(seq 1 30); do
    if curl -s "${VERDACCIO_URL}/-/ping" > /dev/null 2>&1; then
      echo "Verdaccio is ready at ${VERDACCIO_URL}"
      return 0
    fi
    sleep 1
  done

  echo "ERROR: Verdaccio failed to start within 30 seconds"
  exit 1
}

publish_to_verdaccio() {
  echo ""
  echo "=== Publishing packages to verdaccio (tag: ${NPM_TAG}) ==="

  # Set auth token for verdaccio
  npm set "//${VERDACCIO_URL#http://}/:_authToken" "test-token"

  local count=0
  for pkg_dir in packages/*; do
    if [ -d "$pkg_dir" ] && [ -f "$pkg_dir/package.json" ]; then
      pkg_name=$(basename "$pkg_dir")
      cd "$pkg_dir"
      pkg_version=$(pnpm pkg get version | tr -d '"')
      echo "  Publishing @vertesia/${pkg_name}@${pkg_version}..."
      pnpm publish --access public --tag "${NPM_TAG}" --no-git-checks --registry "${VERDACCIO_URL}" > /dev/null 2>&1
      count=$((count + 1))
      cd ../..
    fi
  done

  echo "Published ${count} packages to verdaccio"
}

# =============================================================================
# Argument parsing
# =============================================================================

RELEASE_TYPE=""
TEMPLATE_NAME="Vertesia Plugin"

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
    *)
      echo "Error: Unknown argument '$1'"
      echo "Usage: $0 --release-type <snapshot|release> [--template <name>]"
      exit 1
      ;;
  esac
done

validate_release_type
derive_tag_and_branch

# =============================================================================
# Main flow
# =============================================================================

print_config "Template Integration Test"

start_verdaccio
publish_to_verdaccio

# Point npm/npx to verdaccio for bootstrap and build
export npm_config_registry="${VERDACCIO_URL}"

# Use local templates so integration tests don't need a git tag on GitHub
TEMPLATES_PATH="$(cd "${SCRIPT_DIR}/../.." && pwd)/templates"
EXTRA_CREATE_ARGS="--local-templates ${TEMPLATES_PATH}"

bootstrap_template "integration-test-plugin"

echo ""
echo "=== Bootstrapped package.json ==="
cat "${TEST_PROJECT_DIR}/package.json"

build_project

echo ""
echo "✅ Template integration test passed!"
