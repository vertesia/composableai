#!/bin/bash
set -euo pipefail

# Required environment variables
PR_NUMBER=${PR_NUMBER}
GITHUB_TOKEN=${GITHUB_TOKEN}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY}

# Extract PR details
pr_json=$(gh pr view "$PR_NUMBER" --json headRefName,baseRefName)
PR_BRANCH=$(jq -r '.headRefName' <<< "$pr_json")
BASE_REF=$(jq -r '.baseRefName' <<< "$pr_json")

git config --global user.email "github-actions[bot]@users.noreply.github.com"
git config --global user.name "github-actions[bot]"

if [[ -n "${GITHUB_TOKEN:-}" && -n "${GITHUB_REPOSITORY:-}" ]]; then
  git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
fi

# Fetch branches
git fetch origin "$BASE_REF:refs/remotes/origin/$BASE_REF"
git fetch origin "$PR_BRANCH:refs/remotes/origin/$PR_BRANCH"

# Checkout the PR branch
git checkout -B "$PR_BRANCH" "origin/$PR_BRANCH"

# Merge the base branch into the PR branch. pnpm-lock.yaml conflicts are
# deterministic: accept one side temporarily, then regenerate the lockfile.
if ! GIT_MERGE_AUTOEDIT=no git merge --no-edit "origin/$BASE_REF"; then
  mapfile -t conflicted_files < <(git diff --name-only --diff-filter=U)
  if [[ "${#conflicted_files[@]}" -ne 1 || "${conflicted_files[0]}" != "pnpm-lock.yaml" ]]; then
    echo "Merge conflict detected outside pnpm-lock.yaml; skipping lockfile repair." >&2
    printf 'Unresolved conflicts:\n' >&2
    printf '  %s\n' "${conflicted_files[@]}" >&2
    git merge --abort || true
    exit 2
  fi

  echo "Only pnpm-lock.yaml conflicted; regenerating it from merged manifests."
  git checkout --ours pnpm-lock.yaml
fi

# Use the package manager version declared by the checked-out PR branch.
PACKAGE_MANAGER=$(node -p "require('./package.json').packageManager || ''")
if [[ "$PACKAGE_MANAGER" != pnpm@* ]]; then
  echo "package.json must declare packageManager as pnpm@<version>" >&2
  exit 1
fi
corepack enable
corepack prepare "$PACKAGE_MANAGER" --activate
pnpm --version

# Run pnpm install to update the lockfile with the same pnpm version/config as CI.
pnpm install --lockfile-only

# Commit the merge and/or updated lockfile.
git add pnpm-lock.yaml
if [[ -f .git/MERGE_HEAD ]]; then
  git commit --no-edit
elif ! git diff --cached --quiet; then
  git commit -m "chore: update lockfile"
fi

ahead_count=$(git rev-list --count "origin/$PR_BRANCH"..HEAD)
if [[ "$ahead_count" == "0" ]]; then
  echo "No merge or lockfile changes to push."
  exit 0
fi

# Push the changes
git push origin "$PR_BRANCH"

echo "Updated lockfile pushed to branch $PR_BRANCH."
