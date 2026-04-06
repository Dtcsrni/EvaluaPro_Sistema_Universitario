# Logos institucionales (PDF)

Coloca aquí los archivos de logo que se embeben en el encabezado del PDF.

Archivos esperados (recomendado):
- `cuh.png` (Centro Universitario Hidalguense)
- `isc.png` (Ingeniería en Sistemas Computacionales)

Luego configura (en `.env` o en Docker Compose):
- `EXAMEN_LOGO_IZQ_PATH=logos/cuh.png`
- `EXAMEN_LOGO_DER_PATH=logos/isc.png`

Notas:
- El backend también soporta *data URIs* base64, por ejemplo:
  - `EXAMEN_LOGO_IZQ_PATH=data:image/png;base64,<...>`
- Si no se encuentran los logos, el PDF muestra placeholders “LOGO”.
- `evaluapro-official-hero.png` es el isotipo oficial actual para splash/installer.
- Si el splash del Installer Hub falta o quedó vacío, regenerarlo con:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/icons/generate-official-hero.ps1`

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia local del modulo/carpeta dentro del monorepo.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
