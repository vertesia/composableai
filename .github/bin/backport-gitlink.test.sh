#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKPORT_SH="${BACKPORT_SH:-${ROOT}/.github/bin/backport.sh}"
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/backport-gitlink-test.XXXXXX")"
trap 'rm -rf "$TMP_ROOT"' EXIT

export MERGE_SHA="test-merge-sha"
export RUN_URL="https://example.invalid/backport-run"
NORMALIZE_OUTPUT=""
NORMALIZE_STATUS=0
TEST_DIR=""
SUB_A=""
SUB_B=""

comment_original() {
    :
}

load_backport_function() {
    local name="$1" body
    body="$(sed -n "/^${name}()/,/^}/p" "$BACKPORT_SH")"
    if [ -z "$body" ]; then
        echo "Could not load ${name} from ${BACKPORT_SH}" >&2
        exit 1
    fi
    eval "$body"
}

load_optional_backport_function() {
    local name="$1" body
    body="$(sed -n "/^${name}()/,/^}/p" "$BACKPORT_SH")"
    [ -z "$body" ] || eval "$body"
}

load_optional_backport_function gitlink_at
load_backport_function normalize_gitlinks_to_target

new_repo() {
    local name="$1" empty_tree
    TEST_DIR="${TMP_ROOT}/${name}"
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    git init -q
    git config user.email "backport-test@example.invalid"
    git config user.name "Backport Test"

    empty_tree="4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    SUB_A="$(git commit-tree "$empty_tree" -m "submodule-a")"
    SUB_B="$(git commit-tree "$empty_tree" -p "$SUB_A" -m "submodule-b")"
}

write_gitmodules() {
    cat >.gitmodules <<'EOF'
[submodule "composableai"]
	path = composableai
	url = https://example.invalid/composableai
EOF
}

add_gitlink() {
    git update-index --add --cacheinfo "160000,$1,composableai"
}

set_gitlink() {
    git update-index --cacheinfo "160000,$1,composableai"
}

tree_mode() {
    git ls-tree "$1" -- "$2" | awk '{print $1}'
}

tree_oid() {
    git ls-tree "$1" -- "$2" | awk '{print $3}'
}

create_target_with_submodule() {
    write_gitmodules
    printf 'base\n' >file.txt
    git add .gitmodules file.txt
    add_gitlink "$SUB_A"
    git commit -q -m "base"
    git branch target
    git update-ref refs/remotes/origin/target target
    git checkout -q -b source
}

create_target_without_submodule() {
    printf 'base\n' >file.txt
    git add file.txt
    git commit -q -m "base"
    git branch target
    git update-ref refs/remotes/origin/target target
    git checkout -q -b source
}

cherry_pick_source_onto_target() {
    local source_sha
    source_sha="$(git rev-parse HEAD)"
    git checkout -q -B work refs/remotes/origin/target
    git cherry-pick "$source_sha" >/dev/null
}

run_normalize_like_backport_one() {
    local output_file="${TEST_DIR}/normalize.out"
    # backport_one calls this helper as an if-condition, which is important:
    # bash suppresses errexit in that call path. Keep the same shape here.
    if normalize_gitlinks_to_target target >"$output_file" 2>&1; then
        NORMALIZE_STATUS=0
    else
        NORMALIZE_STATUS=$?
    fi
    NORMALIZE_OUTPUT="$(cat "$output_file")"
}

assert_eq() {
    local expected="$1" actual="$2" message="$3"
    if [ "$expected" != "$actual" ]; then
        printf '  %s\n  expected: %s\n  actual:   %s\n' "$message" "$expected" "$actual" >&2
        return 1
    fi
}

assert_diff_quiet() {
    local left="$1" right="$2" message="$3"
    if ! git diff --quiet "$left" "$right"; then
        printf '  %s\n' "$message" >&2
        git diff --name-status "$left" "$right" >&2
        return 1
    fi
}

