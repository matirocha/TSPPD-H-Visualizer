import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/Users/carrascote/.gemini/antigravity/brain/bac6f80e-7b39-41a8-ac35-d9874d055835';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Navegando a http://localhost:3010/...');
  await page.goto('http://localhost:3010/');
  await page.waitForTimeout(1500);

  // Seleccionar Política 3 en el Header
  console.log('2. Seleccionando Política 3 en Header...');
  const pol3HeaderBtn = page.locator('header button:has-text("Pol. 3")');
  await pol3HeaderBtn.first().click();
  await page.waitForTimeout(1000);

  // Captura estado inicial de Política 3
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy3_initial.png') });
  await page.screenshot({ path: 'screenshot_policy3_initial.png' });
  console.log('[OK] Capturado screenshot_policy3_initial.png');

  // Buscar pasos con P1 y P2 en la línea de tiempo
  const stepBtns = page.locator('button[data-step-btn]');
  const count = await stepBtns.count();
  console.log(`Encontrados ${count} botones de pasos en la línea de tiempo.`);

  for (let i = 0; i < count; i++) {
    const btn = stepBtns.nth(i);
    const text = await btn.innerText();
    console.log(`Paso ${i + 1}: ${text.replace(/\n/g, ' ')}`);
  }

  // Hacer click en el paso 1 (hacia primer cliente)
  console.log('3. Clickeando en Paso 1...');
  await stepBtns.nth(0).click();
  await page.waitForTimeout(1000);

  // Verificar si hay banner de decisión en LifoCargoBay
  const banner = page.locator('text=Decisión de Política (TSPPD-H_3)');
  const bannerCount = await banner.count();
  console.log(`Banners de Decisión encontrados: ${bannerCount}`);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy3_step1.png') });
  await page.screenshot({ path: 'screenshot_policy3_step1.png' });
  console.log('[OK] Capturado screenshot_policy3_step1.png');

  // Recorrer los pasos buscando uno con Política 2
  console.log('4. Buscando un paso con Política 2...');
  for (let i = 0; i < count; i++) {
    await stepBtns.nth(i).click();
    await page.waitForTimeout(800);
    const pageContent = await page.content();
    if (pageContent.includes('POLÍTICA 2') && !pageContent.includes('Parada en depósito')) {
      console.log(`¡Paso ${i + 1} tiene Política 2!`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy3_pol2_active.png') });
      await page.screenshot({ path: 'screenshot_policy3_pol2_active.png' });
      console.log('[OK] Capturado screenshot_policy3_pol2_active.png');
      break;
    }
  }

  // Recorrer los pasos buscando uno con Política 1
  console.log('5. Buscando un paso con Política 1...');
  for (let i = 0; i < count; i++) {
    await stepBtns.nth(i).click();
    await page.waitForTimeout(800);
    const pageContent = await page.content();
    if (pageContent.includes('POLÍTICA 1 (s_i = 1)')) {
      console.log(`¡Paso ${i + 1} tiene Política 1!`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_policy3_pol1_active.png') });
      await page.screenshot({ path: 'screenshot_policy3_pol1_active.png' });
      console.log('[OK] Capturado screenshot_policy3_pol1_active.png');
      break;
    }
  }

  await browser.close();
  console.log('Validación finalizada con éxito.');
}

run().catch((err) => {
  console.error('Error en validación:', err);
  process.exit(1);
});
