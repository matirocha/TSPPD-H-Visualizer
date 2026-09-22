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

  // 1. Verificación del título y encabezado del mapa
  console.log('2. Verificando card del Mapa de Ruteo...');
  const mapTitle = page.locator('h3:has-text("Mapa de Ruteo")');
  console.log('¿Título "Mapa de Ruteo" visible?:', await mapTitle.isVisible());

  const oldLegend = page.locator('text=Depósito');
  // Verifica si existe leyenda en el card del mapa
  const nodesBadge = page.locator('text=6 Nodos');
  console.log('¿Badge "6 Nodos" visible?:', await nodesBadge.isVisible(), '(esperado: false)');

  const oldSub = page.locator('text=Disposición circular con arcos curvos');
  console.log('¿Subtítulo del mapa visible?:', await oldSub.isVisible(), '(esperado: false)');

  // 2. Verificación de eliminación de textos antiguos del mapa
  console.log('3. Verificando eliminación de textos de estado del camión en el mapa...');
  const oldStatusText = page.locator('text=Estado del camión:');
  console.log('¿Texto "Estado del camión:" presente?:', await oldStatusText.count() > 0, '(esperado: false)');

  const oldListoText = page.locator('text=Listo para iniciar · Depósito Central');
  console.log('¿Texto "Listo para iniciar · Depósito Central" presente?:', await oldListoText.count() > 0, '(esperado: false)');

  // 3. Verificación de controles de reproducción integrados en la misma card
  console.log('4. Verificando controles de reproducción integrados en la card del mapa...');
  const playBtn = page.locator('button:has-text("Iniciar Ruta"), button:has-text("Reanudar"), button:has-text("Pausar")');
  console.log('¿Botón de reproducción presente en la card?:', await playBtn.isVisible());

  const step1Btn = page.locator('button[data-step-btn="1"]');
  console.log('¿Botón timeline Paso 1 presente en la card?:', await step1Btn.isVisible());

  // Captura de pantalla de la página principal simplificada
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_simplified_page.png') });
  await page.screenshot({ path: 'screenshot_simplified_page.png' });

  // 4. Verificación de que el pie de página fue eliminado
  console.log('5. Verificando eliminación del pie de página...');
  const footerTag = page.locator('footer');
  const footerCount = await footerTag.count();
  console.log('Elementos <footer> encontrados:', footerCount, '(esperado: 0)');

  // 5. Verificación del Explorador de Soluciones
  console.log('6. Abriendo Explorador de Soluciones...');
  const explorerBtn = page.locator('header button:has-text("Explorar Soluciones")');
  await explorerBtn.click();
  await page.waitForTimeout(600);

  const cambioRapido = page.locator('text=Cambio rápido:');
  console.log('¿Texto "Cambio rápido:" presente?:', await cambioRapido.count() > 0, '(esperado: false)');

  const modalFooterText = page.locator('text=Mostrando 10 instancias para este modelo');
  console.log('¿Texto "Mostrando 10 instancias..." presente?:', await modalFooterText.count() > 0, '(esperado: false)');

  // Captura de pantalla del modal simplificado
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_simplified_modal.png') });
  await page.screenshot({ path: 'screenshot_simplified_modal.png' });

  // Cerrar modal
  const closeBtn = page.locator('button:has-text("Cerrar")');
  await closeBtn.first().click();
  await page.waitForTimeout(500);

  await browser.close();
  console.log('Prueba de simplificación finalizada exitosamente.');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
