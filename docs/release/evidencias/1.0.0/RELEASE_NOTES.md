# Notas de Release - EvaluaPro v1.0.0

Bienvenido a la versión oficial estable **1.0.0 (v1.0.0b)** de **EvaluaPro**, la plataforma universitaria para el diseño, generación, administración y calificación automatizada de exámenes mediante OMR.

Esta versión consolida los esfuerzos de la fase de desarrollo y estabilización para entornos locales y en la nube.

---

## Características Principales

### 1. Nuevo Instalador Windows (Installer Hub WPF)
- **WiX Burn + WPF Application:** Se reemplaza el instalador legacy por una experiencia moderna en .NET 8 con un timeline de instalación claro (Detección, Remedación, Planificación, Ejecución MSI, Post-instalación y Finalización).
- **Remediación Automática de Entorno:** Diagnóstico y aprovisionamiento automático de prerequisitos en el host Windows y dentro de WSL2 (Node 24, Docker Engine, WSL2 distros).
- **Runtime Embebido:** Uso prioritario de un Node.js embebido privado para garantizar la operación local y del Tray Control Plane de forma independiente de variables globales.

### 2. Calificación Óptica Automatizada (OMR) Endurecida
- **Calibración y Validación de Baselines:**
  - **TV3 (Por Folio):** Estabilizado en un 100% de precisión y cobertura bajo capturas reales con el dataset `omr_samples_tv3_real_por_folio`.
  - **TV4 (OMR Enriquecido):** Preparado con soporte para QR canónicos, paridad de impresión A050929D y mayor densidad de reactivos.
- **Engine CV Nativo:** Backend de visión artificial obligatorio para la detección precisa de marcas, detección de burbujas en blanco y tratamiento de dobles marcas.

### 3. Generación y Previsualización de Exámenes en PDF
- **Baseline de Impresión A050929D:** Unificación visual de plantillas y layouts entre renderizadores (`pdf-lib-legacy` y `playwright-html-v1`).
- **Control de Caché Inteligente:** Invalidación automática del caché de previsualización al modificar reactivos o la firma del layout.
- **Seguridad en Lotes:** Progreso en tiempo real de la generación de lotes y descargas insensibles a mayúsculas/minúsculas.

### 4. Sincronización en la Nube y Portal del Alumno
- **Portal Cloud v3:** Sincronización de historial académico, avisos, agenda y calificaciones con sincronización diferencial robusta (Fingerprint v2 y LWW).
- **Flujo de Solicitud de Revisiones:** Los alumnos pueden solicitar revisiones específicas por pregunta desde el portal, las cuales se sincronizan directamente al panel del docente para su resolución.

### 5. Seguridad Comercial y Licenciamiento Portable
- **Licencia Firmada Offline (`.epl`):** Soporte para activación obligatoria de licencias comerciales firmadas con llaves RSA/ECDSA por `kid`.
- **Step-up de Seguridad Local:** Acceso a configuraciones del actualizador y del Hub protegido por TOTP (códigos de un solo uso) y sesión firmada localmente por máquina.

---

## Correcciones Recientes de Estabilización (Corte v1.0.0b)
- **Compatibilidad con Workers (Vitest):** Se eliminó el uso de `process.chdir()` en las pruebas de validación OMR de TV3, permitiendo la ejecución paralela e hilos de Vitest sin bloqueos en Windows.
- **Flexibilidad de Configuración:** Se marcó `PORTAL_ALUMNO_API_KEY` como opcional para facilitar el flavor `docente-local` sin requerir conexión obligatoria a la nube de entrada.
- **Resolución de Colisión SHA-256:** Se corrigió un error en la función `hashHex` del orquestador que corrompía buffers binarios en la exportación de reportes DOCX.

---

## Guía de Despliegue Local Rápido

Para desplegar el stack docente local completo en WSL2 + Docker:
```bash
# 1. Verificar prerrequisitos del entorno
npm run env:doctor

# 2. Iniciar el stack productivo local
npm run start:prod
```

El panel de administración local (Tray Dashboard) estará disponible en el puerto configurado de forma predeterminada.
