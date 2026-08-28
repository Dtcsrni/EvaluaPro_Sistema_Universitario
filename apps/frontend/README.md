# apps/frontend — Interfaz de Usuario React de EvaluaPro

Frontend web y PWA de **Sistema EvaluaPro (EP)**, desarrollado con **React 18**, **Vite**, **TypeScript**, **TailwindCSS** y el sistema de diseño visual **Bento Elevation & Glassmorphism Prismatic Sapphire**.

> **Estado:** Línea base oficial estable `v1.1.1`.  
> Incluye las 14 pantallas operativas y los flujos contractuales de diseño de exámenes (`SPEC-034`), captura OMR y auditoría forense (`SPEC-045`).

---

## Destinos de la Aplicación

1. **App Docente (`app_docente`)**:
   - Tablero principal con Mini-KPIs en vivo y selector de materias/periodos.
   - **Estudio de Diseño de Exámenes (`SPEC-034`)**: Navegación en 3 pestañas (Diseño y Parámetros, Generación y Lotes, Historial y Métricas).
   - Mesa de escaneo OMR interactiva con previsualización forense y rescoring asistido.
   - Encuadre institucional, avance de temarios y firmas digitales (`SPEC-040`).
   - Sincronización con Google Classroom y Portal Alumno.

2. **App Alumno (`app_alumno`)**:
   - Consulta ágil de calificaciones, desglose por reactivo y constancias de examen.
   - Soporte para Progressive Web App (PWA) con modo offline mediante Service Worker.

---

## Sistema de Diseño Visual

- **Paleta de Color:** Prismatic Sapphire (`#2563eb`, `#1d4ed8`), Slate Nordic (`#0f172a`, `#1e293b`) y acentos esmeralda/ámbar para estados de escaneo.
- **Glassmorphism:** Tarjetas con elevación Bento (`backdrop-blur-md`, bordes translúcidos de 1px `border-white/10` y sombras volumétricas multicapa).
- **Accesibilidad & Feedback:** Microinteracciones visuales con estados de carga optimizados, tooltips contractuales, toasts de notificación y selector dinámico de pestañas.

---

## Desarrollo Local

Desde la raíz del repositorio:
```bash
# Iniciar servidor de desarrollo (Vite)
npm run dev:frontend
```

Directamente en el módulo:
```bash
npm --prefix apps/frontend run dev
```

### Compilación para Producción
```bash
# Build general
npm --prefix apps/frontend run build

# Build específico para portal alumno
npm --prefix apps/frontend run build:alumno
```

---

## Pruebas y Calidad de UI

```bash
# Pruebas unitarias de componentes y hooks
npm run test:frontend:ci

# Verificación contractual de calidad UX y accesibilidad
npm run test:ux-quality:ci

# Suite de regresión visual y Playwright
npm run test:ux-visual:ci
```

---

## Estructura del Código Fuente

```text
apps/frontend/src/
├── apps/
│   ├── app_docente/         # Módulos y vistas operativas del docente
│   │   ├── components/      # Bento grid, barra lateral, cabeceras y modales
│   │   ├── features/        # Exámenes, reactivos, OMR, calificaciones, firmas
│   │   └── hooks/           # Lógica desacoplada de sesión y reactividad
│   └── app_alumno/          # Vistas de consulta para estudiantes
├── servicios_api/           # Cliente HTTP Axios tipado con interceptores JWT
├── tema/                    # Tokens de diseño, constantes de color y tipografía
└── ui/                      # Componentes reutilizables (Botones, Toasts, Badges, Tabs)
```

---

## Documentación y Referencias
- [Criterios de Calidad UX](../../docs/UX_QUALITY_CRITERIA.md)
- [Sistema de Diseño DESIGN.md](../../docs/DESIGN.md)
- [Especificación de Tabs de Exámenes](../../docs/specs/SPEC-034_diseno_examenes_tabs.spec.md)

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica de UX web docente/alumno.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
