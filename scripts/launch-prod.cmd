:: launch-prod.cmd
::
:: Responsabilidad: Modulo interno del sistema.
:: Limites: Mantener contrato y comportamiento observable del modulo.
@echo off
REM Launch the web dashboard in prod mode.
setlocal
set "EMBEDDED_NODE=%~dp0..\runtime\node\node.exe"
if exist "%EMBEDDED_NODE%" (
  "%EMBEDDED_NODE%" "%~dp0launcher-dashboard.mjs" --mode prod
) else (
  node "%~dp0launcher-dashboard.mjs" --mode prod
)
