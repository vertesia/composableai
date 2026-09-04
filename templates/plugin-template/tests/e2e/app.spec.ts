import { expect, test } from './vertesia';

const CONFIG__PLUGIN_TITLE = 'Ui Plugin Template';

test('renders the primary app flow', async ({ page }) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is required');

    await page.goto(baseURL);

    const primaryHeading = page.getByRole('heading', { name: CONFIG__PLUGIN_TITLE });
    await expect(primaryHeading).toBeVisible();

    await page.reload();
    await expect(primaryHeading).toBeVisible();
});
