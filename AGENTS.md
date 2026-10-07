# Build & Test Commands

- Build: `pnpm build` (builds all workspace packages)
- Package build: `cd <package-dir> && pnpm build`
- Dev mode: `pnpm dev` (watches for changes)
- Run tests: `pnpm test` (all tests)
- Run single test: `cd packages/<package> && pnpm test -- -t "<test name>"`
- Lint: `pnpm lint` (all packages)
- Format: `pnpm format`
- Check formatting without writing: `pnpm format:check`

# Code Structure

This Git repository is a mono-repository built on top of pnpm.

- `.github/**` contains changes related to GitHub
- `packages/**` contains different packages for different purposes, particularly, `packages/cli` is the Vertesia CLI and `packages/client` is the Vertesia JS Client.
- `llumiverse` is a Git submodule pointing to another Git repository for LLM connectors

# Canonical Conversation Contracts

`llumiverse/conversation` owns shared conversation Zod schemas and schema-derived TypeScript types.
Import its schema values through `@llumiverse/conversation/schemas` when composing public host
request/response envelopes in `packages/common/src/api-schemas`; do not copy canonical record fields
or create competing conversation interfaces. Host schemas retain their existing registry and generated
wire-type conventions. See `packages/common/README.md` for the schema ownership and validation flow.

# Code Style

- TypeScript strict mode with `noUnusedLocals`/`noUnusedParameters` enabled
- ESM modules with node-next resolution
- Async patterns:
  - Use async/await with proper error handling
  - No floating promises allowed
  - Always catch and handle exceptions appropriately
- Objects: use shorthand notation where applicable
- Naming conventions:
  - Unused variables prefix: `_` (e.g., `_unused`)
  - Line length: 120 characters maximum
  - Use 4-space indentation
  - Use single quotes for strings
- Component patterns: follow existing naming, directory structure and import patterns
- Type safety:
  - Always use proper typing - avoid `any` when possible
  - Use TypeScript utility types where appropriate
- Error handling: use proper error types and propagation, especially with async code
- Formatting: follows `biome.json` in this repository

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
