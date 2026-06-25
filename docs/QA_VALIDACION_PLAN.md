# Plan de validacion QA (manual + automatizada) - Version mejorada

Objetivo: ejecutar validacion humana y automatizada sin bajar gates, usando credenciales default protegidas en el contexto local con variables de entorno.

## 0) Decisiones previas (obligatorias)
- Perfil: Basico (Installer Hub E2E en VM) o Completo (CI core + QA extended).
- Entorno: solo VM limpia, solo host o ambos.
- Runtime Docker permitido: WSL2 (Desktop solo con override explicito).

## 1) Precondiciones tecnicas
- VM: `EvaluaPro-E2E-Win11`, snapshot `pre-evaluapro-installer-e2e`.
- Runtime: WSL2 + Ubuntu + Docker Engine operativo.
- Node >= 24, `npm install` desde la raiz.
- No instalar Docker Desktop para `docente-local`; aceptar Docker Desktop solo si ya existe, esta sano y evita doble runtime/conflicto local, o con override explicito `EVALUAPRO_DOCKER_RUNTIME=desktop`.

## 2) Credenciales default locales (protegidas con env vars)

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

Regla: no versionar credenciales. Se almacenan como variables de entorno de usuario en Windows.

## 3) Validacion manual humana

Base de checklist:
- [docs/release/manual/docente-local-prueba-manual-2026-05-27.md](docs/release/manual/docente-local-prueba-manual-2026-05-27.md)
- [docs/release/manual/gui-screen-matrix-2026-05-27.md](docs/release/manual/gui-screen-matrix-2026-05-27.md)

Evidencia requerida:
- Capturas clave (dashboard, login, calificaciones, exportaciones).
- PDF generado e impresion.
- `reports/qa/latest/manifest.json` actualizado.
- `docs/release/manual/prod-flow.json` (si aplica gate estable).

## 4) Validacion automatizada (desbloqueada)

### 4.1 Installer Hub E2E (VM)
Prerequisitos:
- Runtime Docker: WSL2 (no Desktop salvo override).
- Snapshot: `pre-evaluapro-installer-e2e`.
- VM: `EvaluaPro-E2E-Win11`.

Comandos (en VM/host segun corresponda):
```powershell
# Preflight no destructivo
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer-hub-vm-readiness.ps1

# E2E mutante dentro de la VM
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/tests/installer-hub-e2e-docente.ps1 -IUnderstandThisMutatesVm
```

Variables clave:
- `EVALUAPRO_E2E_VM_SNAPSHOT=pre-evaluapro-installer-e2e`
- `EVALUAPRO_DOCKER_RUNTIME=wsl2` (solo usar `desktop` con override explicito)

Referencia visual: [docs/tutoriales/installer-hub-docente-e2e.md](docs/tutoriales/installer-hub-docente-e2e.md)

### 4.2 CI core + QA extended
Secuencia sugerida (respetar gates):
```bash
npm run lint
npm run typecheck
npm run test:backend:ci
npm run test:portal:ci
npm run test:frontend:ci
npm run test:coverage:ci
npm run test:coverage:diff
npm run docs:check
npm run routes:check
npm run qa:clean-architecture:strict
npm run test:flujo-docente:ci
npm run test:dataset-prodlike:ci
npm run test:e2e:docente-alumno:ci
npm run test:global-grade:ci
npm run test:pdf-print:ci
npm run test:ux-quality:ci
npm run test:ux-visual:ci
npm run perf:check
```

Matriz oficial: [ci/pipeline.matrix.json](ci/pipeline.matrix.json)

## 5) Orden de ejecucion recomendado
1. Preparar credenciales locales (env vars).
2. Preflight VM y runtime.
3. Automatizada (perfil elegido).
4. Manual humana (checklist y evidencias).
5. Consolidar reportes y decision Go/No-Go.

## 6) Evidencias y ubicacion
- Installer Hub: `reports/qa/installer-hub-e2e-docente/<timestamp>/`.
- QA general: `reports/qa/latest/*`.
- Manual: `docs/release/manual/*` y capturas asociadas.

## 7) Go/No-Go
- Go: todos los pasos manuales y automatizados completos sin errores bloqueantes, evidencia presente.
- No-Go: fallo de login, generacion, PDF/impresion, calificacion, runtime minimo o gates CI rojos.

## 8) Notas de seguridad operativa
- No colocar credenciales en archivos versionados.
- No ejecutar el runner mutante sin snapshot valido.
- No instalar Docker Desktop en docente-local. Si ya existe en el equipo del docente y su daemon esta sano, puede usarse como compatibilidad documentada; si causa conflicto o no responde, volver a `WSL2 + Docker Engine`.
