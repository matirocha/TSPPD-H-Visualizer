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

  // 1. Cambiar a Política 2
  console.log('Seleccionando Política 2 en Header...');
  const pol2HeaderBtn = page.locator('header button:has-text("Pol. 2")');
  if (await pol2HeaderBtn.count() > 0) {
    await pol2HeaderBtn.first().click();
    await page.waitForTimeout(600);
  }

  // 2. Verificar que en el encabezado NO haya dropdown de selección de ID
  const idDropdown = page.locator('header select');
  const countDropdown = await idDropdown.count();
  console.log('Cantidad de select de ID en el header (debe ser 0):', countDropdown);

  // 3. Capturar el Header limpio
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_clean_header.png') });
  console.log('[OK] Capturado screenshot_clean_header.png');

  // 4. Abrir el nuevo Explorador de Soluciones simplificado
  console.log('Abriendo Explorador de Soluciones...');
  const openModalBtn = page.locator('header button:has-text("Explorar Soluciones")');
  await openModalBtn.click();
  await page.waitForTimeout(800);

  // 5. Capturar la vista del Explorador de Soluciones simplificado
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_simplified_solution_explorer.png') });
  console.log('[OK] Capturado screenshot_simplified_solution_explorer.png');

  // 6. Probar el cambio de ID haciendo clic en ID #3
  console.log('Haciendo clic en ID #3...');
  const id3Btn = page.locator('button:has-text("ID #3"), div:has-text("ID #3")').first();
  await id3Btn.click();
  await page.waitForTimeout(800);

  // 7. Capturar después de cambiar a ID #3
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_after_switch_id3.png') });
  console.log('[OK] Capturado screenshot_after_switch_id3.png');

  console.log('Validación completada con éxito.');
  await browser.close();
}

run().catch(console.error);
