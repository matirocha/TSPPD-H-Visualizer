import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3010/...');
  await page.goto('http://localhost:3010/');
  await page.waitForTimeout(2000);

  // 1. Open Solution Selector modal
  const explorerBtn = page.locator('button:has-text("Explorar")');
  if (await explorerBtn.count() > 0) {
    await explorerBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot_test_modal_catalog.png' });
    console.log('[OK] Saved screenshot_test_modal_catalog.png');

    // Click Pol. 3 filter inside modal
    const pol3Filter = page.locator('div[role="dialog"], .fixed').locator('button:has-text("Pol. 3")');
    if (await pol3Filter.count() > 0) {
      await pol3Filter.first().click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: 'screenshot_test_modal_catalog_pol3.png' });
      console.log('[OK] Saved screenshot_test_modal_catalog_pol3.png');
    }

    // Close modal
    const closeBtn = page.locator('div[role="dialog"], .fixed').locator('button:has-text("Cerrar"), button:has(svg.lucide-x)');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 2. Open Model Formula Modal
  const modelBtn = page.locator('button:has-text("Modelo")');
  if (await modelBtn.count() > 0) {
    await modelBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot_test_modal_formulas.png' });
    console.log('[OK] Saved screenshot_test_modal_formulas.png');

    // Click Pol. 2 tab
    const tabPol2 = page.locator('button:has-text("Pol. 2 (Front)")');
    if (await tabPol2.count() > 0) {
      await tabPol2.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshot_test_modal_pol2_formulas.png' });
      console.log('[OK] Saved screenshot_test_modal_pol2_formulas.png');
    }

    // Click Pol. 3 tab
    const tabPol3 = page.locator('button:has-text("Pol. 3 (Híbrida)")');
    if (await tabPol3.count() > 0) {
      await tabPol3.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshot_test_modal_pol3_formulas.png' });
      console.log('[OK] Saved screenshot_test_modal_pol3_formulas.png');
    }
  }

  await browser.close();
  console.log('Testing finished successfully!');
}

run().catch(console.error);
