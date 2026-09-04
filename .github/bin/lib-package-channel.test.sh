#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib-package-channel.sh"
source "${SCRIPT_DIR}/lib-template-test.sh"

LLUMIVERSE_RESOLVER="${SCRIPT_DIR}/../../llumiverse/.github/bin/lib-package-channel.sh"
if [ -f "$LLUMIVERSE_RESOLVER" ] && ! cmp -s "${SCRIPT_DIR}/lib-package-channel.sh" "$LLUMIVERSE_RESOLVER"; then
  echo 'Composableai and llumiverse package channel policies have drifted' >&2
  exit 1
fi

assert_channel() {
  local expected="$1"
  shift
  local actual
  actual="$(resolve_package_channel "$@")"
  if [ "$actual" != "$expected" ]; then
    echo "Expected '$expected', got '$actual' for: $*" >&2
    exit 1
  fi
}

assert_channel latest release/1.5 release 0123456789abcdef0123456789abcdef01234567
assert_channel dev main snapshot 0123456789abcdef0123456789abcdef01234567
assert_channel dev-1.5 release/1.5 snapshot 0123456789abcdef0123456789abcdef01234567
assert_channel snapshot-0123456 1.4 snapshot 0123456789abcdef0123456789abcdef01234567
assert_channel snapshot-0123456 feat/appgen-packages snapshot 0123456789abcdef0123456789abcdef01234567
assert_channel snapshot-0123456 feat/short-sha snapshot 0123456

if resolve_package_channel feat/appgen-packages snapshot invalid >/dev/null 2>&1; then
  echo 'Expected an invalid feature-branch SHA to fail' >&2
  exit 1
fi

sha_error="$(resolve_package_channel feat/appgen-packages snapshot invalid 2>&1 || true)"
if [[ "$sha_error" != *"7-40 character git SHA"* ]]; then
  echo "Expected the SHA validation error to describe the accepted length, got: $sha_error" >&2
  exit 1
fi

if resolve_package_channel main invalid 0123456789abcdef0123456789abcdef01234567 >/dev/null 2>&1; then
  echo 'Expected an invalid release type to fail' >&2
  exit 1
fi

assert_template_mode() {
  local expected_tag="$1"
  local expected_spec="$2"
  local expected_args="$3"
  local ref="$4"
  local version="$5"

  RELEASE_TYPE=snapshot
  TEMPLATE_BRANCH="$ref"
  PACKAGE_VERSION="$version"
  GITHUB_SHA=0123456789abcdef0123456789abcdef01234567
  derive_tag_and_branch

  [ "$NPM_TAG" = "$expected_tag" ] || { echo "Expected tag '$expected_tag', got '$NPM_TAG'" >&2; exit 1; }
  [ "$PACKAGE_SPEC" = "$expected_spec" ] || {
    echo "Expected package spec '$expected_spec', got '$PACKAGE_SPEC'" >&2
    exit 1
  }
  [ "$CREATE_ARGS" = "$expected_args" ] || {
    echo "Expected create args '$expected_args', got '$CREATE_ARGS'" >&2
    exit 1
  }
}

assert_template_mode dev dev '' main ''
assert_template_mode dev-1.5 dev-1.5 '' release/1.5 ''
assert_template_mode snapshot-0123456 snapshot-0123456 '' feat/provider-test ''
assert_template_mode dev-1.5 1.5.0-dev.20260831.000000Z '--dev --dependency-mode pinned' release/1.5 1.5.0-dev.20260831.000000Z

echo 'Package channel tests passed'
