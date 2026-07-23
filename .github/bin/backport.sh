#!/usr/bin/env bash
#
# Backport (cherry-pick) a merged PR onto one or more target branches and open a
# PR per target. Driven by `backport/<target>` labels on the merged PR.
#
# Typical flow: a maintenance fix merged into `release/X.Y` is forward-ported to
# `main` (label `backport/main`). Also supports `main -> release/X.Y` and
# `release/X.Y -> release/X.Z`.
#
#   Clean cherry-pick     -> a ready-to-merge PR into <target>.
#   Gitlink-only conflict -> the submodule pointer is pinned to the target's OWN
#                            commit (ours), never the source's, and a normal
#                            (auto-merging) PR is opened.
#   Real file conflict    -> conflict markers are committed and a DRAFT PR is opened,
#                            with resolution steps posted back on the original PR.
#
# Required env:
#   GH_TOKEN         App token with contents:write + pull-requests:write on REPO
#   REPO             owner/name (github.repository)
#   PR_NUMBER        merged PR number
#   PR_TITLE         merged PR title
#   PR_AUTHOR        merged PR author login
#   PR_URL           merged PR html_url
#   PR_HEAD_REF      merged PR head branch (never a backport target)
#   PR_LABELS_JSON   JSON array of {name} label objects from the event payload
#   MERGE_SHA        merge_commit_sha of the merged PR
#
# Optional env (provided by GitHub Actions): GITHUB_SERVER_URL, GITHUB_RUN_ID
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN required}"
: "${REPO:?REPO required}"
: "${PR_NUMBER:?PR_NUMBER required}"
: "${MERGE_SHA:?MERGE_SHA required}"
PR_TITLE="${PR_TITLE:-}"
PR_AUTHOR="${PR_AUTHOR:-}"
PR_URL="${PR_URL:-}"
PR_HEAD_REF="${PR_HEAD_REF:-}"
PR_LABELS_JSON="${PR_LABELS_JSON:-[]}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${REPO}/actions/runs/${GITHUB_RUN_ID:-}"
export GH_TOKEN

# --- helpers --------------------------------------------------------------

# Append a line to the GitHub Actions job summary (no-op when run locally).
summary() {
    [ -n "${GITHUB_STEP_SUMMARY:-}" ] && printf '%s\n' "$1" >>"$GITHUB_STEP_SUMMARY"
    return 0
}

# One result row in the summary table. `target` is read from the caller's scope
# (dynamic scoping), so every outcome below is recorded with no extra wiring.
summary_row() {
    summary "| \`${target:-?}\` | $1 |"
}

comment_original() {
    gh pr comment "$PR_NUMBER" --repo "$REPO" --body "$1" >/dev/null 2>&1 \
        || echo "::warning::Could not comment on PR #${PR_NUMBER}."
    # Mirror the same one-liner into the job summary so results aren't log-only.
    summary_row "$1"
}

