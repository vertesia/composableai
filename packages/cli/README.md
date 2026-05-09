# Vertesia CLI

This is a command line application that can be used to access your Vertesia projects.
It was designed to fulfil the following main use cases:

* List and switch between your Vertesia projects
* List the existing interactions and execution environments
* Run interactions once or multiple times over a set of different data inputs.
* Generate data inputs to run the interactions against.
* Search through the history of runs to inspect detailed results.

## Requirements

A TTY terminal and Node.js version 18 or higher is required.

On macOS arm64, the npm package installs an optional native Bun executable for CLI execution. This gives macOS Keychain a stable Vertesia CLI binary identity for stored profile credentials while keeping the Node.js implementation as the fallback for other platforms.

## Authentication

The CLI prefers explicit environment credentials for headless and CI environments:

```bash
VERTESIA_APIKEY=...
COMPOSABLE_PROMPTS_APIKEY=...
VERTESIA_TOKEN=...
```

Use `VERTESIA_APIKEY` or `COMPOSABLE_PROMPTS_APIKEY` for durable headless credentials. The client exchanges API keys for fresh access tokens as needed. Use `VERTESIA_TOKEN` only for short-lived injected sessions where the surrounding environment refreshes the token.

When a profile is used, the CLI stores profile credentials in the operating system credential store when possible. If the store is unavailable, for example on a Linux host without a Secret Service daemon, profile creation falls back to the legacy `apikey` field in `~/.vertesia/profiles.json` and prints a warning.

Interactive authentication prints the OAuth server, device endpoint, and token endpoint it is using. Device codes are created and polled on the discovered STS, while the browser approval page opens on the profile UI origin when one is configured. To diagnose mismatched local or dev-branch auth flows, add `--debug` to `vertesia auth login`, `vertesia auth refresh`, `vertesia profiles add`, or `vertesia profiles refresh`. You can also set `VERTESIA_CLI_DEBUG=1` to print the same OAuth discovery diagnostics for token refreshes triggered by other commands.

## Installation

```bash
npm -g install @vertesia/cli
```

## Basic Usage

```bash
vertesia help
```

## Documentation

See https://docs.vertesiahq.com/cli

## License

Apache-2.0
