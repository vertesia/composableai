# RuleSets

These JSON files mirror rulesets defined in this repository's settings. Import them
at <https://github.com/vertesia/composableai/settings/rules>. Note that editing
these files does **not** apply to GitHub automatically — it requires a manual
import by someone with an administrator role on the repo (or `gh api
repos/vertesia/composableai/rulesets --input <file>`, dropping the export-only
`source`/`source_type` fields). Reach out to the `#dev` Slack channel if needed.

## `release.json`

Protects the `release/X.Y` release lines coordinated by the studio release process
(see `docs/release-process.md` in `vertesia/studio`). It mirrors this repo's `main`
ruleset (PR + 1 approval, no deletion / non-fast-forward, CodeQL code scanning) but
targets `refs/heads/release/**` instead of the default branch.

Note: this is distinct from the existing `maintenance` ruleset, which targets bare
`X.Y` branches (the older scheme); the coordinated release lines use the
`release/X.Y` prefix.

When importing, an admin must configure the **bypass actors** (left empty in the
committed JSON, as for `main`) so the release automation can operate on `release/*`.
**Use bypass mode `Exempt`, not `Always`** — "Always" is an interactive break-glass
prompt a non-interactive app token can't perform (so the rule stays enforced and the
create 422s); `Exempt` silently skips evaluation. Add:

- the **release-bot** app (`Exempt`) — studio's `release-cut.yaml` creates the
  `release/X.Y` line as this app, and
- the submodule-sync automerge app (so `(sync) Update Git submodule` PRs auto-merge
  into `release/X.Y`).

The release-cut **never** bypasses `main`: version bumps to `main` arrive as PRs that
the approve+merge automation lands.

`release.json` keeps `main`'s CodeQL `code_scanning` rule because `release/X.Y` is
the production line and must be CodeQL-gated. This repo uses CodeQL **default
setup**, which scans pull requests targeting the default branch *or any protected
branch* — so protecting `release/**` (this ruleset) makes those scans run
automatically, with no advanced-setup workflow required.
