:: launch-dev.cmd
::
:: Responsabilidad: Modulo interno del sistema.
:: Limites: Mantener contrato y comportamiento observable del modulo.
@echo off
REM Launch the web dashboard in dev mode.
setlocal
node "%~dp0launcher-dashboard.mjs" --mode dev
