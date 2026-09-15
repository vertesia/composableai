import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const hasVertesiaAuth = Boolean(process.env.VERTESIA_TOKEN);
if (!baseURL) {
    throw new Error('PLAYWRIGHT_BASE_URL must point to the public app preview URL.');
}

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    reporter: 'line',
    use: {
        ...devices['Desktop Chrome'],
        baseURL,
        ignoreHTTPSErrors: true,
        // Authenticated traces retain request headers. Keep them disabled when the workflow token
        // is present so a failed generated-app test cannot persist that credential in artifacts.
        trace: hasVertesiaAuth ? 'off' : 'retain-on-failure',
    },
});
