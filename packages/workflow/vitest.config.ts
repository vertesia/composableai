import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds instead of default 5 seconds
    hookTimeout: 30000, // Also increase hook timeout for beforeAll/afterAll
  },
});