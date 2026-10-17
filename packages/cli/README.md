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

## Multiple MCP app instances

Name-based lookup continues to select the default installation. Use an installation ID or an
app name/manifest ID plus an instance key to inspect another instance:

```bash
vertesia apps list-installed --json
vertesia apps get-installation my-crm
vertesia apps get-installation my-crm --instance-key eu
vertesia apps get-installation INSTALLATION_ID --id
```

Install a named instance with stable prefixes for each MCP collection:

```bash
vertesia apps install MANIFEST_ID --instance-key eu --display-name 'Europe CRM' \
  --namespaces '{"crm":"crm_eu"}' --credentials-file credentials.json
```

The server must enable multiple instances for the project. `credentials.json` uses the public
installation payload fields, with collection IDs and named provider keys kept separate:

```json
{
  "oauth_params": {
    "crm": { "client_id": "eu-client", "client_secret": "REPLACE_ME", "scopes": ["read"] }
  },
  "oauth_provider_params": {
    "shared_provider": { "client_id": "eu-provider-client", "client_secret": "REPLACE_ME" }
  },
  "api_key_params": {
    "reports": { "api_key": "REPLACE_ME" }
  }
}
```

Include only the entries declared by the manifest. Credentials are read from the file and never
printed. An additional instance starts without the default instance's keys or OAuth credentials.

Settings updates take **installation IDs**, preserve omitted fields and can update a label alone:

```bash
vertesia apps settings INSTALLATION_ID --display-name 'Europe production'
vertesia apps settings INSTALLATION_ID --settings '{"region":"eu"}'
vertesia apps settings INSTALLATION_ID --namespaces '{"new_collection":"new_eu"}'
vertesia apps settings INSTALLATION_ID --mcp-parameters-file parameters.json
vertesia apps settings INSTALLATION_ID --mcp-shared-parameters '{"tenant":null}'
vertesia apps settings INSTALLATION_ID --access-control all
```

Namespace updates allocate newly added collections; existing prefixes and instance keys are immutable.
`--namespaces-file` and `--settings-file` accept JSON files instead of inline JSON. MCP parameter files
contain objects keyed by collection ID (for example `{"crm":{"region":"eu","token":"REPLACE_ME"}}`).
Use files for secret parameter values. `--mcp-shared-parameters-file` accepts the shared parameter object.
A parameter value of `null` clears an override; omitted values are retained. `--access-control null`
clears the installation policy override; these policy updates require project-admin permission.
Per-instance grants use the installation ID with `iam create --resource INSTALLATION_ID --resource-type app`.

Manage API keys without resolving an app name or placing a key in shell arguments:

```bash
vertesia apps api-key status INSTALLATION_ID COLLECTION_ID
vertesia apps api-key set INSTALLATION_ID COLLECTION_ID --key-file api-key.txt
# A secret manager can pipe the key into the same command with --stdin instead of --key-file.
vertesia apps api-key delete INSTALLATION_ID COLLECTION_ID
```

The status contains only a configured flag and masked hint. Set and delete target only the specified
installation. For OAuth, inspect and manage the same installation's connection:

```bash
vertesia apps connections status INSTALLATION_ID
vertesia apps connections status INSTALLATION_ID COLLECTION_ID
vertesia apps connections authorize INSTALLATION_ID COLLECTION_ID
# Open authorization_url in a browser signed in as the same user and project.
# The callback completes the exchange; confirm the result:
vertesia apps connections status INSTALLATION_ID COLLECTION_ID
vertesia apps connections connect INSTALLATION_ID COLLECTION_ID
vertesia apps connections disconnect INSTALLATION_ID COLLECTION_ID
```

`authorize` starts interactive OAuth and prints its authorization URL (or reports an existing connection).
The browser callback completes the exchange. Use the same user and project in the browser as in the CLI
profile, then check connection status. Do not exchange a code that the callback has already processed.

For a callback captured without browser completion, the manual alternative is:

```bash
vertesia apps connections exchange --response-file callback.json
```

The file contains `{"code":"REPLACE_ME","state":"REPLACE_ME"}`. The server validates the state and its
installation binding. `connect` is for providers using the `client_credentials` grant. Status never
retrieves an access or refresh token.

Uninstall uses the installation ID and leaves siblings installed:

```bash
vertesia apps uninstall INSTALLATION_ID
```
