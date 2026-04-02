#!/bin/bash
# Shared functions for template integration and smoke tests.
# Source this file from test scripts — do not execute directly.
#
# Expected variables (set by caller before calling functions):
#   RELEASE_TYPE   - "snapshot" or "release"
#   TEMPLATE_NAME  - Template name (default: "Vertesia Plugin")
#
# Variables set by this library:
#   NPM_TAG        - "dev" (snapshot) or "latest" (release)
#   TEMPLATE_REF   - "main" (snapshot) or "" (release — CLI resolves tag automatically)
#   TEST_PROJECT_DIR - Path to bootstrapped project (set by bootstrap_template)

# =============================================================================
# Release type helpers
# =============================================================================

validate_release_type() {
  if [ -z "$RELEASE_TYPE" ]; then
    echo "Error: Missing required argument: --release-type"
    echo "Usage: $0 --release-type <snapshot|release> [--template <name>]"
    exit 1
  fi

  if [[ ! "$RELEASE_TYPE" =~ ^(release|snapshot)$ ]]; then
    echo "Error: Invalid release type '$RELEASE_TYPE'. Must be 'release' or 'snapshot'."
    exit 1
  fi
}

derive_tag_and_branch() {
  if [ "$RELEASE_TYPE" = "snapshot" ]; then
    NPM_TAG="dev"
    TEMPLATE_REF="main"
  else
    NPM_TAG="latest"
    TEMPLATE_REF=""
  fi
}

# =============================================================================
# Template bootstrap & build
# =============================================================================

# Bootstrap a template project in /tmp.
# Args: $1 = project directory prefix (e.g. "smoke-test-plugin" or "integration-test-plugin")
# Optional caller-set variables:
#   EXTRA_CREATE_ARGS - additional arguments to pass to create-plugin (e.g. "--local-templates /path")
bootstrap_template() {
  local prefix="${1:-test-plugin}"
  local pkg_manager="${2:-}"

  echo ""
  echo "=== Bootstrapping template ==="
  echo "  Template: ${TEMPLATE_NAME}"
  echo "  Ref: ${TEMPLATE_REF:-<auto>}"
  echo "  Tag: ${NPM_TAG}"
  [ -n "$pkg_manager" ] && echo "  Package manager: ${pkg_manager}"

  # Create project in /tmp to avoid interference from composableai's pnpm-workspace.yaml
  TEST_PROJECT_DIR="/tmp/${prefix}-$$"
  local project_name
  project_name=$(basename "$TEST_PROJECT_DIR")

  # Build CLI args
  local branch_args=""
  if [ -n "$TEMPLATE_REF" ]; then
    branch_args="-b ${TEMPLATE_REF}"
  fi

  local pm_args=""
  [ -n "$pkg_manager" ] && pm_args="--package-manager ${pkg_manager}"

  # npm exec: closest to the documented `npm init @vertesia/plugin` user command
  # --: tells npm exec to stop parsing flags and pass everything to create-plugin
  # env -i: strip pnpm-injected env vars (NODE_PATH, npm_config_*) to prevent npm from resolving
  # packages from the studio's virtual store instead of installing fresh
  # npm_config_package_lock=false: work around npm 11 bug crashing in #buildLegacyLockfile
  # npm_config_cache: use a per-run temp dir so npm exec always fetches the latest from verdaccio
  #   instead of reusing a stale cached version of create-plugin that predates recent fixes
  local npm_cache_dir="/tmp/npm-cache-$$"
  (cd /tmp && env -i HOME="$HOME" PATH="$PATH" \
    npm_config_registry="${npm_config_registry:-}" \
    npm_config_package_lock="false" \
    npm_config_cache="${npm_cache_dir}" \
    npm exec --yes -- "@vertesia/create-plugin@${NPM_TAG}" "$project_name" -t "${TEMPLATE_NAME}" --yes ${branch_args} ${pm_args} ${EXTRA_CREATE_ARGS:-})
  rm -rf "${npm_cache_dir}"
}

build_project_npm() {
  echo ""
  echo "=== Building bootstrapped project (npm) ==="

  if [ ! -d "$TEST_PROJECT_DIR" ]; then
    echo "ERROR: Test project directory not found: ${TEST_PROJECT_DIR}"
    exit 1
  fi

  cd "$TEST_PROJECT_DIR"
  npm run build

  echo ""
  echo "=== Build succeeded (npm) ==="
  cd - > /dev/null
}

build_project() {
  echo ""
  echo "=== Building bootstrapped project ==="

  if [ ! -d "$TEST_PROJECT_DIR" ]; then
    echo "ERROR: Test project directory not found: ${TEST_PROJECT_DIR}"
    exit 1
  fi

  cd "$TEST_PROJECT_DIR"
  pnpm build

  echo ""
  echo "=== Build succeeded ==="
  cd - > /dev/null
}

# =============================================================================
# Cleanup
# =============================================================================

cleanup_test_project() {
  if [ -n "$TEST_PROJECT_DIR" ] && [ -d "$TEST_PROJECT_DIR" ]; then
    echo "Removing test project: ${TEST_PROJECT_DIR}"
    rm -rf "$TEST_PROJECT_DIR"
  fi
}

# =============================================================================
# Print helpers
# =============================================================================

print_config() {
  local title="$1"
  echo "$title"
  printf '=%.0s' $(seq 1 ${#title})
  echo ""
  echo "  Release type: ${RELEASE_TYPE}"
  echo "  NPM tag: ${NPM_TAG}"
  echo "  Template: ${TEMPLATE_NAME}"
  echo "  Template ref: ${TEMPLATE_REF:-<auto>}"
  echo ""
}
