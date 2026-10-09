import assert from "node:assert/strict";
import test from "node:test";
import { codificarInvocacionCliWindows } from "../lib/vscode-cli-command.mjs";

test("codifica ruta y argumentos como datos para PowerShell, sin interpolarlos en el comando", () => {
  const executable = String.raw`C:\Program Files\VS Code\code.cmd`;
  const args = ["--install-extension", "vendor.extension&Write-Output injected"];
  const encoded = codificarInvocacionCliWindows(executable, args);
  const script = Buffer.from(encoded, "base64").toString("utf16le");
  const payload = /FromBase64String\('([^']+)'\)/.exec(script)?.[1];

  assert.ok(payload);
  assert.equal(script.includes(executable), false);
  assert.equal(script.includes("vendor.extension&Write-Output injected"), false);
  assert.deepEqual(JSON.parse(Buffer.from(payload, "base64").toString("utf8")), { executable, args });
  assert.match(script, /& \$ejecutable @argumentos/);
});
