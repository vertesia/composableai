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
#   TEMPLATE_BRANCH - "main" (snapshot) or "preview" (release)
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
    TEMPLATE_BRANCH="main"
  else
    NPM_TAG="latest"
    TEMPLATE_BRANCH="preview"
  fi
}

# =============================================================================
# Template bootstrap & build
# =============================================================================

# Bootstrap a template project in /tmp.
# Args: $1 = project directory prefix (e.g. "smoke-test-plugin" or "integration-test-plugin")
bootstrap_template() {
  local prefix="${1:-test-plugin}"

  echo ""
  echo "=== Bootstrapping template ==="
  echo "  Template: ${TEMPLATE_NAME}"
  echo "  Branch: ${TEMPLATE_BRANCH}"
  echo "  Tag: ${NPM_TAG}"

  # Create project in /tmp to avoid interference from composableai's pnpm-workspace.yaml
  TEST_PROJECT_DIR="/tmp/${prefix}-$$"
  local project_name
  project_name=$(basename "$TEST_PROJECT_DIR")

  # npx --yes: auto-install without prompting
  # --yes after pkg: passed to create-plugin for non-interactive mode (long form avoids npx consuming it)
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
  echo "  Template branch: ${TEMPLATE_BRANCH}"
  echo ""
}
