import colors from 'ansi-colors';
import type { Command } from 'commander';
import { getClient } from '../client.js';

function bar(used: number, limit: number): string {
    if (limit <= 0) return '';
    const pct = Math.min(100, Math.round((used / limit) * 100));
    return `${pct}%`;
}

export async function showStanding(program: Command, options: { json?: boolean }) {
    const client = await getClient(program);
    const standing = await client.quota.standing();

    if (options.json) {
        console.log(JSON.stringify(standing, null, 2));
        return;
    }

    console.log(
        colors.bold(
            `Quota standing for tenant ${standing.tenant_id}  ` +
                `(effective tier: ${standing.effective_tier}; base tier: ${standing.base_tier})`,
        ),
    );

    if (!standing.available) {
        console.log(
            colors.yellow(
                '\n⚠ Standing unavailable: the rate-limit store is unreachable, so usage/limits could not be read. ' +
                    'Limiters fail open in this state (requests are allowed), so this does NOT mean there are no limits.',
            ),
        );
        return;
    }

    console.log(colors.bold('\nAPI rate limits (per-tenant):'));
    console.log(colors.gray('  resource         burst (used/limit)      quota (used/limit)'));
    for (const r of standing.api) {
        const burst = `${r.burst.used}/${r.burst.limit} (${bar(r.burst.used, r.burst.limit)})`;
        const quota = `${r.quota.used}/${r.quota.limit} (${bar(r.quota.used, r.quota.limit)})`;
        console.log(`  ${r.resource.padEnd(15)} ${burst.padEnd(23)} ${quota}`);
    }

    console.log(colors.bold('\nWorkflow admission (your active slots):'));
    if (standing.admission.classes.length === 0) {
        console.log(colors.gray('  (none)'));
    } else {
        for (const c of standing.admission.classes) {
            console.log(`  ${c.class.padEnd(28)} active=${c.tenant_active}`);
        }
    }
    console.log(colors.gray(`  ${standing.admission.note}`));

    console.log(colors.bold('\nLLM limiter:'));
    console.log(colors.gray(`  ${standing.llm.note}`));
}
