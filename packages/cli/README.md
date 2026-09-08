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

## Documentation

See https://docs.vertesiahq.com/cli

## License

Apache-2.0

## Automatic token refresh

Profile authentication refreshes short-lived access tokens using the refresh token in the native keychain.
Concurrent commands coordinate through an exclusive localhost socket held until rotated credentials are saved.
The OS releases ownership when the process exits; a slow keychain prompt does not expire the lock.
Commands report waiting after five seconds and fail after 75 seconds without taking over a live owner's lock.
A hash collision or an unrelated process occupying the selected port can cause contention, but cannot bypass coordination.
Every process sharing a profile must use the updated CLI for this coordination to apply.

After a failed proactive refresh, a stored access token is used only if it has more than five seconds remaining.
Otherwise the original refresh error is surfaced. Failed exchanges do not delete stored refresh tokens.
Saving a rotated replacement retries the same keychain write up to three times; it never repeats the token exchange.
If saving still fails, the CLI reports the keychain error instead of reporting a successful refresh.
A lost response after server-side rotation can still require interactive authentication.

Refresh coordination uses the OS user identity and profile name, independently of home-directory overrides. If its local port is occupied, the CLI reports the address so you can identify the owning process. Coordination failures stop credential writes; allow loopback binding before retrying.
