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
