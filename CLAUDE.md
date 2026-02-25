# Build & Test Commands

- Build: `pnpm build` (builds all workspace packages)
- Package build: `cd <package-dir> && pnpm build`
- Dev mode: `pnpm dev` (watches for changes)
- Run tests: `pnpm test` (all tests)
- Run single test: `cd packages/<package> && pnpm test -- -t "<test name>"`
- Lint: `pnpm lint` (all packages)

# Code Structure

This Git repository is a mono-repository built on top of pnpm.

- `.github/**` contains changes related to GitHub
- `packages/**` contains different packages for different purposes, particularly, `packages/cli` is the Vertesia CLI and `packages/client` is the Vertesia JS Client.
- `llumiverse` is a Git submodule pointing to another Git repository for LLM connectors 

# Code Style

- TypeScript strict mode with noUnusedLocals/Parameters
- ESM modules with node-next resolution
- Use async/await with proper error handling (no floating promises)
- Objects: use shorthand notation
- Unused variables prefix: `_` (e.g., `_unused`)
- Line length: 120 characters, single quotes
- Component patterns: follow existing naming, directory structure and import patterns
- Always use proper typing - avoid `any` when possible
- Error handling: use proper error types and propagation, especially with async code
- Formatting: follows Prettier configuration
