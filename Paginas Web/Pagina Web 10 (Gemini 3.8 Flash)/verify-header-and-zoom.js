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

  // 1. Verificación del encabezado
  console.log('2. Verificando el nuevo encabezado limpio...');
  const header = page.locator('header');
  const headerText = await header.innerText();

  console.log('Header text:', headerText.replace(/\n/g, ' '));
  const hasOldSubtitle = headerText.includes('Simulación de ruteo y dinámica física');
  const hasOldBadge = headerText.includes('TSPPD-H_3 (Pol. 3)');
  console.log('¿Contiene subtítulo antiguo?:', hasOldSubtitle, '(esperado: false)');
  console.log('¿Contiene badge antiguo en título?:', hasOldBadge, '(esperado: false)');

  // 2. Verificación de "Carga Camión"
  console.log('3. Verificando sustitución de "estiba" por "carga"...');
  const cargaCamion = page.locator('text=Carga Camión');
  const cargaCamionVisible = await cargaCamion.isVisible();
  console.log('¿Visible "Carga Camión"?:', cargaCamionVisible, '(esperado: true)');

  const estibaText = page.locator('text=/estiba/i');
  const estibaCount = await estibaText.count();
  console.log('Elementos visibles con palabra "estiba":', estibaCount, '(esperado: 0)');

  // 3. Verificación del botón de Zoom en el mapa
  console.log('4. Verificando botón de Zoom en el mapa...');
  const zoomBtn = page.locator('button[title*="Aumentar zoom"]');
  const zoomBtnVisible = await zoomBtn.isVisible();
  console.log('¿Botón de Zoom visible?:', zoomBtnVisible);
  console.log('Texto inicial del botón de Zoom:', await zoomBtn.innerText());

  // Captura inicial
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_header_and_map_initial.png') });
  await page.screenshot({ path: 'screenshot_header_and_map_initial.png' });

  // Clic 1 en Zoom
  console.log('5. Clic en botón de Zoom (1er incremento)...');
  await zoomBtn.click();
  await page.waitForTimeout(600);
  console.log('Texto tras 1er zoom:', await zoomBtn.innerText());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_map_zoom1.png') });
  await page.screenshot({ path: 'screenshot_map_zoom1.png' });

  // Clic 2 en Zoom
  console.log('6. Clic en botón de Zoom (2do incremento)...');
  await zoomBtn.click();
  await page.waitForTimeout(600);
  console.log('Texto tras 2do zoom:', await zoomBtn.innerText());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_map_zoom2.png') });
  await page.screenshot({ path: 'screenshot_map_zoom2.png' });

  // Restablecer zoom con botón de reset
  console.log('7. Clic en botón de Restablecer zoom...');
  const resetZoomBtn = page.locator('button[title*="Restablecer zoom"]');
  await resetZoomBtn.click();
  await page.waitForTimeout(600);
  console.log('Texto tras reset:', await zoomBtn.innerText());

  await browser.close();
  console.log('Verificación finalizada con éxito.');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
