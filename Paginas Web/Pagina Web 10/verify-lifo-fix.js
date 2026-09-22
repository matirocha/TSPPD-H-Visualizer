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
  await page.waitForTimeout(800);

  // Abrir selector de soluciones solo si no está en ID 1
  console.log('3. Verificando o seleccionando ID 1...');
  const explorerBtn = page.locator('header button:has-text("Explorar Soluciones")');
  const explorerText = await explorerBtn.innerText();
  if (!explorerText.includes('ID #1')) {
    await explorerBtn.click();
    await page.waitForTimeout(600);
    const id1Card = page.locator('.fixed button:has-text("ID #1")').first();
    await id1Card.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('ID 1 ya está activa por defecto en el header.');
  }

  // Navegar a Paso 4 (Cliente 3)
  console.log('4. Navegando al Paso 4 (hacia Cliente 3)...');
  const step4Btn = page.locator('button[data-step-btn="4"]');
  await step4Btn.click();
  await page.waitForTimeout(1000);

  // VALIDACIÓN SUB-PASO 1
  console.log('--- SUB-PASO 1: Evacuar β ---');
  const subStep1Btn = page.locator('button:has-text("1. Evacuar β")');
  await subStep1Btn.click();
  await page.waitForTimeout(1000);

  const slot1 = page.locator('div[title^="Slot #1:"]');
  const slot1Text = await slot1.innerText();
  console.log('Slot #1 contenido sub-paso 1 (esperado: EVAC β):', slot1Text.replace(/\n/g, ' '));

  const andenPill = page.locator('text=Andén Exterior:');
  const andenVisible1 = await andenPill.isVisible();
  const andenText1 = andenVisible1 ? await andenPill.locator('..').innerText() : 'No visible';
  console.log('Andén en sub-paso 1:', andenText1.replace(/\n/g, ' '));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_step4_substep1.png') });
  await page.screenshot({ path: 'screenshot_step4_substep1.png' });

  // VALIDACIÓN SUB-PASO 2
  console.log('--- SUB-PASO 2: Entrega α ---');
  const subStep2Btn = page.locator('button:has-text("2. Entrega α")');
  await subStep2Btn.click();
  await page.waitForTimeout(1000);

  const slot1Sub2 = await slot1.innerText();
  console.log('Slot #1 contenido sub-paso 2 (debe ser vacío):', slot1Sub2.replace(/\n/g, ' '));

  const slot6 = page.locator('div[title^="Slot #6:"]');
  const slot6Sub2 = await slot6.innerText();
  console.log('Slot #6 contenido sub-paso 2 (esperado: SALE α):', slot6Sub2.replace(/\n/g, ' '));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_step4_substep2.png') });
  await page.screenshot({ path: 'screenshot_step4_substep2.png' });

  // VALIDACIÓN SUB-PASO 3: Evacuar α remanente
  console.log('--- SUB-PASO 3: Evacuar α Remanente (slots 9, 10, 11) ---');
  const subStep3Btn = page.locator('button:has-text("3. Evacuar α")');
  await subStep3Btn.click();
  await page.waitForTimeout(1000);

  const slot9 = page.locator('div[title^="Slot #9:"]');
  const slot9Sub3 = await slot9.innerText();
  console.log('Slot #9 contenido sub-paso 3 (esperado: EVAC α):', slot9Sub3.replace(/\n/g, ' '));

  const slot6Sub3 = await slot6.innerText();
  console.log('Slot #6 contenido sub-paso 3 (debe estar vacío tras entrega):', slot6Sub3.replace(/\n/g, ' '));

  const andenText3 = await andenPill.locator('..').innerText();
  console.log('Andén en sub-paso 3 (esperado: 3 uds α en espera):', andenText3.replace(/\n/g, ' '));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_step4_substep3.png') });
  await page.screenshot({ path: 'screenshot_step4_substep3.png' });

  // VALIDACIÓN SUB-PASO 4: Carga β al Fondo
  console.log('--- SUB-PASO 4: Carga β Fondo (slots 25..32) ---');
  const subStep4Btn = page.locator('button:has-text("4. Carga β Fondo")');
  await subStep4Btn.click();
  await page.waitForTimeout(1000);

  const slot25 = page.locator('div[title^="Slot #25:"]');
  const slot25Sub4 = await slot25.innerText();
  console.log('Slot #25 contenido sub-paso 4 (esperado: ENTRA β al fondo):', slot25Sub4.replace(/\n/g, ' '));

  const slot9Sub4 = await slot9.innerText();
  console.log('Slot #9 contenido sub-paso 4 (debe estar vacío, α está en andén):', slot9Sub4.replace(/\n/g, ' '));

  const andenText4 = await andenPill.locator('..').innerText();
  console.log('Andén en sub-paso 4 (α sigue esperando reingreso):', andenText4.replace(/\n/g, ' '));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_step4_substep4.png') });
  await page.screenshot({ path: 'screenshot_step4_substep4.png' });

  // VALIDACIÓN SUB-PASO 5: Reingreso α a Compuerta
  console.log('--- SUB-PASO 5: Reingreso α a Compuerta (slots 1..3) ---');
  const subStep5Btn = page.locator('button:has-text("5. Reingreso α")');
  await subStep5Btn.click();
  await page.waitForTimeout(1000);

  const slot1Sub5 = await slot1.innerText();
  console.log('Slot #1 contenido sub-paso 5 (esperado: ENTRA α en compuerta):', slot1Sub5.replace(/\n/g, ' '));

  const slot25Sub5 = await slot25.innerText();
  console.log('Slot #25 contenido sub-paso 5 (β consolidada al fondo):', slot25Sub5.replace(/\n/g, ' '));

  const andenVisible5 = await andenPill.isVisible();
  console.log('Andén en sub-paso 5 (debe ser falso/oculto, bahía completa):', andenVisible5);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'screenshot_step4_substep5.png') });
  await page.screenshot({ path: 'screenshot_step4_substep5.png' });

  // VALIDAR COMPACIDAD DEL INDICADOR DE POLÍTICA 3 (SIN TEXTO EXPLICATIVO)
  console.log('--- VERIFICAR COMPACIDAD ---');
  const verboseBanner = page.locator('text=Decisión de Política (TSPPD-H_3)');
  const verboseCount = await verboseBanner.count();
  console.log('Banners explicativos grandes encontrados:', verboseCount, '(esperado: 0)');

  const microPill = page.locator('text=P2 (s=0)');
  const microPillCount = await microPill.count();
  console.log('Micro-indicadores compactos P2 (s=0) encontrados:', microPillCount);

  await browser.close();
  console.log('Prueba de los 5 sub-pasos finalizada exitosamente.');
}

run().catch((err) => {
  console.error('Error en ejecución:', err);
  process.exit(1);
});
