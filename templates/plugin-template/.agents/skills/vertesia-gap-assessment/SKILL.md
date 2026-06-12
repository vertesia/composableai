---
name: vertesia-gap-assessment
description: Assess the gap between arbitrary requirements and existing Vertesia capabilities before proposing implementation work. Use when reviewing requirement documents, discovery notes, demo asks, or feature requests for a Vertesia app, plugin, workflow, or agent so you can separate native platform support, installed project capabilities, current app implementation, and true custom work.
---

# Vertesia Gap Assessment

Use this skill before proposing implementation plans for a Vertesia solution. The goal is to avoid inventing custom work too early and to ground recommendations in four sources of truth:

1. live project state
2. official Vertesia docs
3. current codebase
4. related local examples

Read `references/sources-and-checks.md` at the start of the assessment.

## What To Produce

Produce a compact assessment with these sections:

- Requirement summary
- Existing Vertesia capabilities relevant to the ask
- Existing project or app assets that can be reused
- Gap matrix:
  - requirement
  - native support
  - project support
  - app support
  - custom work needed
- Recommended implementation path
- Risks or unknowns requiring verification

Keep the distinction explicit between:

- what Vertesia supports in general
- what the target project has installed or configured
- what the current app or plugin already uses

## Workflow

### 1. Normalize the requirements

Extract the requested outcomes and group them into a short capability list. Use whatever groups fit the ask, but these are the default buckets:

- intake
- repository and search
- workflow and approvals
- lifecycle and reminders
- reporting and analytics
- integrations
- assistant and agent behavior
- mobile or responsive UX
- admin and settings

Do not jump to architecture until the requirement list is normalized.

### 2. Check sources in the right order

#### A. Live project state first

Use the CLI or API to inspect what is actually present in the target Vertesia project:

- active CLI profile
- installed workflow definitions
- installed workflow rules
- installed apps
- interactions available in the current project
- content objects or uploaded demo data when relevant

If a command fails due to expired auth, refresh the profile and retry.

If you inspect profiles with `vertesia profiles show`, do not echo API keys or tokens back to the user. Summarize only the safe fields you need.

When the question involves app-defined types, interactions, templates, or remote activities, verify the exact runtime identifiers through the project APIs or the app package, not only through local code. App resources often have two useful names:

- a local/query name used in search filters, such as `clm_contract`
- an app in-code identifier used in create/execute paths, such as `app:<app-name>:clm:ClmContract`

#### B. Official docs second

Use the Vertesia docs to determine platform-native capabilities before proposing custom code. The high-value pages are:

- workflow activities catalog
- agent built-in tools
- agent runner overview
- plugin/custom app docs
- CLI reference

Prefer standard workflows, built-in workflow activities, and built-in agent tools when they cover the requirement.

#### C. Current codebase third

Inspect what the current app already implements:

- content types
- interactions
- tools and activities
- workflow specs
- UI routes and pages
- local skills and project docs

For UI requirements, inspect both the local UI code and the available `@vertesia/ui` primitives before proposing custom components. A gap in the current app is not automatically a gap in the shared UI library.

Do not confuse "possible in Vertesia" with "already wired into this app".

#### D. Related local examples fourth

Look for reusable patterns in:

- nearby plugin repos
- project-local skills
- installed standard workflows in the target project
- prior implementations of similar flows

Treat installed standard workflows as real reuse candidates, not as theoretical examples.

### 3. Classify every requirement

For each requirement, classify it as one of:

- already implemented
- available natively in Vertesia
- partially covered and should be composed from native pieces
- requires custom plugin or app code
- requires external integration or project configuration

Use the most conservative label that is still accurate.

### 4. Recommend the right architectural home

Use these defaults unless the evidence points elsewhere:

- deterministic intake and side effects -> DSL workflow
- structured extraction -> interaction executed by workflow
- open-ended review, search, explanation, analysis -> agent
- standard repository operations -> built-in workflow activities or built-in agent tools
- domain-specific routing, linked-record creation, adapter logic -> custom plugin code only if native pieces do not cover it
- UX-only visualization or dashboards -> UI composition
- third-party system access -> integration or adapter layer

For list/detail UI requirements, also decide where state must live. If users are expected to go from a table to a detail view and back without losing context, page-local state is usually the wrong recommendation.

Do not assume an agent is the best orchestration model. Check built-in workflow activities first.

Do not invent custom activities too early. Check the workflow activities catalog first.

### 5. Write the gap matrix

For each normalized requirement, capture:

- requirement
- evidence or source
- current support status
- recommended implementation approach
- custom work still needed
- open unknowns

Be explicit when the right answer is hybrid, for example:

- standard workflow + custom enrichment
- built-in tools + custom UI
- deterministic workflow + agent assistant

## Decision Rules

- Docs are not enough. Verify installed definitions and project state with the CLI.
- Installed project capabilities are not the same as code already used by this app.
- Existing standard workflows should be inspected before creating new ones.
- Prefer reuse over replacement when a standard workflow covers the generic part and custom code only needs to handle domain enrichment.
- If a requirement depends on configuration, credentials, or app installation settings, call that out separately from code work.
- If standard intake is already installed, prefer adding domain enrichment after the standard workflow completes rather than starting a second workflow on the same `create` event and letting them race.
- CLI support and project runtime support are not the same thing. A CLI command may reject an app-defined type even when direct project APIs and the app runtime accept it.
- For app-defined interactions in workflows, `executeInteraction` typically needs the full app interaction id, not a bare interaction name.
- For app-defined child records created from custom activities or UI actions, prefer the resolved app type code used by the runtime create path.
- For UI work, classify "needs custom UI code" only after checking whether the shared `@vertesia/ui` library already provides the needed primitive.
- For list/detail UI work, inspect the route boundary and the persistence behavior of shared filter components. If `FilterProvider` or URL-backed filters are involved and state also survives navigation, plan a normalization or dedupe step so filter restoration does not create duplicates.
- For sortable, facet-driven repository tables, prefer one backend search path that owns rows, sort, and facets instead of mixing a simpler find path with a richer search path.

## Output Style

Keep the assessment compact and implementation-oriented.

Prefer short grouped bullets and a small matrix over long prose.

When useful, summarize the recommendation in one sentence:

`Use <native capability> for the generic path, then add <custom component> for the domain-specific gap.`
