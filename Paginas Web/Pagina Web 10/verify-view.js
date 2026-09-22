import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  
  // Standard laptop resolution: 1440x900
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Cargando http://localhost:3010/ ...');
  await page.goto('http://localhost:3010/');
  await page.waitForTimeout(2000);

  // Take screenshot of initial depot state
  await page.screenshot({ path: 'screenshot_v2_initial_1440x900.png' });
  console.log('[OK] Guardada screenshot_v2_initial_1440x900.png');

  // Select Policy 2 solution to verify the 4 substeps
  const pol2Pill = page.locator('button:has-text("Pol. 2")').first();
  if (await pol2Pill.count() > 0) {
    await pol2Pill.click();
    await page.waitForTimeout(1500);
  }

  // Click Step 2 (Cliente 2 arrival)
  const step2Btn = page.locator('button[data-step-btn="2"]');
  if (await step2Btn.count() > 0) {
    await step2Btn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshot_v2_client2_substep1.png' });
    console.log('[OK] Guardada screenshot_v2_client2_substep1.png');
  }

  // Click Sub-step 2
  const subStep2Btn = page.locator('button:has-text("2. Evacuar")');
  if (await subStep2Btn.count() > 0) {
    await subStep2Btn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'screenshot_v2_client2_substep2.png' });
    console.log('[OK] Guardada screenshot_v2_client2_substep2.png');
  }

  // Click Sub-step 3
  const subStep3Btn = page.locator('button:has-text("3. Carga β")');
  if (await subStep3Btn.count() > 0) {
    await subStep3Btn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'screenshot_v2_client2_substep3.png' });
    console.log('[OK] Guardada screenshot_v2_client2_substep3.png');
  }

  // Check visibility of both Map and Cargo Bay simultaneously in viewport
  const mapBox = await page.locator('text=Mapa de Ruta y Topología').boundingBox();
  const cargoBox = await page.locator('text=Compartimiento LIFO').boundingBox();
  const explanationBox = await page.locator('text=Entrega:').first().boundingBox();
  const controlsBox = await page.locator('text=Progreso:').boundingBox();

  console.log('Posiciones verticales en viewport 1440x900:');
  console.log(' - Mapa Header Y:', mapBox?.y, 'Alto:', mapBox?.height);
  console.log(' - Controles Y:', controlsBox?.y, 'Alto:', controlsBox?.height);
  console.log(' - Bahía LIFO Y:', cargoBox?.y, 'Alto:', cargoBox?.height);
  console.log(' - Explicación inferior Y:', explanationBox?.y, 'Alto:', explanationBox?.height);

  const maxBottom = Math.max(
    (controlsBox?.y || 0) + (controlsBox?.height || 0),
    (explanationBox?.y || 0) + (explanationBox?.height || 0)
  );
  console.log(`Punto más bajo de la interfaz principal: ${maxBottom}px (Límite viewport: 900px)`);

  if (maxBottom <= 900) {
    console.log('✅ ÉXITO: Toda la interfaz principal (mapa + controles + compartimiento + explicación) cabe perfectamente en pantalla sin scroll!');
  } else {
    console.log(`⚠️ Alerta: El contenido excede por ${maxBottom - 900}px`);
  }

  await browser.close();
}

main().catch(console.error);
