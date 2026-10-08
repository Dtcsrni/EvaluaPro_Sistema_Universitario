export function codificarInvocacionCliWindows(executable, args) {
  const payload = Buffer.from(JSON.stringify({ executable, args }), "utf8").toString("base64");
  const script = [
    `$invocacion = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json`,
    "$ejecutable = [string]$invocacion.executable",
    "$argumentos = [string[]]$invocacion.args",
    "& $ejecutable @argumentos",
    "exit $LASTEXITCODE",
  ].join("; ");
  return Buffer.from(script, "utf16le").toString("base64");
}
