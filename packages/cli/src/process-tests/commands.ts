import fs from 'node:fs';
import { resolve } from 'node:path';
import type { ProcessTestRun, ProcessTestScenarioResult, SubmitProcessTestRunPayload } from '@vertesia/common';
import colors from 'ansi-colors';
import type { Command } from 'commander';
import { getClient } from '../client.js';

/** All scenarios passed. */
const EXIT_PASSED = 0;
/** The run reached a terminal state that is not `passed`, or the wait budget ran out. */
const EXIT_FAILED = 1;
/** The command could not test anything: bad input file, bad payload, or an API error. */
const EXIT_INVALID = 2;

const TERMINAL_STATUSES = ['passed', 'failed', 'cancelled'];

export interface RunProcessTestsOptions {
    wait?: boolean;
    timeout?: string;
    pollInterval?: string;
    appVersion?: string;
    json?: boolean;
}

export interface GetProcessTestRunOptions {
    watch?: boolean;
    timeout?: string;
    pollInterval?: string;
    json?: boolean;
}

export interface CancelProcessTestRunOptions {
    json?: boolean;
}

class CliFailure extends Error {
    constructor(
        readonly code: number,
        message: string,
    ) {
        super(message);
    }
}

function invalid(message: string): never {
    throw new CliFailure(EXIT_INVALID, message);
}

/**
 * Runs the command body and sets the process exit status from it. Anything the command did not
 * classify itself — an API error, a network failure — means no test result was produced, so it
 * exits 2.
 *
 * The status is set on `process.exitCode` rather than through `process.exit()`: forcing an exit
 * here would drop whatever is still buffered on a piped stdout, which is exactly how `--json` is
 * consumed in CI.
 */
async function runCommand(body: () => Promise<number>): Promise<void> {
    try {
        process.exitCode = await body();
    } catch (err: unknown) {
        if (err instanceof CliFailure) {
            console.error(colors.red(err.message));
            process.exitCode = err.code;
            return;
        }
        console.error(colors.red(err instanceof Error ? err.message : String(err)));
        process.exitCode = EXIT_INVALID;
    }
}

function positiveSeconds(value: string | undefined, fallback: number, name: string): number {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        invalid(`Invalid ${name}: ${value}. Expected a positive number of seconds.`);
    }
    return parsed;
}

