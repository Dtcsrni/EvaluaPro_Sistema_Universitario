$ErrorActionPreference='Stop'
Set-Location 'V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'
$api='http://127.0.0.1:4000/api'
$loginBody=@{ correo='erick.vega@cuh.mx'; contrasena='{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h=@{ Authorization = 'Bearer ' + $login.token }
$pregResp=Invoke-RestMethod -Method Get -Uri "$api/banco-preguntas?periodoId=69a6f63dc2c6e9f7684bdf7d&activo=1&limite=5" -Headers $h
$sample=$pregResp.preguntas | Select-Object -First 1
$sample | ConvertTo-Json -Depth 8 | Set-Content './reports/qa/latest/debug_preg_sample.json' -Encoding UTF8
Write-Host 'SAVED'