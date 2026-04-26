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

## Installation

```bash
npm -g install @vertesia/cli
```

## Basic Usage

```bash
vertesia help
```

## Profiles

The CLI uses configuration profiles to store the selected Vertesia account, project, endpoints, and auth token.

Common profile commands:

```bash
vertesia profiles show
vertesia profiles use <name>
vertesia profiles add <name> --target <target> --region <region>
vertesia auth token
```

Supported profile targets:

- `local`
- `dev-*`
- `preview`
- `prod`
- custom `https://.../cli` URL

Supported regions:

- `dev1`
- `us1`
- `eu1`
- `jp1`

Default region behavior:

- `local` and `dev-*` default to `dev1`
- `preview` and `prod` default to `us1`

Examples:

```bash
# Dev branch profile
vertesia profiles add my-dev --target dev-feat-foo

# Regional preview profile
vertesia profiles add my-preview-eu --target preview --region eu1

# Regional production profile
vertesia profiles add my-prod-jp --target prod --region jp1
```

## Documentation

See https://docs.vertesiahq.com/cli

## License

Apache-2.0