assert_normalize_status() {
    local expected="$1" message="$2"
    if [ "$expected" != "$NORMALIZE_STATUS" ]; then
        printf '  %s\n  expected status: %s\n  actual status:   %s\n' \
            "$message" "$expected" "$NORMALIZE_STATUS" >&2
        if [ -n "$NORMALIZE_OUTPUT" ]; then
            printf '  normalizer output:\n%s\n' "$NORMALIZE_OUTPUT" >&2
        fi
        return 1
    fi
}

test_clean_gitlink_bump_resets_to_target() {
    new_repo "clean-bump"
    create_target_with_submodule
    printf 'source\n' >file.txt
    git add file.txt
    set_gitlink "$SUB_B"
    git commit -q -m "source file plus submodule bump"

    cherry_pick_source_onto_target
    run_normalize_like_backport_one

    assert_normalize_status "0" "normalizer should succeed"
    assert_eq "$SUB_A" "$(tree_oid HEAD composableai)" "gitlink should be reset to target pointer"
    assert_eq "source" "$(cat file.txt)" "real file change should remain"
    assert_eq $'M\tfile.txt' "$(git diff --name-status refs/remotes/origin/target HEAD)" \
        "only the real file should differ from target"
}

test_submodule_only_bump_becomes_noop() {
    new_repo "submodule-only"
    create_target_with_submodule
    set_gitlink "$SUB_B"
    git commit -q -m "submodule only bump"

    cherry_pick_source_onto_target
    run_normalize_like_backport_one

    assert_normalize_status "0" "normalizer should succeed"
    assert_eq "$SUB_A" "$(tree_oid HEAD composableai)" "gitlink should be reset to target pointer"
    assert_diff_quiet refs/remotes/origin/target HEAD "submodule-only backport should normalize to no diff"
}

test_submodule_add_fails_closed() {
    new_repo "submodule-add"
    create_target_without_submodule
    write_gitmodules
    git add .gitmodules
    add_gitlink "$SUB_B"
    git commit -q -m "add submodule"

    cherry_pick_source_onto_target
    run_normalize_like_backport_one

    assert_normalize_status "1" "normalizer should fail closed on submodule add"
}

test_submodule_remove_fails_closed() {
    new_repo "submodule-remove"
    create_target_with_submodule
    git rm -q .gitmodules composableai
    git commit -q -m "remove submodule"

    cherry_pick_source_onto_target
    run_normalize_like_backport_one

    assert_normalize_status "1" "normalizer should fail closed on submodule removal"
}

test_submodule_replaced_by_directory_fails_closed() {
    new_repo "submodule-replaced-by-directory"
    create_target_with_submodule
    git rm -q --cached composableai
    mkdir composableai
    printf 'replacement\n' >composableai/file.txt
    git add composableai/file.txt
    git commit -q -m "replace submodule with directory"

    cherry_pick_source_onto_target
    run_normalize_like_backport_one

    assert_normalize_status "1" "normalizer should fail closed when a submodule becomes a directory"
    assert_eq "160000" "$(tree_mode refs/remotes/origin/target composableai)" \
        "target fixture should still be a gitlink"
}

run_test() {
    local name="$1" status
    shift
    set +e
    ( set -euo pipefail; "$@" )
    status=$?
    set -e
    if [ "$status" -eq 0 ]; then
        echo "ok - ${name}"
    else
        echo "not ok - ${name}"
        failures=$((failures + 1))
    fi
}

failures=0
run_test "clean gitlink bump resets to target" test_clean_gitlink_bump_resets_to_target
run_test "submodule-only bump becomes no-op" test_submodule_only_bump_becomes_noop
run_test "submodule add fails closed" test_submodule_add_fails_closed
run_test "submodule removal fails closed" test_submodule_remove_fails_closed
run_test "submodule replaced by directory fails closed" test_submodule_replaced_by_directory_fails_closed

if [ "$failures" -ne 0 ]; then
    echo "${failures} backport gitlink test(s) failed." >&2
    exit 1
fi

echo "All backport gitlink tests passed."