clean_body() {
    local target="$1"
    cat <<EOF
Backport of #${PR_NUMBER} to \`${target}\`.

- Original PR: ${PR_URL}
- Author: @${PR_AUTHOR}
- Source commit: \`${MERGE_SHA}\`

Clean cherry-pick — no conflicts. This PR auto-merges once all checks pass
(see .github/workflows/backport-automerge.yaml); no action needed.
EOF
}

conflict_body() {
    local target="$1" branch="$2"
    cat <<EOF
Backport of #${PR_NUMBER} to \`${target}\`. :warning: **The cherry-pick had conflicts**, so this is a **draft** for you to validate.

- Original PR: ${PR_URL}
- Author: @${PR_AUTHOR}
- Source commit: \`${MERGE_SHA}\`

What was committed so the branch exists for you to fix:
- **Regular-file conflicts** kept their \`<<<<<<<\` markers — resolve them.
- **Submodule (gitlink) conflicts** were pinned to this branch's own \`${target}\`
  pointer (ours); the source branch's submodule commit is intentionally discarded
  so it can't leak in. If this backport actually needs a newer submodule commit,
  backport that submodule change on its own line first.
- **Structural conflicts** (renames/deletes) were auto-resolved to the incoming
  side — review the full diff, not just the markers.

### Resolve, then open it
\`\`\`sh
git fetch origin ${branch}
git switch ${branch}
# resolve any <<<<<<< / ======= / >>>>>>> markers, then:
git add -A
git commit --amend --no-edit
git push --force-with-lease
git submodule update --init --recursive   # if a gitlink changed
\`\`\`
When the diff is right, click **Ready for review** (or \`gh pr ready <this PR>\`)
to open it — checks run and it merges from there like any other PR.
EOF
}

# --- parse backport/<target> labels ---------------------------------------

mapfile -t targets < <(
    jq -r '.[].name | select(startswith("backport/")) | sub("^backport/"; "")' <<<"$PR_LABELS_JSON" \
        | sort -u
)
if [ "${#targets[@]}" -eq 0 ]; then
    echo "No backport/<target> labels on PR #${PR_NUMBER}; nothing to do."
    exit 0
fi
echo "Backport targets for PR #${PR_NUMBER}: ${targets[*]}"

# --- git identity + authenticated remote ----------------------------------

git config user.email "github-actions[bot]@users.noreply.github.com"
git config user.name "github-actions[bot]"
git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"

# Make sure the merged commit object is present locally (GitHub serves it by SHA).
if ! git fetch --no-tags --quiet origin "$MERGE_SHA"; then
    echo "::error::Could not fetch merge commit ${MERGE_SHA}." >&2
    exit 1
fi

# A merge commit (>= 2 parents) needs `--mainline 1`; squash/rebase merges don't.
# `rev-list --parents` prints "<commit> <parent>...", so parents = fields - 1.
# awk (not `wc -w`) avoids BSD/macOS leading-whitespace padding in the integer test.
parent_count="$(git rev-list --parents -n 1 "$MERGE_SHA" | awk '{print NF - 1}')"
cp_mainline=()
if [ "$parent_count" -ge 2 ]; then
    cp_mainline=(--mainline 1)
fi

# --- shared PR finalization -----------------------------------------------

# Echoes 1 if the pushed branch contains cherry-pick conflict markers, else 0.
# Defaults to 1 (open as draft) when the branch can't be inspected, so an
# unverified backport is never presented as ready-to-merge.
# Decide whether a recovered (already-pushed, no-PR) branch must open as a DRAFT.
# A conflicted backport carries a `Backport-Conflicted` trailer (gitlink conflicts
# resolve markerlessly, so markers alone are unreliable); literal markers also
# count. Default to draft if the branch can't be inspected — never recover a
# conflicted backport as a mergeable PR.
recovery_is_conflicted() {
    local branch="$1"
    if ! git fetch --no-tags --quiet origin "$branch"; then
        echo 1
        return 0
    fi
    if git log -1 --format=%B FETCH_HEAD 2>/dev/null | grep -qiE '^Backport-Conflicted:[[:space:]]*true' \
        || git grep -qI -e '^<<<<<<< ' FETCH_HEAD -- . 2>/dev/null; then
        echo 1
    else
        echo 0
    fi
}

# Opens the backport PR for an already-pushed branch, assigns the author, adds the
# marker label, and reports back on the original PR. Draft iff conflicted. A failing
# `gh pr create` aborts (set -e) so a partial run fails loudly; the next run then
# recovers through the existing-branch path.
finalize_pr() {
    local target="$1" branch="$2" conflicted="$3"
    local title body
    local draft=()
    title="[Backport ${target}] ${PR_TITLE}"
    if [ "$conflicted" -eq 1 ]; then
        body="$(conflict_body "$target" "$branch")"
        draft=(--draft)
    else
        body="$(clean_body "$target")"
    fi

    # set -e is suspended in this call path (backport_one runs as an if-condition),
    # so check PR creation explicitly rather than trusting it to abort on failure.
    local pr_url
    if ! pr_url="$(gh pr create --repo "$REPO" --base "$target" --head "$branch" \
        --title "$title" --body "$body" "${draft[@]}")" || [ -z "$pr_url" ]; then
        echo "::error::Failed to create backport PR for ${branch} -> ${target}." >&2
        comment_original ":x: Backport to \`${target}\`: branch pushed but PR creation failed. Re-run the job to recover. See ${RUN_URL}"
        return 1
    fi
    echo "Opened ${pr_url}"

    if [ -n "$PR_AUTHOR" ]; then
        gh pr edit "$pr_url" --add-assignee "$PR_AUTHOR" >/dev/null 2>&1 \
            || echo "::warning::Could not assign @${PR_AUTHOR} on ${pr_url}."
    fi
    gh pr edit "$pr_url" --add-label "backport" >/dev/null 2>&1 \
        || echo "::warning::Could not add 'backport' label to ${pr_url} (create it in ${REPO})."

    if [ "$conflicted" -eq 1 ]; then
        comment_original ":warning: Opened a **draft** backport to \`${target}\` with conflicts to resolve: ${pr_url}"
    else
        comment_original ":white_check_mark: Opened a backport to \`${target}\`: ${pr_url}"
    fi
    return 0
}

# Resolve unmerged submodule gitlinks (mode 160000) by pinning each to OURS — the
# pointer already recorded on the backport target branch. This is the guarantee
# that a source-branch submodule commit can NEVER leak onto the backport branch:
# main and release/X.Y legitimately track different composableai/llumiverse
# commits, so a forward-port must not downgrade the target's pointer and a
# back-port must not pull an unreleased one. The submodule isn't checked out, so
# this is done at the index level (an unchecked-out submodule can't be `git add`ed);
# stage 2 of the unmerged entry is "ours" (== HEAD:<gl>, since HEAD is still the
# target tip mid-cherry-pick). If this backport genuinely needs a newer submodule
# commit, that submodule change must be backported on its own line first.
#
# A gitlink with no "ours" pointer (a structural add/delete on the submodule path)
# is left unmerged on purpose — the caller treats it as a manual conflict rather
# than ever taking the source (theirs) pointer.
resolve_gitlink_conflicts() {
    local target="$1" gl ours
    while IFS= read -r gl; do
        [ -n "$gl" ] || continue
        ours="$(git ls-files --unmerged -- "$gl" | awk '$3=="2"{print $2; exit}')"
        [ -n "$ours" ] || ours="$(git rev-parse --verify --quiet "HEAD:${gl}" 2>/dev/null || true)"
        if [ -z "$ours" ]; then
            echo "::warning::Gitlink '${gl}' has no 'ours' pointer on ${target} (structural submodule conflict); leaving it unmerged."
            continue
        fi
        git update-index --cacheinfo "160000,${ours},${gl}"
        echo "Pinned gitlink '${gl}' to the ${target} pointer ${ours:0:12} (ours; source pointer discarded)."
    done < <(git ls-files --unmerged | awk '$1=="160000"{print $4}' | sort -u)
}

# Echo the commit recorded at <path> in <ref> IFF that path is a submodule there
# (tree mode 160000); empty otherwise — a blob, a plain directory (tree), or absent.
# Deliberately mode-aware, NOT `rev-parse <ref>:<path>`: rev-parse returns a SHA for
# a directory or file too, which would hide a submodule replaced by a plain
# directory (the gitlink is gone, but rev-parse still yields the directory's tree
# SHA and the caller would think the submodule is still present).
gitlink_at() {
    git ls-tree "$1" -- "$2" 2>/dev/null | awk '$1=="160000"{print $3; exit}'
}

# Enforce the submodule invariant across the WHOLE tree, on EVERY cherry-pick path:
# the backport's submodule set (which submodules exist, and the commit each points
# at) MUST end up identical to the target branch's. A submodule change rides its own
# line, never a file backport. This is needed because a gitlink can move with NO
# conflict — when the target pointer equals the source commit's parent pointer, git
# applies the source bump cleanly and `resolve_gitlink_conflicts` never sees it.
#
#   * repointed (a 160000 gitlink on BOTH sides, different sha) -> reset to ours.
#   * added / removed / replaced (a 160000 gitlink on only ONE side — the other is
#     absent, a file, or a plain directory) -> fail closed; a structural submodule
#     change must be cherry-picked by hand, never auto-merged.
#
# Enumerates gitlinks from the tree of BOTH origin/<target> and HEAD (their union),
# not from .gitmodules — a deletion/replacement drops the .gitmodules stanza too, so
# a .gitmodules-only walk would miss it. Presence is decided mode-aware via
# gitlink_at (see above). Amends HEAD when it resets a pointer (--allow-empty: a
# source commit that only bumped a submodule normalizes to a no-op, then dropped by
# the "no net change" check below). Every mutating git call is checked explicitly:
# this runs under `if ! normalize_gitlinks_to_target`, which disables errexit inside
# the whole function body, so a silent failure would otherwise slip through.
normalize_gitlinks_to_target() {
    local target="$1" gl ours cur corrected=0
    while IFS= read -r gl; do
        [ -n "$gl" ] || continue
        cur="$(gitlink_at HEAD "$gl")"
        ours="$(gitlink_at "origin/${target}" "$gl")"
        [ "$cur" != "$ours" ] || continue               # same submodule pointer (or neither a gitlink here): fine
        if [ -z "$ours" ] || [ -z "$cur" ]; then
            # One side is not a 160000 gitlink at this path: the backport adds,
            # removes, or REPLACES the submodule (e.g. with a plain directory).
            # Never let a structural submodule change ride an auto-merge — hand off.
            echo "::error::Backport to ${target} adds, removes, or replaces submodule '${gl}' (not a 160000 gitlink on both sides); refusing to auto-resolve a structural submodule change." >&2
            comment_original ":x: Backport to \`${target}\` would add, remove, or replace submodule \`${gl}\`. Cherry-pick \`${MERGE_SHA}\` by hand. See ${RUN_URL}"
            return 1
        fi
        if ! git update-index --cacheinfo "160000,${ours},${gl}"; then
            echo "::error::Could not reset submodule '${gl}' to the ${target} pointer ${ours:0:12}." >&2
            comment_original ":x: Backport to \`${target}\` could not reset submodule \`${gl}\` to the \`${target}\` pointer. Cherry-pick \`${MERGE_SHA}\` by hand. See ${RUN_URL}"
            return 1
        fi
        corrected=1
        echo "Reset gitlink '${gl}' to the ${target} pointer ${ours:0:12} (ours; source pointer discarded)."
    done < <( { git ls-tree -r "origin/${target}"; git ls-tree -r HEAD; } 2>/dev/null \
                | awk '$1=="160000"{print $4}' | sort -u )

    if [ "$corrected" -eq 1 ]; then
        # --allow-empty: if the source commit ONLY bumped the submodule, resetting
        # it to ours leaves nothing — that's a no-op backport, not an error. The
        # empty commit is then dropped by the "no net change vs target" check below
        # (a submodule pointer moves on its own line, never as a backport side effect).
        if ! git commit --amend --no-edit --quiet --allow-empty; then
            echo "::error::Could not amend ${target} after resetting submodule pointer(s)." >&2
            comment_original ":x: Backport to \`${target}\` could not re-commit after correcting a submodule pointer. See ${RUN_URL}"
            return 1
        fi
    fi
    return 0
}

# --- backport one target --------------------------------------------------

backport_one() {
    local target="$1"

    # Start clean (a previous target may have left cherry-pick state behind).
    git cherry-pick --quit 2>/dev/null || true
    git reset --hard --quiet HEAD 2>/dev/null || true

    if ! [[ "$target" =~ ^(main|release/[0-9]+\.[0-9]+)$ ]]; then
        echo "::warning::Skipping invalid backport target '${target}'."
        comment_original ":warning: Skipped backport to \`${target}\`: not an allowed target (use \`main\` or \`release/X.Y\`)."
        return 0
    fi
    if [ "$target" = "$PR_HEAD_REF" ]; then
        echo "Skipping '${target}': same as the PR head ref."
        summary_row ":fast_forward: Skipped — same as the PR head ref"
        return 0
    fi

    local sanitized branch
    sanitized="${target//\//-}"
    branch="backport-${PR_NUMBER}-to-${sanitized}"

    # An existing backport branch may hold manual conflict fixes — never clobber it.
    # Tell three cases apart so a partial prior run (branch pushed, no PR) recovers
    # instead of being mistaken for "already done".
    if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
        local prs_json open_url any_count
        prs_json="$(gh pr list --repo "$REPO" --head "$branch" --base "$target" --state all \
            --json url,state)"
        open_url="$(jq -r 'map(select(.state == "OPEN")) | .[0].url // ""' <<<"$prs_json")"
        any_count="$(jq 'length' <<<"$prs_json")"
        if [ -n "$open_url" ]; then
            echo "Open backport PR already exists: ${open_url}; leaving as-is."
            comment_original ":information_source: A backport PR to \`${target}\` already exists: ${open_url}"
            return 0
        fi
        if [ "$any_count" -gt 0 ]; then
            echo "A closed/merged backport PR for ${branch} exists; not reopening."
            comment_original ":information_source: A backport PR to \`${target}\` was already created and closed or merged; not reopening."
            return 0
        fi
        # Branch exists but no PR was ever opened -> a prior run pushed the branch
        # then failed before `gh pr create`. Recover by opening the PR now.
        echo "Backport branch ${branch} exists with no PR; recovering by opening the PR."
        finalize_pr "$target" "$branch" "$(recovery_is_conflicted "$branch")"
        return $?
    fi

    if ! git fetch --no-tags --quiet origin "$target"; then
        echo "::warning::Target '${target}' not found on origin; skipping."
        comment_original ":warning: Skipped backport to \`${target}\`: branch not found on origin."
        return 0
    fi

    git checkout -B "$branch" "origin/${target}" --quiet

    local conflicted=0
    if ! git cherry-pick -x "${cp_mainline[@]}" "$MERGE_SHA"; then
        if [ -z "$(git status --porcelain)" ]; then
            git cherry-pick --quit 2>/dev/null || true
            echo "Cherry-pick onto ${target} is empty; change already present."
            comment_original ":information_source: Backport to \`${target}\` skipped: the change is already present."
            return 0
        fi
        if git diff --name-only --diff-filter=U | grep -q .; then
            # Partition the conflicts up front. A submodule (gitlink) conflict is
            # EXPECTED and benign: main and release/X.Y legitimately track different
            # composableai/llumiverse commits, so any source commit that also bumped
            # the gitlink conflicts here even when every real file merged cleanly.
            # Only a NON-gitlink conflict makes this a backport a human must inspect
            # (a draft). Capture that set before we start resolving anything.
            local nongitlink_conflicts
            nongitlink_conflicts="$(git ls-files --unmerged | awk '$1!="160000"{print $4}' | sort -u)"
            if [ -n "$nongitlink_conflicts" ]; then
                echo "Real (non-gitlink) conflicts cherry-picking onto ${target}; preparing a draft PR."
            else
                echo "Only submodule gitlink conflicts onto ${target}; pinning to ours and opening a normal PR."
            fi

            # Stage conflicted regular files (they keep their markers for manual
            # resolution); pin submodule gitlinks to OURS at the index level since an
            # unchecked-out submodule can't be `git add`ed. Avoid `git add -A`,
            # which chokes on the empty submodule directory.
            printf '%s\n' "$nongitlink_conflicts" | while IFS= read -r f; do
                [ -n "$f" ] && git add -- "$f" 2>/dev/null || true
            done
            resolve_gitlink_conflicts "$target"

            # A gitlink left unmerged (structural submodule add/delete) is the one
            # thing we must NEVER force to theirs — that would leak the source
            # submodule pointer onto the backport branch. Bail for a hand cherry-pick.
            if git ls-files --unmerged | awk '$1=="160000"{print $4}' | grep -q .; then
                echo "::error::Unresolved submodule gitlink conflict onto ${target}; refusing to take the source pointer. Cherry-pick by hand." >&2
                comment_original ":x: Backport to \`${target}\` has a submodule conflict that can't be safely auto-resolved without leaking the source pointer. Cherry-pick \`${MERGE_SHA}\` by hand. See ${RUN_URL}"
                git cherry-pick --abort 2>/dev/null || true
                return 1
            fi
            # Force-resolve any remaining NON-gitlink conflict (modify/delete, rename,
            # add/add) to the incoming side, so those become a draft for a human to
            # validate rather than hard-failing the backport. Gitlinks are settled
            # above and are deliberately excluded here.
            git ls-files --unmerged | awk '$1!="160000"{print $4}' | sort -u | while IFS= read -r p; do
                [ -n "$p" ] || continue
                git checkout --theirs -- "$p" 2>/dev/null && git add -- "$p" 2>/dev/null \
                    || git rm -q -- "$p" 2>/dev/null \
                    || git add -- "$p" 2>/dev/null || true
            done
            # set -e is suspended here (if-condition subshell), so check explicitly.
            # Only a path that can't even be force-resolved is truly unrecoverable.
            if git ls-files --unmerged | grep -q .; then
                echo "::error::Could not auto-resolve conflicts onto ${target}; manual cherry-pick needed." >&2
                comment_original ":x: Backport to \`${target}\` has conflicts that couldn't be auto-staged. Cherry-pick \`${MERGE_SHA}\` by hand. See ${RUN_URL}"
                git cherry-pick --abort 2>/dev/null || true
                return 1
            fi
            if git diff --cached --quiet "origin/${target}"; then
                git cherry-pick --quit 2>/dev/null || true
                echo "Resolved conflict has no net change vs ${target}; skipping."
                comment_original ":information_source: Backport to \`${target}\` skipped: no changes relative to \`${target}\`."
                return 0
            fi
            if ! git -c core.editor=true cherry-pick --continue; then
                echo "::error::Failed to conclude cherry-pick onto ${target}." >&2
                comment_original ":x: Backport to \`${target}\` failed to conclude the cherry-pick. See ${RUN_URL}"
                git cherry-pick --abort 2>/dev/null || true
                return 1
            fi
            # A gitlink-only conflict was pinned to ours (no net submodule change) and
            # auto-merges like any clean backport; only a real file/structural conflict
            # opens as a draft.
            if [ -n "$nongitlink_conflicts" ]; then
                conflicted=1
            fi
        else
            git cherry-pick --abort 2>/dev/null || true
            echo "::error::Unexpected cherry-pick failure onto ${target}." >&2
            comment_original ":x: Backport to \`${target}\` failed unexpectedly: ${RUN_URL}"
            return 1
        fi
    fi

    # HARD INVARIANT: no source-branch submodule pointer may reach the backport.
    # Run on EVERY path (clean pick included) since a gitlink can move with no
    # conflict when the target pointer equals the source commit's parent. This
    # comes before the empty-diff check so a clean, submodule-only bump normalizes
    # to the target pointer and is then correctly skipped as "no net change".
    if ! normalize_gitlinks_to_target "$target"; then
        git cherry-pick --abort 2>/dev/null || true
        return 1
    fi

    # Don't open an empty PR: if the result is identical to the target there is
    # nothing to backport (e.g. the change is already present, or a conflict was
    # resolved back to the target's state).
    if git diff --quiet "origin/${target}" HEAD; then
        echo "No net change vs ${target}; skipping (nothing to backport)."
        comment_original ":information_source: Backport to \`${target}\` skipped: no changes relative to \`${target}\`."
        return 0
    fi

    if [ "$conflicted" -eq 1 ]; then
        # Durably flag the conflict in the commit so a recovery rerun opens a DRAFT.
        # Gitlink conflicts are resolved markerlessly (git update-index), so a marker
        # grep alone can't tell a conflicted backport from a clean one on recovery.
        # set -e is suspended here (if-condition subshell), so check explicitly:
        # never push an unflagged conflicted backport — recovery would reopen it as
        # a mergeable PR and the automerge workflow could land it unverified.
        if ! git commit --amend --no-edit --quiet --trailer "Backport-Conflicted: true"; then
            echo "::error::Could not flag the conflict on ${target}; refusing to push an unflagged conflicted backport." >&2
            comment_original ":x: Backport to \`${target}\` could not be flagged as conflicted — not opening a PR (recovery safety). Re-run the job. See ${RUN_URL}"
            return 1
        fi
    fi

    if ! git push --quiet origin "HEAD:${branch}"; then
        echo "::error::Failed to push ${branch} to origin." >&2
        comment_original ":x: Backport to \`${target}\` failed to push the branch. See ${RUN_URL}"
        return 1
    fi

    finalize_pr "$target" "$branch" "$conflicted"
    return $?
}

# --- run, isolating each target so one failure can't abort the rest -------

# Job-summary header (rendered on the run page so outcomes aren't buried in logs).
summary "## Backport of [#${PR_NUMBER}](${PR_URL})"
summary ""
summary "**${PR_TITLE}**"
summary ""
summary "Source \`${MERGE_SHA:0:12}\` &middot; targets: \`${targets[*]}\`"
summary ""
summary "| Target | Result |"
summary "| --- | --- |"

overall_status=0
for target in "${targets[@]}"; do
    echo "::group::Backport to ${target}"
    if ! ( backport_one "$target" ); then
        overall_status=1
        echo "::error::Backport to ${target} failed."
    fi
    echo "::endgroup::"
done

summary ""
if [ "$overall_status" -ne 0 ]; then
    summary "> :x: One or more targets failed. Re-run the failed job, or remove and re-add the \`backport/<target>\` label."
fi

exit "$overall_status"
