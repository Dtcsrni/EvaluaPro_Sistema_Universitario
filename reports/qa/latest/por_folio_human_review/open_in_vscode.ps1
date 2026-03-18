$ErrorActionPreference = 'Stop'
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
if (-not $codeCmd) {
  Write-Error "No se encontro el comando 'code'. Abre VS Code y ejecuta: Shell Command: Install 'code' command in PATH";
  exit 1
}
$targets = @(
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\reports\qa\latest\por_folio_human_review\OPEN_IN_VSCODE.md'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\reports\qa\latest\por_folio_human_review\review_packet.json'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\reports\qa\latest\por_folio_human_review\review_template.json'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\reports\qa\latest\por_folio_human_review\review_template_batch_01_prefill.json'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\reports\qa\latest\por_folio_human_review\VISUAL_GUIDE_BATCH_01.md'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\reports\qa\latest\por_folio_human_review\README.md'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\503CF7FA-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\5EA00A22-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\54BC4954-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\A327335F-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\6A98D91E-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\75D5292B-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\0E994CBA-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\5EA00A22-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\66BB5FBD-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\ECF3E587-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\07BE7982-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\66BB5FBD-P2-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\B0FB153C-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\ECF3E587-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\D9881CAA-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\EEB4EB38-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\75D5292B-P1-C1.jpg'
  'v:\Software\Generador_Examenes_Universitarios_MERN\sistema-evaluacion-universitaria\omr_samples_tv3_real_por_folio\images\B8A27B0B-P1-C1.jpg'
)
$opened = 0
foreach ($target in $targets) {
  if (Test-Path -LiteralPath $target) {
    & code --reuse-window $target | Out-Null
    $opened += 1
  } else {
    Write-Warning "No existe: $target"
  }
}
Write-Host "Archivos abiertos en VS Code: $opened"
