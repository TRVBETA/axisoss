import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

test('library renders empty state and upload card cleanly', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');
  await page.waitForTimeout(800);

  const libraryTab = page.locator('text=LIBRARY').first();
  if (await libraryTab.count() > 0) {
    await libraryTab.click();
  }

  await expect(page.locator('#module-library')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.cockpit-card:has-text("LIBRARY EMPTY")')).toBeVisible();
  await expect(page.locator('text=UPLOAD')).toBeVisible();
});

test('library book card shows percent progress and OPEN button (old 320 totals normalized to 100%)', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/index.html');
  await page.evaluate(() => {
    localStorage.setItem('axis_library_meta', JSON.stringify([{
      id: 'lib-test1',
      title: 'Dune Messiah',
      author: 'Frank Herbert',
      type: 'epub',
      currPage: 87,
      totalPages: 320, // old fake total; client normalizes to 0-100
      carryForward: true,
      created_at: new Date().toISOString()
    }]));
  });
  await page.reload();
  await page.waitForTimeout(600);

  const card = page.locator('.cockpit-card:has-text("Dune Messiah")');
  await expect(card).toBeVisible();
  await expect(card.locator('text=87% read')).toBeVisible();
  await expect(card.locator('button:has-text("OPEN")')).toBeVisible();
  // Fake page-step buttons removed.
  await expect(card.locator('button:has-text("+10")')).toHaveCount(0);
});
