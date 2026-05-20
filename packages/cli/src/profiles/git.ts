import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { ensureProfileAccessToken } from './auth.js';
import { config, type Profile } from './index.js';

interface GitAuthOptions {
    profile?: string;
    url?: string;
    alias?: boolean;
}

interface GitCredentialInput {
    protocol?: string;
    host?: string;
    path?: string;
}

export async function configureGitAuth(options: GitAuthOptions = {}) {
    const profile = getRequestedProfile(options.profile);
    const gitBaseUrl = normalizeGitBaseUrl(options.url || gitServerUrlForProfile(profile));
    const helper = `!vertesia auth git credential --profile ${shellQuote(profile.name)}`;

    gitConfig('--global', `credential.${gitBaseUrl}.helper`, helper);
    gitConfig('--global', `credential.${gitBaseUrl}.useHttpPath`, 'true');

    if (options.alias !== false) {
        removeKnownVertesiaAliases();
        gitConfig('--global', `url.${gitBaseUrl}/.insteadOf`, 'vertesia:');
    }

    console.log(`Configured Git authentication for ${gitBaseUrl}`);
    console.log(`Clone with: git clone ${gitBaseUrl}/<app-slug>.git`);
    if (options.alias !== false) {
        console.log('Short alias: git clone vertesia:<app-slug>.git');
    }
}

export async function serveGitCredential(action: string | undefined, options: Pick<GitAuthOptions, 'profile'> = {}) {
    if (!action || action === 'get') {
        const envToken = process.env.VERTESIA_AUTH_TOKEN || process.env.VERTESIA_TOKEN;
        if (envToken) {
            writeCredential(envToken);
            return;
        }

        const input = await readCredentialInput();
        const profile = pickProfileForCredential(input, options.profile);
        if (!profile) {
            if (options.profile) {
                throw new Error(
                    `Vertesia profile '${options.profile}' was not found. Run \`vertesia auth git\` from an active profile.`,
                );
            }
            throw new Error(
                `No Vertesia profile matches git host ${input.host || '<unknown>'}. Run \`vertesia auth git\`.`,
            );
        }

        const token = await ensureProfileAccessToken(profile);
        if (!token) {
            throw new Error(`Profile ${profile.name} has no usable auth token. Run \`vertesia auth refresh\`.`);
        }
        writeCredential(token);
        return;
    }

    // Git may call helpers with store/erase. Tokens are managed by Vertesia CLI
    // profile auth, so there is nothing useful to persist from Git.
}

function getRequestedProfile(profileName?: string): Profile {
    if (profileName) {
        const profile = config.getProfile(profileName);
        if (!profile) throw new Error(`Profile ${profileName} not found.`);
        return profile;
    }
    if (!config.current) {
        throw new Error(
            'No Vertesia profile is selected. Run `vertesia auth login` or `vertesia profiles use <name>`.',
        );
    }
    return config.current;
}

function pickProfileForCredential(input: GitCredentialInput, profileName?: string): Profile | undefined {
    if (profileName) {
        return config.getProfile(profileName);
    }
    const host = input.host?.toLowerCase();
    if (!host) return config.current;
    if (config.current && gitHostForProfile(config.current) === host) {
        return config.current;
    }
    return config.profiles.find(profile => gitHostForProfile(profile) === host);
}

function gitHostForProfile(profile: Profile): string | undefined {
    try {
        return new URL(gitServerUrlForProfile(profile)).hostname.toLowerCase();
    } catch {
        return undefined;
    }
}

function gitServerUrlForProfile(profile: Profile): string {
    const override = process.env.VERTESIA_GIT_SERVER_URL
        || process.env.APP_GIT_SERVER_URL
        || process.env.APPGEN_GIT_SERVER_URL;
    if (override) return normalizeGitBaseUrl(override);

    const sourceUrl = profile.studio_server_url || profile.zeno_server_url || profile.config_url;
    try {
        const url = new URL(sourceUrl);
        const host = url.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
            return 'https://git.dev1.vertesia.io';
        }
        if (host === 'api.vertesia.io' || host === 'api-preview.vertesia.io') {
            return 'https://git.vertesia.io';
        }
        if (host.startsWith('api-preview.')) {
            return `https://${host.replace(/^api-preview\./, 'git.')}`;
        }
        if (host.startsWith('api.')) {
            return `https://${host.replace(/^api\./, 'git.')}`;
        }

        const parts = host.split('.');
        const apiIndex = parts.indexOf('api');
        const region = apiIndex >= 0 ? parts[apiIndex + 1] : undefined;
        if (region && parts[apiIndex + 2] === 'vertesia') {
            return `https://git.${region}.vertesia.io`;
        }
    } catch {
        // Fall through to profile region/default below.
    }

    if (profile.region) return `https://git.${profile.region}.vertesia.io`;
    return 'https://git.dev1.vertesia.io';
}

function normalizeGitBaseUrl(value: string): string {
    const normalized = value.replace(/\/+$/, '');
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        throw new Error(`Git server URL must be an http(s) URL: ${value}`);
    }
    return normalized;
}

function gitConfig(...args: string[]) {
    execFileSync('git', ['config', ...args], { stdio: 'pipe' });
}

function removeKnownVertesiaAliases() {
    let raw: string;
    try {
        raw = execFileSync('git', ['config', '--global', '--get-regexp', '^url\\..*\\.insteadOf$'], {
            stdio: ['ignore', 'pipe', 'ignore'],
            encoding: 'utf8',
        });
    } catch {
        // No matching keys, or no global config — nothing to clean up.
        return;
    }
    for (const line of raw.split('\n')) {
        const space = line.indexOf(' ');
        if (space < 0) continue;
        const key = line.slice(0, space);
        const value = line.slice(space + 1);
        if (value !== 'vertesia:') continue;
        try {
            execFileSync('git', ['config', '--global', '--unset-all', key, '^vertesia:$'], { stdio: 'ignore' });
        } catch {
            // Best-effort; ignore if the key disappears between read and unset.
        }
    }
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function readCredentialInput(): Promise<GitCredentialInput> {
    const text = await readStdin();
    const input: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
        if (!line) break;
        const separator = line.indexOf('=');
        if (separator < 0) continue;
        input[line.slice(0, separator)] = line.slice(separator + 1);
    }
    return input;
}

function readStdin(): Promise<string> {
    return new Promise((resolve, reject) => {
        let text = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => {
            text += chunk;
        });
        process.stdin.on('end', () => resolve(text));
        process.stdin.on('error', reject);
        if (process.stdin.isTTY) {
            resolve('');
        }
    });
}

function writeCredential(token: string) {
    process.stdout.write(`username=vertesia\npassword=${token}\n`);
}
