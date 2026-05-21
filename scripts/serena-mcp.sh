#!/usr/bin/env bash
# shellcheck shell=bash
#
# serena-mcp.sh
#
# Responsabilidad: arrancar Serena MCP de forma portable dentro del repo,
# incluso cuando ~/.local/bin no esta en PATH.
# Limites: no instala Serena; solo resuelve binario y delega argumentos.

set -euo pipefail

if command -v serena >/dev/null 2>&1; then
  exec serena "$@"
fi

SERENA_HOME_BIN="${HOME:-}/.local/bin/serena"
if [[ -x "${SERENA_HOME_BIN}" ]]; then
  exec "${SERENA_HOME_BIN}" "$@"
fi

echo "[serena-mcp] no se encontro el binario 'serena' en PATH ni en ~/.local/bin/serena" >&2
echo "[serena-mcp] instala Serena y/o exporta PATH antes de usar MCP" >&2
exit 1
