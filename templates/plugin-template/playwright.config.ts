import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
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
        trace: 'retain-on-failure',
    },
});
