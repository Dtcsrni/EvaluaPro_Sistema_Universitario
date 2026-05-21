# Suggested commands
- Instalar dependencias: `npm install`.
- Desarrollo: `npm run dev`, `npm run dev:backend`, `npm run dev:frontend`, `npm run dev:portal`.
- Operacion local: `npm run stack:prod`, `npm run stack:dev`, `npm run status`.
- Diagnostico entorno: `npm run env:doctor:wsl`, `npm run env:doctor:windows`, `npm run docker:runtime:check`.
- Build: `npm run build`, `npm run build:frontend:docente`, `npm run installer:hub:build`.
- Windows repo uses PowerShell script entrypoints for MSI/signing/maintenance via npm scripts; prefer root npm scripts over ad hoc command reconstruction.