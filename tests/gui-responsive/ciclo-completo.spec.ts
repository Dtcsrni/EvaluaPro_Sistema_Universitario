import { test, expect } from '@playwright/test';

test.describe('Ciclo de uso directo completo', () => {
  // Use a longer timeout for E2E flows
  test.setTimeout(90000);

  test('docente registra cuenta, crea ciclo, materia, inscribe alumno', async ({ page }) => {
    // 1. "Da click en el vinculo de acceso directo, ejecuta la aplicacion"
    // The desktop shortcut essentially opens the local server URL.
    await page.goto('/acceso');

    // 2. "Se registra"
    // El shell puede refrescar la ruta mientras hidrata la sesión; dispara el
    // evento sobre el control actual sin esperar una navegación inexistente.
    await page.getByRole('button', { name: 'Registrar', exact: true }).dispatchEvent('click');
    const registroCorreo = page.getByRole('button', { name: /Registrar con correo/i });
    if (await registroCorreo.isVisible().catch(() => false)) {
      await registroCorreo.click();
    }
    const randomSuffix = Math.floor(Math.random() * 100000);
    await page.fill('input[placeholder="Ej. Juan Carlos"]', 'Maestro');
    await page.fill('input[placeholder="Ej. Perez Lopez"]', 'Prueba');
    await page.fill('input[type="email"]', `maestro_${randomSuffix}@evaluapro.local`);
    await page.fill('input[type="password"]', 'P@ssword123');
    const registroResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/autenticacion/registrar'),
      { timeout: 15_000 }
    );
    await page.getByRole('button', { name: /Crear cuenta/i }).click({ noWaitAfter: true });
    const registroResponse = await registroResponsePromise;
    expect(registroResponse.status(), await registroResponse.text()).toBeLessThan(400);
    // Wait for the app to load and animate
    await page.waitForTimeout(3000);

    // Screenshot 1: Dashboard / Home
    await page.waitForTimeout(1000); // Wait for animations
    await page.screenshot({ path: 'docs/assets/ui/01_dashboard.png', fullPage: true });

    // Should redirect to dashboard / periods
    try {
      await page.waitForURL('**/app/docente**', { timeout: 5000 });
    } catch(e) {
      // Just in case the route is /escritorio or /
    }
    
    // Wait for the Dashboard
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text="Crear materia"').first()).toBeVisible({ timeout: 15000 });

    // 3. "Carga materias"
    // Click inside modal to close any datepicker
    await page.mouse.click(0,0);
    await page.locator('label:has-text("Nombre de la materia") >> input').fill(`Matemáticas Discretas ${randomSuffix}`);
    await page.locator('label:has-text("Fecha inicio") >> input').fill('2026-01-01');
    await page.locator('label:has-text("Fecha fin") >> input').fill('2026-12-31');
    await page.locator('label:has-text("Grupos") >> input').fill('Grupo A');
    // Screenshot 2: Formulario de creación de materia
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/assets/ui/02_crear_materia.png' });

    await page.click('button:has-text("Crear materia")');

    // Wait for creation to finish
    await expect(page.getByText(`Matemáticas Discretas ${randomSuffix}`).first()).toBeVisible({ timeout: 15000 });

    // Screenshot 3: Lista de materias
    await page.screenshot({ path: 'docs/assets/ui/03_lista_materias.png', fullPage: true });

    // 4. "Carga alumnos"
    await page.waitForLoadState('networkidle');
    
    await page.click('text="Alumnos"');
    
    // Create new alumno
    await page.locator('label:has-text("Matricula") >> input').fill(`CUH${Math.floor(100000000 + Math.random() * 900000000)}`);
    await page.locator('label:has-text("Nombres") >> input').fill('Juan');
    await page.locator('label:has-text("Apellidos") >> input').fill('Pérez');
    await page.locator('label:has-text("Materia") >> select').first().selectOption({ index: 1 });
    await page.locator('label:has-text("Grupo") >> input').fill('Grupo A');

    // Screenshot 4: Formulario de creación de alumno
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'docs/assets/ui/04_crear_alumno.png' });

    await page.click('button:has-text("Crear alumno")');

    // Check if the student appears
    await expect(page.getByText('Juan').first()).toBeVisible({ timeout: 10000 });

    // Screenshot 5: Lista de alumnos y éxito
    await page.screenshot({ path: 'docs/assets/ui/05_lista_alumnos.png', fullPage: true });

    // 5. Success
    console.log("Ciclo completo ejecutado con éxito.");
  });
});
