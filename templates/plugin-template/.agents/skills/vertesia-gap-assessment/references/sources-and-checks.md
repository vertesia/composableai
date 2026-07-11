# Sources And Checks

Use this file as the concrete checklist when assessing requirements against Vertesia capabilities.

## 1. Live Project State

Check project reality before reading docs deeply.

### CLI commands verified in this environment

```bash
vertesia profiles show
vertesia profiles refresh
vertesia workflows definitions list
vertesia workflows definitions get <workflowId>
vertesia workflows rules list
vertesia workflows rules get <ruleId>
vertesia apps list-installed
vertesia apps get-installation <appName>
vertesia interactions
vertesia content list
vertesia content get <objectId>
```

### Notes

- `vertesia profiles show` includes sensitive tokens. Never repeat them in user-facing output.
- If workflow or app queries fail with `401 Token expired`, run `vertesia profiles refresh` and retry.
- After auth refresh, verify the existing dev server port, public tunnel, and installed app manifest endpoint before starting replacements.
- Installed workflows matter. In this environment, inspecting installed definitions surfaced reusable system workflows such as `StandardDocumentIntake`.

### Questions to answer

- Which profile and project are active?
- Which workflow definitions are installed?
- Which workflow rules are installed?
- Which apps are installed in the project?
- Which interactions are already available?
- Is there existing content/demo data that changes the implementation plan?

### Resource identity checks

For app-defined resources, verify the exact ids used by the runtime create/execute paths.

- Confirm the installed app manifest endpoint is reachable and points to the expected package URL.
- For local development against a cloud project, verify the tunnel URL and the manifest `endpoint` before debugging missing app resources.
- List app types from the project, not just from local code.
- Check the direct app-type detail endpoint, not only the listing endpoint.
- Distinguish:
  - query/search type name, for example `clm_contract`
  - app in-code type id, for example `app:<app-name>:clm:ClmContract`
  - app interaction id, for example `app:<app-name>:clm:ExtractContractMetadata`

Do not assume the lowercase local type name is also the correct runtime create id.

### CLI vs API checks

- `vertesia content post` may validate only against stored/system types and reject app-defined types.
- If the CLI rejects an app-defined type, verify the project app-type APIs before assuming the app is broken.
- When the runtime accepts the app-defined type but the CLI does not, use a direct API uploader or an app-side upload flow.

## 2. Official Vertesia Docs

Use docs to determine what the platform supports natively.

### Priority docs

- Workflow activities catalog
- Agent built-in tools
- Agent runner overview
- Plugin/custom app docs
- CLI docs

### What to look for

- Standard workflow activities that replace custom orchestration code
- Built-in agent tools that replace custom repository/search wrappers
- Existing platform patterns for workflows, agents, search, scheduling, updates, and integrations

### Reusable lessons

- Built-in workflow activities often already cover extraction, interaction execution, document updates, progress messages, and embeddings.
- Built-in agent tools often already cover search, fetch, document CRUD, collection management, and optional workflow scheduling.
- Standard intake workflows often cover generic text extraction, property generation, and embeddings. Domain-specific enrichment should usually be staged after standard intake completes.

## 3. Current Codebase

Inspect the local app/plugin to see what is already implemented.

### Default paths to inspect

```text
src/modules/app/resources/types/
src/modules/app/resources/interactions/
src/modules/app/resources/tools/
src/modules/app/resources/activities/
src/modules/app/ui/routes.tsx
src/modules/app/ui/pages/
src/tool-server/config.ts
src/tool-server/app-server-modules.ts
workflow-specs/
.agents/skills/
```

### Questions to answer

- Which content types already exist?
- Which interactions already exist?
- Which tools or remote activities already exist?
- Are there workflow specs in the repo, or only installed workflows in the project?
- Which UI pages already expose the behavior?
- Does the UI use the same identifiers for query/search and create/execute paths, or are those concerns currently conflated?
- For list/detail UX, where does the list state actually live relative to the route boundary?
- If filters are URL-backed, can the current state model remount and re-append the same filters on back-navigation?

## 4. Related Examples

Use nearby examples to reduce custom work.

### Good sources

- neighboring plugin repos
- project-local skills
- installed standard workflows
- local implementation examples that use the same Vertesia primitives

### Example reuse patterns

- standard workflow + custom post-processing
- built-in interaction execution + custom linked-record persistence
- built-in agent tools + custom assistant prompt
- standard document intake + post-intake enrichment rule on `update` when `status=completed`

## 5. Classification Framework

For each requirement, classify it as:

- already implemented
- available natively in Vertesia
- partially covered and composable from native pieces
- requires custom plugin/app code
- requires external integration or project configuration

Also record three support layers separately:

- native platform support
- installed project support
- current app support

## 6. Architecture Heuristics

Use these defaults unless evidence shows a better fit:

- deterministic intake, updates, retries, audit-friendly side effects -> workflow
- structured extraction with schema output -> interaction executed by workflow
- exploratory review, explanation, search assistance -> agent
- standard repository operations -> built-in workflow activities or built-in agent tools
- domain-specific routing and child-record creation -> custom plugin logic if native pieces stop short
- scheduling and outbound communication -> verify native support and project configuration before proposing custom code
- list/detail UX with preserved context -> lift state above the route boundary, persist scroll explicitly, and normalize URL-restored filters

## 7. Debugging Heuristics

When a create or execute path fails with "app type not found" or "interaction not found":

1. verify the installed app manifest points to the correct `/api/package` endpoint
2. verify the public tunnel or deployment URL is reachable and returns the expected app package
3. verify the app package endpoint exposes the resource
4. verify the project app-resource listing endpoint sees it
5. verify the project app-resource detail endpoint resolves it
6. compare the id shape used in the failing payload with the id shape returned by the detail endpoint
7. test direct API create/execute before blaming the app logic

When debugging locally against a cloud project, app-manifest and tunnel issues are often mistaken for type or interaction bugs.

When back-navigation in a list/detail UI behaves badly:

1. check whether filters, sort, and search live inside the list page component
2. check whether a shared filter component also restores from the URL on mount
3. dedupe or normalize filter writes if both persisted React state and URL restoration are active
4. persist scroll position in history state and restore it after the list layout is ready
5. if hover-reveal buttons are invisible, verify Tailwind variant classes are literal strings and not dynamically assembled template fragments

When auth expires mid-debugging:

1. refresh auth
2. verify the existing local dev server still responds
3. verify the current tunnel host still resolves
4. verify the installed app manifest still points to that live tunnel
5. only create a new dev server or tunnel if the current pair is invalid

Do not let multiple quick tunnels and drifting local ports accumulate during one debugging session.

When two workflows act on the same object:

1. check installed rules, not just repo workflow specs
2. confirm which event each rule matches
3. avoid `create`-time races when a standard intake workflow already exists
4. move custom enrichment to a later `update` condition if the generic workflow should finish first
