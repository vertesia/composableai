#!/bin/bash
#
# This script is used to sync code from one branch to another, mainly from preview to main.
#
# option `-x` is used to enable debugging, which will print each command before executing it.
set -x

# Prerequisites
# -----
source_composableai_ref="${SOURCE_COMPOSABLEAI_REF:?Environment variable SOURCE_COMPOSABLEAI_REF is not set}"
source_composableai_sha="${SOURCE_COMPOSABLEAI_SHA:?Environment variable SOURCE_COMPOSABLEAI_SHA is not set}"

target_composableai_ref="${TARGET_COMPOSABLEAI_REF:?Environment variable TARGET_COMPOSABLEAI_REF is not set}"
target_llumiverse_ref="${TARGET_LLUMIVERSE_REF:?Environment variable TARGET_LLUMIVERSE_REF is not set}"
target_llumiverse_sha="${TARGET_LLUMIVERSE_SHA:?Environment variable TARGET_LLUMIVERSE_SHA is not set}"

merge_message="Auto-merge branch '${source_composableai_ref}' (${source_composableai_sha::7})

Generated-by: https://github.com/vertesia/composableai/actions/runs/${GITHUB_RUN_ID:-0}"

git config --global user.email "github-actions[bot]@users.noreply.github.com"
git config --global user.name "github-actions[bot]"


# Checkout new branch
# -----
temp_branch="${TEMP_BRANCH:?Environment variable TEMP_BRANCH is not set}"
echo "[INFO] Creating a temporary branch \"${temp_branch}\" to sync code from \"${source_composableai_ref}\" to \"${target_composableai_ref}\"" >&2
git branch "$temp_branch" "$source_composableai_sha"
git checkout "$temp_branch"


# Sync code
# -----
# option `--no-ff` is used to ensure that the merge is recorded as a merge commit
git merge "origin/${target_composableai_ref}" --no-ff -m "$merge_message"
is_merged=$?


# Reset submodules
# -----
if [ $is_merged -ne 0 ]; then
    if git diff --name-only | grep -q 'llumiverse'; then
        echo "[INFO] Resolving conflicts in submodule 'llumiverse'" >&2
        cd llumiverse || exit 1
        git fetch origin "${target_llumiverse_ref}"
        git checkout "${target_llumiverse_sha}"
        cd .. || exit 1
    else
        echo "[INFO] No conflicts in submodule 'llumiverse'" >&2
    fi

    if git diff --quiet && ! git ls-files -u | grep .; then
        echo "[INFO] Successfully resolved conflicts and staged changes" >&2
        # note: we don't use `git merge --continue` because it requires an editor which is not
        # available in the GitHub Actions environment.
        git commit -m "$merge_message"
    else
        echo "[ERROR] Failed to continue the merge due to other conflicts. Please resolve conflicts manually and commit the changes." >&2
        git diff --name-only --diff-filter=U >&2
        # TODO send a pull request to the target branch
        exit 1
    fi
else
    echo "[INFO] Successfully merged code from \"${source_composableai_ref}\" to \"${target_composableai_ref}\"" >&2
fi

current_llumiverse_sha=$(git ls-tree --format='%(objectname)' HEAD llumiverse)

# note: this can happen if the submodule is only updated in the source branch (preview), and the merge is
# fast-forwarded. In this case, there is no conflict, but we still need to reset the submodule manually.
if [ "$current_llumiverse_sha" != "$target_llumiverse_sha" ]; then
    echo "[INFO] Resetting submodule to the version on the target branch..." >&2
    git update-index --cacheinfo 160000 "$target_llumiverse_sha" llumiverse
    git commit --amend --no-edit
fi


# Validate changes
# -----
current_llumiverse_sha=$(git ls-tree --format='%(objectname)' HEAD llumiverse)

if [ "$current_llumiverse_sha" != "$target_llumiverse_sha" ]; then
    echo "[ERROR] Submodule 'llumiverse' is not at the expected SHA: ${target_llumiverse_sha} (got ${current_llumiverse_sha})" >&2
    exit 1
fi
echo "[INFO] All submodules are at the expected SHAs" >&2


# Push changes
# -----
echo "[INFO] Pushing changes to remote branch \"${temp_branch}\"" >&2
if ! git push origin "${temp_branch}"; then
    echo "[ERROR] Failed to push changes to remote branch ${temp_branch}" >&2
    exit 1
fi