function loadPayload(file: string, appVersion?: string): SubmitProcessTestRunPayload {
    const path = resolve(file);
    let content: string;
    try {
        content = fs.readFileSync(path, 'utf-8');
    } catch (_err: unknown) {
        return invalid(`Cannot read process test file: ${path}`);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch (err: unknown) {
        return invalid(`Invalid JSON in ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return invalid(`Invalid process test file ${path}: expected a JSON object.`);
    }
    const payload = parsed as Partial<SubmitProcessTestRunPayload>;
    if (!payload.process || typeof payload.process !== 'object') {
        return invalid(`Invalid process test file ${path}: missing "process".`);
    }
    if (!Array.isArray(payload.scenarios) || payload.scenarios.length === 0) {
        return invalid(`Invalid process test file ${path}: "scenarios" must be a non-empty array.`);
    }
    // The server is the schema authority for the rest of the payload: it resolves the target,
    // validates the scenarios against the resolved definition, and rejects what it cannot run.
    let target = payload.process;
    if (appVersion !== undefined) {
        // Only an app package has a version to pin, so catch the mismatch here rather than sending
        // a payload the server is bound to reject.
        const id = 'id' in target ? target.id : undefined;
        if (typeof id !== 'string' || !id.startsWith('app:')) {
            invalid(
                `--app-version only applies to an "app:" process, but ${path} targets ` +
                    `${id ? `"${id}"` : 'an inline definition'}.`,
            );
        }
        target = { ...target, app_version: appVersion };
    }
    return { ...payload, process: target } as SubmitProcessTestRunPayload;
}

function describeSubject(run: ProcessTestRun): string {
    const subject = run.subject;
    switch (subject.kind) {
        case 'stored':
            return `stored process ${subject.process_root_id} (revision ${subject.process_revision_id})`;
        case 'resolved':
            return subject.app_version
                ? `${subject.process_id} @ ${subject.app_version}`
                : `${subject.process_id} (unpinned version)`;
        default:
            return 'inline definition';
    }
}

function statusColor(status: string): string {
    switch (status) {
        case 'passed':
            return colors.green(status);
        case 'failed':
            return colors.red(status);
        case 'cancelled':
            return colors.yellow(status);
        default:
            return colors.gray(status);
    }
}

/** One line per poll, so a CI log stays readable while a long run progresses. */
function progressLine(run: ProcessTestRun): string {
    const done = run.scenarios.filter((s) => TERMINAL_STATUSES.includes(s.status)).length;
    const passed = run.scenarios.filter((s) => s.status === 'passed').length;
    return `${run.status} — ${done}/${run.scenarios.length} scenarios done, ${passed} passed`;
}

function printScenario(scenario: ProcessTestScenarioResult, log: (line: string) => void) {
    log(`  ${statusColor(scenario.status)}  ${scenario.scenario_id} — ${scenario.name}`);
    if (scenario.error) {
        log(colors.red(`      error: ${scenario.error}`));
    }
    for (const assertion of scenario.assertions) {
        if (assertion.passed) continue;
        const detail =
            assertion.message ??
            `expected ${JSON.stringify(assertion.expected)}, got ${JSON.stringify(assertion.actual)}`;
        log(colors.red(`      ✗ ${assertion.assertion}: ${detail}`));
    }
}

function printRun(run: ProcessTestRun, log: (line: string) => void) {
    log(colors.bold(`Process test run ${run.id} — ${statusColor(run.status)}`));
    log(colors.gray(`  subject: ${describeSubject(run)}`));
    log(colors.gray(`  definition hash: ${run.definition_hash}${run.stale ? colors.yellow(' (stale)') : ''}`));
    for (const scenario of run.scenarios) {
        printScenario(scenario, log);
    }
}

/** `passed` is the only success. Everything else — failures, cancellation, timeouts — is exit 1. */
function exitCodeForStatus(status: string): number {
    return status === 'passed' ? EXIT_PASSED : EXIT_FAILED;
}

async function waitForTerminal(
    client: Awaited<ReturnType<typeof getClient>>,
    runId: string,
    timeoutSeconds: number,
    pollSeconds: number,
    log: (line: string) => void,
): Promise<ProcessTestRun | undefined> {
    const deadline = Date.now() + timeoutSeconds * 1000;
    let last = '';
    for (;;) {
        const run = await client.store.processTestRuns.retrieve(runId);
        if (TERMINAL_STATUSES.includes(run.status)) {
            return run;
        }
        const line = progressLine(run);
        if (line !== last) {
            log(colors.gray(`  ${line}`));
            last = line;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            return undefined;
        }
        // The last sleep is shortened to land exactly on the deadline, so the run is always read
        // once more at the deadline instead of the wait being cut a whole interval short.
        await new Promise((r) => setTimeout(r, Math.min(pollSeconds * 1000, remaining)));
    }
}

export function runProcessTests(program: Command, file: string, options: RunProcessTestsOptions) {
    return runCommand(async () => {
        const json = Boolean(options.json);
        // Keep stdout reserved for the JSON document when --json is used.
        const log = (line: string) => (json ? console.error(line) : console.log(line));
        const timeout = positiveSeconds(options.timeout, 900, '--timeout');
        const poll = positiveSeconds(options.pollInterval, 5, '--poll-interval');
        const payload = loadPayload(file, options.appVersion);

        const client = await getClient(program);
        // Submitting is not idempotent and the API has no request key, so a failed POST is
        // reported rather than retried: a retry could start a second run.
        const submitted = await client.store.processTestRuns.submit(payload);
        log(colors.bold(`Started process test run ${submitted.id} (${describeSubject(submitted)})`));

        if (options.wait === false) {
            if (json) console.log(JSON.stringify(submitted, null, 2));
            return EXIT_PASSED;
        }

        const run = await waitForTerminal(client, submitted.id, timeout, poll, log);
        if (!run) {
            log(colors.red(`Timed out after ${timeout}s waiting for run ${submitted.id}.`));
            log(colors.gray(`  The run is still going: vertesia process-tests get ${submitted.id} --watch`));
            return EXIT_FAILED;
        }
        if (json) {
            console.log(JSON.stringify(run, null, 2));
        } else {
            printRun(run, log);
        }
        return exitCodeForStatus(run.status);
    });
}

export function getProcessTestRun(program: Command, runId: string, options: GetProcessTestRunOptions) {
    return runCommand(async () => {
        const json = Boolean(options.json);
        const log = (line: string) => (json ? console.error(line) : console.log(line));
        const timeout = positiveSeconds(options.timeout, 900, '--timeout');
        const poll = positiveSeconds(options.pollInterval, 5, '--poll-interval');
        const client = await getClient(program);

        let run = await client.store.processTestRuns.retrieve(runId);
        if (options.watch && !TERMINAL_STATUSES.includes(run.status)) {
            const terminal = await waitForTerminal(client, runId, timeout, poll, log);
            if (!terminal) {
                log(colors.red(`Timed out after ${timeout}s waiting for run ${runId}.`));
                return EXIT_FAILED;
            }
            run = terminal;
        }

        if (json) {
            console.log(JSON.stringify(run, null, 2));
        } else {
            printRun(run, log);
        }
        // A run still in flight is not a failure — only a terminal non-passed status is.
        return TERMINAL_STATUSES.includes(run.status) ? exitCodeForStatus(run.status) : EXIT_PASSED;
    });
}

export function cancelProcessTestRun(program: Command, runId: string, options: CancelProcessTestRunOptions) {
    return runCommand(async () => {
        const client = await getClient(program);
        const run = await client.store.processTestRuns.cancel(runId);
        if (options.json) {
            console.log(JSON.stringify(run, null, 2));
        } else {
            console.log(`Process test run ${run.id} — ${statusColor(run.status)}`);
        }
        return EXIT_PASSED;
    });
}
