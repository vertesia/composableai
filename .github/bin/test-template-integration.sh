#!/bin/bash
set -e

# Script to test template integration using a local verdaccio registry
# Publishes all built packages to verdaccio, bootstraps a template, and builds it.
#
# Usage: test-template-integration.sh --release-type <snapshot|release> [--template <name>]
#   --release-type: Determines npm tag (dev for snapshot, latest for release) and template branch (main/preview)
#   --template: Template name to test (default: "Vertesia Plugin")
#
# Prerequisites:
#   - All packages must be built (run `pnpm build` first)
#   - Node.js and pnpm must be installed
#
# Example:
#   pnpm build
#   ./.github/bin/test-template-integration.sh --release-type snapshot

# =============================================================================
# Configuration
# =============================================================================

VERDACCIO_PORT=4873
VERDACCIO_URL="http://localhost:${VERDACCIO_PORT}"
VERDACCIO_DIR="/tmp/verdaccio-$$"
VERDACCIO_PID=""
TEST_PROJECT_DIR=""

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

  # Remove test project
  if [ -n "$TEST_PROJECT_DIR" ] && [ -d "$TEST_PROJECT_DIR" ]; then
    echo "Removing test project: ${TEST_PROJECT_DIR}"
    rm -rf "$TEST_PROJECT_DIR"
  fi

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
    proxy: npmjs
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
      pnpm publish --access public --tag "${NPM_TAG}" --no-git-checks --registry "${VERDACCIO_URL}" 2>&1 | sed 's/^/    /'
      count=$((count + 1))
      cd ../..
    fi
  done

  echo "Published ${count} packages to verdaccio"
}

bootstrap_template() {
  echo ""
  echo "=== Bootstrapping template ==="
  echo "  Template: ${TEMPLATE_NAME}"
  echo "  Branch: ${TEMPLATE_BRANCH}"
  echo "  Tag: ${NPM_TAG}"

  # Create project in /tmp to avoid interference from composableai's pnpm-workspace.yaml
  TEST_PROJECT_DIR="/tmp/integration-test-plugin-$$"
  local project_name
  project_name=$(basename "$TEST_PROJECT_DIR")

  # Use verdaccio for all npm operations
  export npm_config_registry="${VERDACCIO_URL}"

  # npx --yes: auto-install without prompting
  # --yes after pkg: passed to create-plugin for non-interactive mode (long form avoids npx consuming it)
  # Run from /tmp so the project is created outside the workspace
  (cd /tmp && npx --yes "@vertesia/create-plugin@${NPM_TAG}" "$project_name" -t "${TEMPLATE_NAME}" --yes -b "${TEMPLATE_BRANCH}")
}

build_project() {
  echo ""
  echo "=== Building bootstrapped project ==="

  if [ ! -d "$TEST_PROJECT_DIR" ]; then
    echo "ERROR: Test project directory not found: ${TEST_PROJECT_DIR}"
    exit 1
  fi

  cd "$TEST_PROJECT_DIR"

  # Ensure pnpm uses verdaccio for @vertesia/* resolution
  export npm_config_registry="${VERDACCIO_URL}"

  pnpm build

  echo ""
  echo "=== Build succeeded ==="
  cd ..
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

if [ -z "$RELEASE_TYPE" ]; then
  echo "Error: Missing required argument: --release-type"
  echo "Usage: $0 --release-type <snapshot|release> [--template <name>]"
  exit 1
fi

if [[ ! "$RELEASE_TYPE" =~ ^(release|snapshot)$ ]]; then
  echo "Error: Invalid release type '$RELEASE_TYPE'. Must be 'release' or 'snapshot'."
  exit 1
fi

# Derive npm tag and template branch from release type
if [ "$RELEASE_TYPE" = "snapshot" ]; then
  NPM_TAG="dev"
  TEMPLATE_BRANCH="main"
else
  NPM_TAG="latest"
  TEMPLATE_BRANCH="preview"
fi

# =============================================================================
# Main flow
# =============================================================================

echo "Template Integration Test"
echo "========================="
echo "  Release type: ${RELEASE_TYPE}"
echo "  NPM tag: ${NPM_TAG}"
echo "  Template: ${TEMPLATE_NAME}"
echo "  Template branch: ${TEMPLATE_BRANCH}"
echo ""

start_verdaccio
publish_to_verdaccio
bootstrap_template
build_project

echo ""
echo "✅ Template integration test passed!"
