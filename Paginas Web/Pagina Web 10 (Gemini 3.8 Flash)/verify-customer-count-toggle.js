import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/MatiasPC/.gemini/antigravity/brain/aecbd27c-0cdd-46b5-85ee-69b632570ff3';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navegando a http://localhost:3010/...');
  await page.goto('http://localhost:3010/');
  await page.waitForTimeout(2000);

  // 1. Capturar pantalla principal inicial con 10 clientes
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_10_clientes_initial.png') });
  console.log('[OK] Capturado screenshot_10_clientes_initial.png');

  // 2. Abrir el Explorador de Soluciones
  console.log('Abriendo Explorador de Soluciones...');
  const openModalBtn = page.locator('header button:has-text("Explorar Soluciones")');
  await openModalBtn.click();
  await page.waitForTimeout(1000);

  // 3. Capturar modal con vista activa de 10 clientes
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_modal_10_clientes.png') });
  console.log('[OK] Capturado screenshot_modal_10_clientes.png');

  // 4. Probar el botón para cambiar a 5 Clientes
  console.log('Cambiando a 5 Clientes en el selector del modal...');
  const btn5Clientes = page.locator('button:has-text("5 Clientes")');
  await btn5Clientes.click();
  await page.waitForTimeout(800);

  // 5. Capturar modal con vista activa de 5 clientes
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_modal_5_clientes.png') });
  console.log('[OK] Capturado screenshot_modal_5_clientes.png');

  // 6. Volver a seleccionar 10 Clientes y elegir ID #1
  console.log('Volviendo a 10 Clientes y seleccionando ID #1...');
  const btn10Clientes = page.locator('button:has-text("10 Clientes")');
  await btn10Clientes.click();
  await page.waitForTimeout(600);

  const cardId1 = page.locator('div:has-text("ID #1")').first();
  await cardId1.click();
  await page.waitForTimeout(1000);

  // 7. Cambiar de política a Política 3 manteniendo 10 Clientes
  console.log('Cambiando a Política 3 en Header...');
  const pol3Btn = page.locator('header button:has-text("Pol. 3")');
  await pol3Btn.click();
  await page.waitForTimeout(1000);

  // 8. Capturar vista final con Política 3 y 10 Clientes
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_10_clientes_pol3.png') });
  console.log('[OK] Capturado screenshot_10_clientes_pol3.png');

  console.log('Validación Playwright completada con éxito.');
  await browser.close();
}

run().catch((err) => {
  console.error('Error durante la validación:', err);
  process.exit(1);
});
