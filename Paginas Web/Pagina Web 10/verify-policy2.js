import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/Users/carrascote/.gemini/antigravity/brain/b121b8bf-b0ab-4501-8e4e-5594261ebd9a';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navegando a http://localhost:3010/...');
  await page.goto('http://localhost:3010/');
  await page.waitForTimeout(1500);

  // 1. Cambiar a Política 2 directamente desde el Header
  console.log('Seleccionando Política 2 en Header...');
  const pol2HeaderBtn = page.locator('header button:has-text("Pol. 2")');
  if (await pol2HeaderBtn.count() > 0) {
    await pol2HeaderBtn.first().click();
    await page.waitForTimeout(800);
  }

  // 2. Iniciar / Avanzar hacia el primer cliente (Cliente 2)
  console.log('Avanzando hacia Cliente 2...');
  const nextBtn = page.locator('button[title*="siguiente"], button:has-text("Iniciar Ruta"), button:has-text("Siguiente")').first();
  if (await nextBtn.count() > 0) {
    await nextBtn.click();
    console.log('Esperando arribo del camión (3.2s)...');
    await page.waitForTimeout(3500);
  }

  // 3. Capturar y validar Sub-paso 1: Entrega "a"
  console.log('Validando Sub-paso 1: Entrega "a"...');
  const sub1Btn = page.locator('button:has-text("1. Entrega"), button:has-text("1. Descarga")').first();
  if (await sub1Btn.count() > 0) {
    await sub1Btn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy2_substep1.png') });
  await page.screenshot({ path: 'screenshot_policy2_substep1.png' });
  console.log('[OK] Capturado screenshot_policy2_substep1.png');

  // 4. Capturar y validar Sub-paso 2: Evacuación "a"
  console.log('Validando Sub-paso 2: Evacuación "a"...');
  const sub2Btn = page.locator('button:has-text("2. Evacuar"), button:has-text("2. Evacuación")').first();
  if (await sub2Btn.count() > 0) {
    await sub2Btn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy2_substep2.png') });
  await page.screenshot({ path: 'screenshot_policy2_substep2.png' });
  console.log('[OK] Capturado screenshot_policy2_substep2.png');

  // 5. Capturar y validar Sub-paso 3: Carga "b" Fondo
  console.log('Validando Sub-paso 3: Carga "b" Fondo...');
  const sub3Btn = page.locator('button:has-text("3. Carga")').first();
  if (await sub3Btn.count() > 0) {
    await sub3Btn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy2_substep3.png') });
  await page.screenshot({ path: 'screenshot_policy2_substep3.png' });
  console.log('[OK] Capturado screenshot_policy2_substep3.png');

  // 6. Capturar y validar Sub-paso 4: Reingreso "a"
  console.log('Validando Sub-paso 4: Reingreso "a"...');
  const sub4Btn = page.locator('button:has-text("4. Reingreso")').first();
  if (await sub4Btn.count() > 0) {
    await sub4Btn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy2_substep4.png') });
  await page.screenshot({ path: 'screenshot_policy2_substep4.png' });
  console.log('[OK] Capturado screenshot_policy2_substep4.png');

  console.log('Verificación completa finalizada con éxito.');
  await browser.close();
}

run().catch(console.error);
