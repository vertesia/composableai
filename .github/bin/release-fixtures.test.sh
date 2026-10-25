#!/usr/bin/env bash
# Reproduce the release job environment, including future context and unrelated Git settings.
set -euo pipefail
# Every fixture starts with an explicit environment allowlist, including local invocations.
if [[ "${1:-}" != "--isolated-fixture" ]]; then
  exec env -i PATH="$PATH" HOME="$HOME" bash "${BASH_SOURCE[0]}" --isolated-fixture "$@"
fi
shift
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for fixture in lib-release-cohort.test.sh prepare-release-source.test.sh lib-package-channel.test.sh; do
  env LLUMIVERSE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa VERSION_OVERRIDE=invalid \
    RELEASE_IDENTITY=invalid RELEASE_SOURCE_SHA=invalid RELEASE_TYPE=release \
    RELEASE_FUTURE_CONTEXT=unexpected COORDINATED_RELEASE=true GITHUB_REF_NAME=invalid \
    GIT_DIR=/nonexistent/release-fixture GIT_WORK_TREE=/nonexistent/release-fixture \
    bash "$script_dir/$fixture"
done
echo 'Release fixtures passed with inherited release and Git environment variables'
