$ErrorActionPreference='Stop'
Set-Location 'V:/Software/Generador_Examenes_Universitarios_MERN/sistema-evaluacion-universitaria'
$api='http://127.0.0.1:4000/api'
$loginBody=@{ correo='erick.vega@cuh.mx'; contrasena='{y!E8s1VqWJoH*D/|2' } | ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$api/autenticacion/ingresar" -ContentType 'application/json' -Body $loginBody
$h=@{ Authorization = 'Bearer ' + $login.token }
$pregResp=Invoke-RestMethod -Method Get -Uri "$api/banco-preguntas?periodoId=69a6f63dc2c6e9f7684bdf7d&activo=1&limite=5000" -Headers $h
$preguntas=@($pregResp.preguntas | Where-Object { $_.tema -eq 'OMR TV3' })
Write-Host ("DIRECT_ID_0={0}" -f [string]$preguntas[0]._id)
Write-Host ("DIRECT_ID_PROP_0={0}" -f [string]$preguntas[0].PSObject.Properties['_id'].Value)
$canonRows=@(
  $preguntas |
    Sort-Object 
      @{Expression={ 
        $en = ''
        if($_.versiones -and $_.versiones.Count -gt 0){ $en = [string]$_.versiones[0].enunciado }
        if($en -match 'Pregunta\s+(\d+)'){ [int]$matches[1] } else { 9999 }
      }},
      @{Expression={ 
        if($_.versiones -and $_.versiones.Count -gt 0){ [string]$_.versiones[0].enunciado } else { '' }
      }} |
    ForEach-Object {
      $en = ''
      if($_.versiones -and $_.versiones.Count -gt 0){ $en = [string]$_.versiones[0].enunciado }
      $num = 9999
      if($en -match 'Pregunta\s+(\d+)'){ $num = [int]$matches[1] }
      $qid=''
      if($_.PSObject.Properties['_id']){ $qid=[string]$_.PSObject.Properties['_id'].Value }
      [pscustomobject]@{ id=$qid; num=$num; enunciado=$en }
    }
)
$canonIds=@($canonRows | Sort-Object @{Expression={[int]$_.num}}, @{Expression={[string]$_.enunciado}} | Select-Object -First 50 | ForEach-Object { [string]$_.id })
Write-Host ('CANON_ROW_0=' + ($canonRows[0] | ConvertTo-Json -Compress))
$bad=@($canonIds | Where-Object { $_ -notmatch '^[a-fA-F0-9]{24}$' })
$res=[ordered]@{ total=$canonIds.Count; bad=$bad.Count; badSample=@($bad|Select-Object -First 5); first=@($canonIds|Select-Object -First 5) }
$res | ConvertTo-Json -Depth 6 | Set-Content './reports/qa/latest/debug_canon_ids_v2.json' -Encoding UTF8
Write-Host ($res | ConvertTo-Json -Compress)