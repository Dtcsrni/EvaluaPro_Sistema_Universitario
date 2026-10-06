# Plan de validación QA (manual + automatizada)

Objetivo: validar `docente-local` en Windows con una VM limpia y credenciales
locales protegidas en variables de entorno.

## 1) Decisiones previas

- Perfil: básico (Installer Hub E2E en VM) o completo (CI core + QA extended).
- Entorno: VM limpia, host o ambos; registrar cuál se utilizó.
- Runtime: Windows x64 con Node.js embebido, API/Web locales y SQLite local.

## 2) Precondiciones técnicas

- VM: `EvaluaPro-E2E-Win11`, snapshot `pre-evaluapro-installer-e2e`.
- Node.js 24 o superior para las tareas de desarrollo y validación del repositorio.
- `npm install` desde la raíz del repositorio.
- Usar el bundle construido para `docente-local`; verificar versión y SHA-256 antes
  de instalarlo.

## 3) Credenciales locales

Variables base (usuario/clave):

- `EVALUAPRO_QA_DOCENTE_USER`
- `EVALUAPRO_QA_DOCENTE_PASS`
- `EVALUAPRO_QA_ALUMNO_USER`
- `EVALUAPRO_QA_ALUMNO_PASS`
- `EVALUAPRO_QA_ADMIN_USER`
- `EVALUAPRO_QA_ADMIN_PASS`

Opcionales si se requiere API/portal:

- `RELEASE_GATE_API_BASE`
- `RELEASE_GATE_DOCENTE_TOKEN`
- `RELEASE_GATE_DOCENTE_ID`
- `RELEASE_GATE_DOCENTE_HASH_SALT`
- `PORTAL_ALUMNO_URL`
- `PORTAL_ALUMNO_API_KEY`

No versionar credenciales; configurarlas como variables de entorno de usuario en
Windows.

## 4) Validación manual

Checklist base:

- [Prueba manual docente-local](docs/release/manual/docente-local-prueba-manual-2026-05-27.md)
- [Matriz de pantallas GUI](docs/release/manual/gui-screen-matrix.md)

Guardar capturas del Dashboard, login, calificaciones y exportaciones; conservar
el PDF generado y el resultado de impresión. Actualizar
`reports/qa/latest/manifest.json` y `docs/release/manual/prod-flow.json` cuando
aplique el gate estable.

## 5) Validación automatizada

### Installer Hub E2E (VM)

- VM: `EvaluaPro-E2E-Win11`.
- Snapshot: `pre-evaluapro-installer-e2e`.
- Preflight no destructivo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer-hub-vm-readiness.ps1
```

- E2E mutante dentro de la VM:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm
```

Variables clave:

- `EVALUAPRO_E2E_VM_SNAPSHOT=pre-evaluapro-installer-e2e`

### CI core + QA extended

Respetar el orden de los gates configurados en `ci/pipeline.matrix.json`. La
secuencia habitual incluye lint, typecheck, pruebas backend/portal/frontend,
cobertura, arquitectura, flujo docente, PDF/impresión, UX y rendimiento.

## 6) Orden de ejecución

1. Preparar credenciales locales.
2. Restaurar el snapshot y ejecutar el preflight de la VM.
3. Ejecutar el perfil automatizado seleccionado.
4. Completar la validación manual y guardar evidencias.
5. Consolidar reportes y la decisión Go/No-Go.

## 7) Go/No-Go

- Go: los pasos manuales y automatizados requeridos están completos, sin errores
  bloqueantes y con evidencia ligada al bundle validado.
- No-Go: falla login, generación, descarga/impresión, calificación, runtime local
  o un gate CI requerido.

## 8) Seguridad operativa

- No colocar credenciales en archivos versionados.
- No ejecutar el runner mutante sin un snapshot válido.
