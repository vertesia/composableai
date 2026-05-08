---
name: vertesia-demo-content
description: Generate realistic reusable demo or seed content for Vertesia applications and upload it through the Vertesia CLI, API, or browser session. Use when building Vertesia custom apps, plugins, prototypes, repository workflows, AI extraction workflows, search/filter pages, or demos where the app should use real store objects instead of hardcoded mock arrays; includes checking the active CLI profile and asking before mutating a Vertesia project.
---

# Vertesia Demo Content

Use this skill when a Vertesia app needs real content in the store so upload, search, filters, metadata extraction, workflows, and detail pages can be exercised end to end.

## Core Rule

Prefer realistic generated content uploaded to Vertesia over hardcoded UI mock data. Static arrays are acceptable only as temporary empty states, fallback examples, or tests that intentionally avoid network/project mutation.

## Workflow

1. Inspect the active target before mutation:
   - Run `vertesia profiles show`.
   - Identify the active/default profile, account, project, environment, and API base URL.
   - Do not print full API tokens in the final answer.
   - Ask the user to confirm the target project before uploading, deleting, or updating content.

2. Confirm the target content type:
   - Prefer the actual type id from Vertesia’s type catalog or the app/tool-server package.
   - For app-contributed in-code types, do not assume the local type name is the runtime create id.
   - Distinguish:
     - query/search type name, for example `clm_contract`
     - app in-code create id, for example `app:<app-name>:clm:ClmContract`
   - If uncertain, inspect available types with CLI, project app-type APIs, and app endpoints before uploading.

3. Generate useful files:
   - Use Markdown for document-like demos unless the user requests DOCX, PDF, JSON, or another format.
   - Include domain-specific details that make search, filters, extraction, summaries, and detail views meaningful.
   - Include structured headings and bullet metadata so AI extraction has clear signals.
   - Save generated files under `/tmp`, `/private/tmp`, or a user-approved fixture path. Do not commit generated seed data unless requested.

4. Upload through the best available channel:
   - Prefer `vertesia content post <file> --type <type> --mime text/markdown --name <name> --path <path>` when the CLI profile is confirmed and the target type is a stored/system type or the CLI is known to accept the app-defined type.
   - Use the browser/plugin session when upload must happen as the signed-in UI user.
   - Use direct API when the CLI rejects an app-defined type but the project app-type APIs and runtime create path accept it.

5. Wire the app to real objects:
   - Replace static arrays with `store.objects.search`, `store.objects.list`, or collection search.
   - Filter by full text plus metadata fields such as `properties.status`, `properties.owner`, `properties.category`, `properties.risk_level`, or app-specific fields.
   - After upload, trigger a refetch or insert the created object into local state.
   - For metadata extraction, read object text, run the relevant interaction, then update object properties.

## App Type Rules

When seeding app-defined content:

- Use query/search names such as `clm_contract` for filters and object searches.
- Use the resolved app type code such as `app:<app-name>:clm:ClmContract` for object creation.
- If UI actions create child records, use the same explicit app type codes there too.
- If agent runs or workflow `executeInteraction` calls target app interactions, use the full app interaction id such as `app:<app-name>:clm:ExtractContractMetadata`.

## CLI Limitation

`vertesia content post` may validate only against `client.types.list()`, which can exclude app-defined in-code types.

If the CLI says the type does not exist:

1. verify the app package exposes the type
2. verify the project app-type APIs list and retrieve it
3. test direct object creation with the resolved app type code
4. use a repo-local uploader script or direct API if the project accepts the type but the CLI still rejects it

Do not assume CLI rejection means the app type is missing from the project.

## CLI Pattern

Upload generated Markdown:

```bash
vertesia content post /tmp/demo-seed/acme-doc.md \
  --type <content-type-id> \
  --mime text/markdown \
  --name "Acme Demo Document" \
  --path /demo
```

List uploaded content:

```bash
vertesia content list /demo
```

## Generator Script

Use `scripts/generate_markdown_seed.py` to generate reusable Markdown seed data:

```bash
python3 .claude/skills/vertesia-demo-content/scripts/generate_markdown_seed.py \
  --out /tmp/vertesia-demo \
  --domain generic \
  --count 3
```

Supported built-in domains:

- `generic`: reusable business documents for repository/search/extraction demos.
- `clm`: contract lifecycle documents with dates, values, renewal terms, obligations, and clauses.
- `support`: customer support cases with severity, owner, product, timeline, and resolution notes.
- `policy`: internal policy/procedure documents with owners, effective dates, controls, and exceptions.

Use `--domain generic` unless the app domain is known.
