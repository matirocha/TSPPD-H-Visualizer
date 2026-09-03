import { test, expect } from '@playwright/test';

test.describe('TSPPD-H Visualizer - Pagina Web 11 Audit', () => {
  test('renders header, metrics bar, route map, and cargo bay', async ({ page }) => {
    await page.goto('http://localhost:3011');

    // Validar título y header
    await expect(page.locator('h1')).toContainText('TSPPD-H Visualizer');

    // Validar métricas de la función objetivo
    await expect(page.getByText('Función Obj. (Z)')).toBeVisible();
    await expect(page.getByText('Distancia Ruteo')).toBeVisible();
    await expect(page.getByText('Costo Handling', { exact: true })).toBeVisible();

    // Validar mapa y compartimiento LIFO
    await expect(page.getByText('Red de Ruteo & Desplazamiento')).toBeVisible();
    await expect(page.getByText('Compartimiento LIFO del Camión')).toBeVisible();

    // Validar controles de simulación
    const playButton = page.getByRole('button', { name: /Iniciar Simulación/i });
    await expect(playButton).toBeVisible();

    // Iniciar simulación y pausar
    await playButton.click();
    await page.waitForTimeout(1000);
    const pauseButton = page.getByRole('button', { name: /Pausar/i });
    await expect(pauseButton).toBeVisible();
    await pauseButton.click();

    // Tomar captura de pantalla para auditoría visual
    await page.screenshot({ path: 'test/audit-screenshot.png', fullPage: true });
  });
});
