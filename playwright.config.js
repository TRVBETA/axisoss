import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});