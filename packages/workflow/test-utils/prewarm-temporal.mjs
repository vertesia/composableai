// Downloads both Temporal server binaries into the cache before the test suites run, with the full CI-step
// budget rather than a test hook's timeout, so that every suite finds them on disk.
// Safe to run repeatedly: a cached download is skipped when the binary is already present.
import { createLocalTestEnvironment, createTimeSkippingTestEnvironment } from './temporal-environment.mjs';

for (const [name, create] of [
    ['time-skipping test server', createTimeSkippingTestEnvironment],
    ['local dev server (CLI)', createLocalTestEnvironment],
]) {
    console.log(`[prewarm] ensuring Temporal ${name} binary`);
    const env = await create();
    await env.teardown();
    console.log(`[prewarm] Temporal ${name} binary ready`);
}
