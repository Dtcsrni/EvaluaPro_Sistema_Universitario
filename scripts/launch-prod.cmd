:: launch-prod.cmd
::
:: Responsabilidad: Modulo interno del sistema.
:: Limites: Mantener contrato y comportamiento observable del modulo.
@echo off
REM Launch the web dashboard in prod mode.
setlocal
node "%~dp0launcher-dashboard.mjs" --mode prod
