Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-InstallerHubGuiPreflight {
  param(
    [string]$ModulesPath,
    [string]$PrereqManifestPath
  )

  $issues = @()
  if (-not $ModulesPath) {
    $issues += 'No se encontro la carpeta de modulos del Installer Hub.'
  }
  if (-not $PrereqManifestPath) {
    $issues += 'No se encontro el manifiesto de prerequisitos.'
  }
  try {
    $null = Get-InstallerFlavorCatalog
  } catch {
    $issues += $_.Exception.Message
  }
  if (-not (Get-Command powershell.exe -ErrorAction SilentlyContinue)) {
    $issues += 'powershell.exe no esta disponible.'
  }
  return [pscustomobject]@{
    ok = ($issues.Count -eq 0)
    issues = $issues
  }
}

function Invoke-InstallerHubWizardUi {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Flow,
    [Parameter(Mandatory = $true)]
    [string]$HubTitleText,
    [Parameter(Mandatory = $true)]
    [string]$PrereqManifestPath
  )

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  [System.Windows.Forms.Application]::EnableVisualStyles()

  function New-Theme {
    return @{
      canvas = [System.Drawing.Color]::FromArgb(241, 246, 252)
      header = [System.Drawing.Color]::FromArgb(250, 252, 255)
      card = [System.Drawing.Color]::White
      cardAlt = [System.Drawing.Color]::FromArgb(247, 250, 254)
      primary = [System.Drawing.Color]::FromArgb(22, 104, 196)
      primarySoft = [System.Drawing.Color]::FromArgb(229, 240, 252)
      text = [System.Drawing.Color]::FromArgb(24, 42, 70)
      textMuted = [System.Drawing.Color]::FromArgb(93, 115, 143)
      success = [System.Drawing.Color]::FromArgb(39, 133, 92)
      successSoft = [System.Drawing.Color]::FromArgb(230, 247, 238)
      warn = [System.Drawing.Color]::FromArgb(181, 120, 22)
      warnSoft = [System.Drawing.Color]::FromArgb(255, 245, 220)
      danger = [System.Drawing.Color]::FromArgb(183, 53, 69)
      dangerSoft = [System.Drawing.Color]::FromArgb(254, 236, 238)
      mono = New-Object System.Drawing.Font('Consolas', 10)
      bodyFont = New-Object System.Drawing.Font('Segoe UI', 11)
      smallFont = New-Object System.Drawing.Font('Segoe UI', 10)
      titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', 26)
      sectionFont = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
      labelFont = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
      buttonFont = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
    }
  }

  function Test-BoolString {
    param([string]$Value)
    return @('1', 'true', 'yes', 'on') -contains ([string]$Value).Trim().ToLowerInvariant()
  }

  function Get-DefaultInstallDirForFlavor {
    param([pscustomobject]$Flavor)
    return Join-Path ${env:ProgramFiles} ([string]$Flavor.productName -replace '[\\/:*?"<>|]', '-')
  }

  function New-UiState {
    return [pscustomobject]@{
      preflight = $null
      health = $null
      detectedFlavorName = ''
      heroTitle = ''
      heroBody = ''
      recommendation = ''
      recommendationBadge = ''
      runLabel = 'Instalar ahora'
      installStateLabel = ''
      prereqLabel = ''
      quickSummary = ''
      riskSummary = ''
      canProceed = $true
      missingFields = @()
      resultSummary = 'Todavia no se ha ejecutado ningun flujo.'
      resultDetail = 'Cuando inicies, aqui veras el avance y el resultado final.'
    }
  }

  $theme = New-Theme
  $wizardSteps = @(
    '1. Inicio inteligente',
    '2. Revision rapida',
    '3. Verificacion',
    '4. Instalacion y resultado'
  )
  $phaseOrder = @(
    'analisis_requisitos',
    'carpeta_recursos',
    'prerequisitos',
    'release_estable',
    'accion_producto',
    'configuracion_operativa',
    'verificacion_final',
    'blindaje_licencia_local'
  )
  $phaseTitles = @{
    analisis_requisitos = 'Analisis de requisitos'
    carpeta_recursos = 'Carpeta y recursos'
    prerequisitos = 'Prerequisitos'
    release_estable = 'Release estable y hash'
    accion_producto = 'Accion de producto'
    configuracion_operativa = 'Configuracion operativa'
    verificacion_final = 'Verificacion final'
    blindaje_licencia_local = 'Blindaje local'
  }
  $phaseIndex = @{}
  for ($i = 0; $i -lt $phaseOrder.Count; $i++) {
    $phaseIndex[$phaseOrder[$i]] = $i
  }

  $ui = @{
    inputs = @{}
    inputMeta = @{}
    cards = @{}
    pages = @()
    stepLabels = @()
    phaseCards = @{}
    currentPageIndex = 0
    uiState = New-UiState
  }
  $isGuiSelfTest = @('1', 'true', 'yes', 'on') -contains [string]$env:EVALUAPRO_INSTALLER_GUI_SELF_TEST
  $suppressDialogsForTests = @('1', 'true', 'yes', 'on') -contains [string]$env:EVALUAPRO_INSTALLER_GUI_TEST_NO_DIALOG
  $skipFlowInGuiSelfTest = @('1', 'true', 'yes', 'on') -contains [string]$env:EVALUAPRO_INSTALLER_GUI_SELF_TEST_SKIP_FLOW

  function New-Card {
    param(
      [System.Windows.Forms.Control]$Parent,
      [string]$Dock = 'Top',
      [int]$Padding = 18,
      [int]$MarginBottom = 14,
      [System.Drawing.Color]$BackColor = $theme.card
    )

    $panel = New-Object System.Windows.Forms.Panel
    $panel.Dock = $Dock
    $panel.AutoSize = $true
    $panel.Padding = New-Object System.Windows.Forms.Padding($Padding)
    $panel.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, $MarginBottom)
    $panel.BackColor = $BackColor
    $panel.BorderStyle = 'FixedSingle'
    [void]$Parent.Controls.Add($panel)
    return $panel
  }

  function New-TitleLabel {
    param([string]$Text, [System.Drawing.Font]$Font, [System.Drawing.Color]$Color)
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.AutoSize = $true
    $label.Dock = 'Top'
    $label.Font = $Font
    $label.ForeColor = $Color
    return $label
  }

  function Add-Paragraph {
    param(
      [System.Windows.Forms.Control]$Parent,
      [string]$Text,
      [System.Drawing.Color]$Color,
      [int]$MaxWidth = 860,
      [int]$Bottom = 10,
      [System.Drawing.Font]$Font = $theme.bodyFont
    )
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.AutoSize = $true
    $label.Dock = 'Top'
    $label.MaximumSize = New-Object System.Drawing.Size($MaxWidth, 0)
    $label.ForeColor = $Color
    $label.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, $Bottom)
    $label.Font = $Font
    [void]$Parent.Controls.Add($label)
    return $label
  }

  function New-Stepper {
    param([System.Windows.Forms.Control]$Parent)

    $host = New-Card -Parent $Parent -Dock 'Top' -Padding 18 -MarginBottom 12 -BackColor $theme.card
    [void]$host.Controls.Add((New-TitleLabel -Text 'Asistente' -Font $theme.sectionFont -Color $theme.text))

    $stack = New-Object System.Windows.Forms.TableLayoutPanel
    $stack.Dock = 'Top'
    $stack.AutoSize = $true
    $stack.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $stack.ColumnCount = 1
    $stack.Margin = New-Object System.Windows.Forms.Padding(0, 14, 0, 0)
    [void]$host.Controls.Add($stack)
    $stack.BringToFront()

    for ($i = 0; $i -lt $wizardSteps.Count; $i++) {
      $row = New-Object System.Windows.Forms.TableLayoutPanel
      $row.ColumnCount = 2
      $row.Dock = 'Top'
      $row.AutoSize = $true
      $row.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
      $row.Padding = New-Object System.Windows.Forms.Padding(10, 8, 10, 8)
      $row.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 8)
      $row.BackColor = $theme.cardAlt
      $row.BorderStyle = 'FixedSingle'
      [void]$row.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 36)))
      [void]$row.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))

      $bullet = New-Object System.Windows.Forms.Label
      $bullet.Text = [string]($i + 1)
      $bullet.Width = 28
      $bullet.Height = 28
      $bullet.Margin = New-Object System.Windows.Forms.Padding(0, 2, 8, 2)
      $bullet.TextAlign = 'MiddleCenter'
      $bullet.BackColor = $theme.primarySoft
      $bullet.ForeColor = $theme.primary
      $bullet.Font = $theme.labelFont
      [void]$row.Controls.Add($bullet, 0, 0)

      $label = New-Object System.Windows.Forms.Label
      $label.Text = $wizardSteps[$i]
      $label.AutoSize = $true
      $label.MaximumSize = New-Object System.Drawing.Size(220, 0)
      $label.Margin = New-Object System.Windows.Forms.Padding(0, 3, 0, 2)
      $label.Font = $theme.labelFont
      $label.ForeColor = $theme.text
      [void]$row.Controls.Add($label, 1, 0)

      [void]$stack.Controls.Add($row)
      $ui.stepLabels += [pscustomobject]@{ item = $row; bullet = $bullet; label = $label }
    }
  }

  function New-StatusCard {
    param(
      [System.Windows.Forms.Control]$Parent,
      [string]$Key,
      [string]$Title,
      [string]$Body
    )

    $card = New-Card -Parent $Parent -Dock 'Top' -Padding 12 -MarginBottom 10 -BackColor $theme.cardAlt
    $stack = New-Object System.Windows.Forms.FlowLayoutPanel
    $stack.Dock = 'Top'
    $stack.AutoSize = $true
    $stack.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $stack.WrapContents = $false
    $stack.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
    [void]$card.Controls.Add($stack)
    $titleLabel = New-TitleLabel -Text $Title -Font $theme.labelFont -Color $theme.text
    [void]$stack.Controls.Add($titleLabel)
    $bodyLabel = Add-Paragraph -Parent $stack -Text $Body -Color $theme.textMuted -Bottom 0 -MaxWidth 220 -Font $theme.smallFont
    $ui.cards[$Key] = [pscustomobject]@{ card = $card; title = $titleLabel; body = $bodyLabel }
    return $card
  }
  function Update-StatusCard {
    param(
      [string]$Key,
      [string]$Title,
      [string]$Body,
      [string]$Tone
    )

    if (-not $ui.cards.ContainsKey($Key)) { return }
    $card = $ui.cards[$Key]
    $card.title.Text = $Title
    $card.body.Text = $Body
    switch ($Tone) {
      'success' {
        $card.card.BackColor = $theme.successSoft
        $card.title.ForeColor = $theme.success
        $card.body.ForeColor = $theme.text
      }
      'warn' {
        $card.card.BackColor = $theme.warnSoft
        $card.title.ForeColor = $theme.warn
        $card.body.ForeColor = $theme.text
      }
      'danger' {
        $card.card.BackColor = $theme.dangerSoft
        $card.title.ForeColor = $theme.danger
        $card.body.ForeColor = $theme.text
      }
      default {
        $card.card.BackColor = $theme.cardAlt
        $card.title.ForeColor = $theme.text
        $card.body.ForeColor = $theme.textMuted
      }
    }
  }

  function New-Section {
    param(
      [System.Windows.Forms.Control]$Parent,
      [string]$Title,
      [string]$Hint,
      [string]$Variant = 'compact'
    )

    $backColor = $theme.card
    if ($Variant -eq 'hero') { $backColor = $theme.primarySoft }
    elseif ($Variant -eq 'advanced') { $backColor = $theme.cardAlt }
    $card = New-Card -Parent $Parent -Dock 'Top' -Padding 16 -MarginBottom 14 -BackColor $backColor
    $stack = New-Object System.Windows.Forms.FlowLayoutPanel
    $stack.Dock = 'Top'
    $stack.AutoSize = $true
    $stack.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $stack.WrapContents = $false
    $stack.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
    [void]$card.Controls.Add($stack)

    $titleLabel = New-TitleLabel -Text $Title -Font $theme.sectionFont -Color $theme.text
    [void]$stack.Controls.Add($titleLabel)
    if ($Hint) {
      [void](Add-Paragraph -Parent $stack -Text $Hint -Color $theme.textMuted -Bottom 10 -Font $theme.smallFont)
    }

    $rows = New-Object System.Windows.Forms.TableLayoutPanel
    $rows.Dock = 'Top'
    $rows.AutoSize = $true
    $rows.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $rows.Margin = New-Object System.Windows.Forms.Padding(0, 6, 0, 0)
    $rows.ColumnCount = 3
    [void]$rows.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 220)))
    [void]$rows.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    [void]$rows.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 110)))
    [void]$stack.Controls.Add($rows)
    return $rows
  }

  function New-InputRow {
    param(
      [System.Windows.Forms.TableLayoutPanel]$Layout,
      [string]$Key,
      [string]$Label,
      [string]$Value,
      [string]$Type,
      [string[]]$Options,
      [string]$ButtonText,
      [scriptblock]$OnClick,
      [string]$HelpText,
      [bool]$Required = $false
    )

    if (-not $Type) { $Type = 'text' }
    if ($null -eq $Options) { $Options = @() }

    $row = $Layout.RowCount
    $Layout.RowCount += 2
    [void]$Layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$Layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))

    $labelControl = New-Object System.Windows.Forms.Label
    $labelControl.Text = $Label
    $labelControl.AutoSize = $true
    $labelControl.Margin = New-Object System.Windows.Forms.Padding(0, 10, 12, 4)
    $labelControl.Font = $theme.labelFont
    $labelControl.ForeColor = $theme.text
    [void]$Layout.Controls.Add($labelControl, 0, $row)

    if ($Type -eq 'combo') {
      $input = New-Object System.Windows.Forms.ComboBox
      $input.DropDownStyle = 'DropDownList'
      foreach ($option in $Options) {
        [void]$input.Items.Add($option)
      }
      $input.SelectedItem = $Value
      if (-not $input.SelectedItem -and $input.Items.Count -gt 0) {
        $input.SelectedIndex = 0
      }
    } else {
      $input = New-Object System.Windows.Forms.TextBox
      $input.Text = $Value
      if ($Type -eq 'password') { $input.UseSystemPasswordChar = $true }
      if ($Type -eq 'multiline') {
        $input.Multiline = $true
        $input.Height = 72
        $input.ScrollBars = 'Vertical'
      }
    }

    $input.Dock = 'Fill'
    $input.Margin = New-Object System.Windows.Forms.Padding(0, 6, 10, 2)
    $input.Font = $theme.bodyFont
    $input.BackColor = [System.Drawing.Color]::White
    $input.ForeColor = $theme.text
    [void]$Layout.Controls.Add($input, 1, $row)

    if ($ButtonText) {
      $button = New-Object System.Windows.Forms.Button
      $button.Text = $ButtonText
      $button.Width = 104
      $button.Height = 36
      $button.Font = $theme.buttonFont
      $button.BackColor = $theme.primarySoft
      $button.ForeColor = $theme.primary
      if ($OnClick) { $button.Add_Click($OnClick) }
      [void]$Layout.Controls.Add($button, 2, $row)
    } else {
      [void]$Layout.Controls.Add((New-Object System.Windows.Forms.Panel), 2, $row)
    }

    $help = New-Object System.Windows.Forms.Label
    $help.Text = if ($HelpText) { $HelpText } else { '' }
    $help.AutoSize = $true
    $help.MaximumSize = New-Object System.Drawing.Size(620, 0)
    $help.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 10)
    $help.ForeColor = $theme.textMuted
    $help.Font = $theme.smallFont
    [void]$Layout.Controls.Add($help, 1, ($row + 1))

    $error = New-Object System.Windows.Forms.Label
    $error.Text = ''
    $error.AutoSize = $true
    $error.MaximumSize = New-Object System.Drawing.Size(240, 0)
    $error.ForeColor = $theme.danger
    $error.Font = $theme.smallFont
    $error.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 10)
    [void]$Layout.Controls.Add($error, 2, ($row + 1))

    $ui.inputs[$Key] = $input
    $ui.inputMeta[$Key] = [pscustomobject]@{ help = $help; error = $error; required = $Required; label = $Label }
    return $input
  }

  function New-CheckRow {
    param(
      [System.Windows.Forms.TableLayoutPanel]$Layout,
      [string]$Key,
      [string]$Text,
      [bool]$Checked,
      [string]$HelpText
    )

    $row = $Layout.RowCount
    $Layout.RowCount += 2
    [void]$Layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$Layout.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))

    $check = New-Object System.Windows.Forms.CheckBox
    $check.Text = $Text
    $check.AutoSize = $true
    $check.Checked = $Checked
    $check.Font = $theme.bodyFont
    $check.ForeColor = $theme.text
    $check.Margin = New-Object System.Windows.Forms.Padding(0, 6, 0, 2)
    [void]$Layout.Controls.Add($check, 1, $row)

    $help = New-Object System.Windows.Forms.Label
    $help.Text = if ($HelpText) { $HelpText } else { '' }
    $help.AutoSize = $true
    $help.MaximumSize = New-Object System.Drawing.Size(620, 0)
    $help.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 10)
    $help.ForeColor = $theme.textMuted
    $help.Font = $theme.smallFont
    [void]$Layout.Controls.Add($help, 1, ($row + 1))

    $ui.inputs[$Key] = $check
    $ui.inputMeta[$Key] = [pscustomobject]@{ help = $help; error = $null; required = $false; label = $Text }
    return $check
  }

  function New-AdvancedSection {
    param(
      [System.Windows.Forms.Control]$Parent,
      [string]$Title,
      [string]$Hint
    )

    $card = New-Card -Parent $Parent -Dock 'Top' -Padding 16 -MarginBottom 14 -BackColor $theme.cardAlt
    $stack = New-Object System.Windows.Forms.FlowLayoutPanel
    $stack.Dock = 'Top'
    $stack.AutoSize = $true
    $stack.AutoSizeMode = [System.Windows.Forms.AutoSizeMode]::GrowAndShrink
    $stack.WrapContents = $false
    $stack.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
    [void]$card.Controls.Add($stack)

    $toggle = New-Object System.Windows.Forms.Button
    $toggle.Text = $Title
    $toggle.Width = 240
    $toggle.Height = 38
    $toggle.Font = $theme.buttonFont
    $toggle.BackColor = $theme.primarySoft
    $toggle.ForeColor = $theme.primary
    [void]$stack.Controls.Add($toggle)

    [void](Add-Paragraph -Parent $stack -Text $Hint -Color $theme.textMuted -Bottom 12 -Font $theme.smallFont)

    $content = New-Object System.Windows.Forms.Panel
    $content.Dock = 'Top'
    $content.AutoSize = $true
    $content.Visible = $false
    $content.Margin = New-Object System.Windows.Forms.Padding(0, 6, 0, 0)
    [void]$stack.Controls.Add($content)

    $toggleButton = $toggle
    $contentPanel = $content
    $toggle.Add_Click({
      param($sender, $eventArgs)
      $contentPanel.Visible = -not $contentPanel.Visible
      if ($contentPanel.Visible) {
        $toggleButton.Text = if ($toggleButton.Text -like 'Mostrar*') { $toggleButton.Text -replace '^Mostrar', 'Ocultar' } else { 'Ocultar opciones tecnicas' }
      } else {
        $toggleButton.Text = if ($toggleButton.Text -like 'Ocultar*') { $toggleButton.Text -replace '^Ocultar', 'Mostrar' } else { 'Mostrar opciones tecnicas' }
      }
    }.GetNewClosure())

    return [pscustomobject]@{ Card = $card; Toggle = $toggle; Content = $content }
  }

  function New-PrimaryActionBar {
    param([System.Windows.Forms.Control]$Parent)
    $bar = New-Object System.Windows.Forms.TableLayoutPanel
    $bar.Dock = 'Fill'
    $bar.ColumnCount = 4
    [void]$bar.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 140)))
    [void]$bar.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 150)))
    [void]$bar.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 190)))
    [void]$bar.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    [void]$Parent.Controls.Add($bar)

    function New-BarButton {
      param([string]$Text, [string]$Tone)
      $button = New-Object System.Windows.Forms.Button
      $button.Text = $Text
      $button.Height = 44
      $button.Dock = 'Fill'
      $button.Font = $theme.buttonFont
      switch ($Tone) {
        'primary' {
          $button.BackColor = $theme.primary
          $button.ForeColor = [System.Drawing.Color]::White
        }
        'secondary' {
          $button.BackColor = $theme.primarySoft
          $button.ForeColor = $theme.primary
        }
        default {
          $button.BackColor = [System.Drawing.Color]::White
          $button.ForeColor = $theme.text
        }
      }
      return $button
    }

    $backButton = New-BarButton -Text 'Atras' -Tone 'default'
    $nextButton = New-BarButton -Text 'Continuar' -Tone 'secondary'
    $runButton = New-BarButton -Text 'Instalar ahora' -Tone 'primary'
    $closeButton = New-BarButton -Text 'Cerrar' -Tone 'default'
    [void]$bar.Controls.Add($backButton, 0, 0)
    [void]$bar.Controls.Add($nextButton, 1, 0)
    [void]$bar.Controls.Add($runButton, 2, 0)
    [void]$bar.Controls.Add($closeButton, 3, 0)
    return [pscustomobject]@{ Back = $backButton; Next = $nextButton; Run = $runButton; Close = $closeButton }
  }
  function Set-StepperState {
    param([int]$Index)
    for ($i = 0; $i -lt $ui.stepLabels.Count; $i++) {
      $step = $ui.stepLabels[$i]
      if ($i -eq $Index) {
        $step.item.BackColor = $theme.primarySoft
        $step.bullet.BackColor = $theme.primary
        $step.bullet.ForeColor = [System.Drawing.Color]::White
        $step.label.ForeColor = $theme.primary
      } elseif ($i -lt $Index) {
        $step.item.BackColor = $theme.successSoft
        $step.bullet.BackColor = $theme.success
        $step.bullet.ForeColor = [System.Drawing.Color]::White
        $step.label.ForeColor = $theme.success
      } else {
        $step.item.BackColor = $theme.cardAlt
        $step.bullet.BackColor = $theme.primarySoft
        $step.bullet.ForeColor = $theme.primary
        $step.label.ForeColor = $theme.text
      }
    }
  }

  function Update-PhaseCard {
    param([string]$PhaseName, [string]$State)
    if (-not $ui.phaseCards.ContainsKey($PhaseName)) { return }
    $phase = $ui.phaseCards[$PhaseName]
    switch ($State) {
      'running' {
        $phase.card.BackColor = $theme.primarySoft
        $phase.badge.Text = 'En curso'
        $phase.badge.ForeColor = $theme.primary
      }
      'done' {
        $phase.card.BackColor = $theme.successSoft
        $phase.badge.Text = 'Listo'
        $phase.badge.ForeColor = $theme.success
      }
      'error' {
        $phase.card.BackColor = $theme.dangerSoft
        $phase.badge.Text = 'Fallo'
        $phase.badge.ForeColor = $theme.danger
      }
      default {
        $phase.card.BackColor = $theme.cardAlt
        $phase.badge.Text = 'Pendiente'
        $phase.badge.ForeColor = $theme.textMuted
      }
    }
  }

  function Set-InputError {
    param([string]$Key, [string]$Message)
    if ($ui.inputMeta.ContainsKey($Key) -and $ui.inputMeta[$Key].error) {
      $ui.inputMeta[$Key].error.Text = $Message
    }
  }

  function Clear-InputErrors {
    foreach ($key in $ui.inputMeta.Keys) {
      if ($ui.inputMeta[$key].error) {
        $ui.inputMeta[$key].error.Text = ''
      }
    }
  }

  function Sync-UiToFlow {
    $Flow.installDir = [string]$ui.inputs['installDir'].Text
    $Flow.flavor = Get-InstallerFlavorDefinition -FlavorId ([string]$ui.inputs['flavor'].SelectedItem)
    $Flow.flavorId = [string]$Flow.flavor.flavorId
    $Flow.requestedMode = [string]$ui.inputs['mode'].SelectedItem
    $Flow.licenciaAccountEmail = [string]$ui.inputs['licenciaAccountEmail'].Text
    $Flow.puertoApi = [string]$ui.inputs['puertoApi'].Text
    $Flow.puertoPortal = [string]$ui.inputs['puertoPortal'].Text
    $Flow.portalAlumnoUrl = [string]$ui.inputs['portalAlumnoUrl'].Text
    $Flow.tenantId = [string]$ui.inputs['tenantId'].Text
    $Flow.codigoActivacion = [string]$ui.inputs['codigoActivacion'].Text
    $Flow.apiComercialBaseUrl = [string]$ui.inputs['apiComercialBaseUrl'].Text
    $Flow.mongoUri = [string]$ui.inputs['mongoUri'].Text
    $Flow.jwtSecreto = [string]$ui.inputs['jwtSecreto'].Text
    $Flow.nodeEnv = [string]$ui.inputs['nodeEnv'].SelectedItem
    $Flow.corsOrigenes = [string]$ui.inputs['corsOrigenes'].Text
    $Flow.portalAlumnoApiKey = [string]$ui.inputs['portalAlumnoApiKey'].Text
    $Flow.portalApiKey = [string]$ui.inputs['portalApiKey'].Text
    $Flow.correoModuloActivo = if ($ui.inputs['correoModuloActivo'].Checked) { '1' } else { '0' }
    $Flow.notificacionesWebhookUrl = [string]$ui.inputs['notificacionesWebhookUrl'].Text
    $Flow.notificacionesWebhookToken = [string]$ui.inputs['notificacionesWebhookToken'].Text
    $Flow.passwordResetEnabled = if ($ui.inputs['passwordResetEnabled'].Checked) { '1' } else { '0' }
    $Flow.passwordResetTokenMinutes = [string]$ui.inputs['passwordResetTokenMinutes'].Text
    $Flow.passwordResetUrlBase = [string]$ui.inputs['passwordResetUrlBase'].Text
    $Flow.requireGoogleOAuth = if ($ui.inputs['requireGoogleOAuth'].Checked) { '1' } else { '0' }
    $Flow.googleOauthClientId = [string]$ui.inputs['googleOauthClientId'].Text
    $Flow.googleClassroomClientId = [string]$ui.inputs['googleClassroomClientId'].Text
    $Flow.googleClassroomClientSecret = [string]$ui.inputs['googleClassroomClientSecret'].Text
    $Flow.googleClassroomRedirectUri = [string]$ui.inputs['googleClassroomRedirectUri'].Text
    $Flow.updateChannel = [string]$ui.inputs['updateChannel'].SelectedItem
    $Flow.updateOwner = [string]$ui.inputs['updateOwner'].Text
    $Flow.updateRepo = [string]$ui.inputs['updateRepo'].Text
    $Flow.updateAssetName = [string]$ui.inputs['updateAssetName'].Text
    $Flow.updateShaAssetName = [string]$ui.inputs['updateShaAssetName'].Text
    $Flow.updateFeedUrl = [string]$ui.inputs['updateFeedUrl'].Text
    $Flow.updateRequireSha256 = if ($ui.inputs['updateRequireSha256'].Checked) { '1' } else { '0' }
    $Flow.installation = Get-EvaluaProInstallationInfo
    $Flow.resolvedMode = Resolve-InstallerMode -RequestedMode $Flow.requestedMode -Installation $Flow.installation
  }

  function Test-QuickInputs {
    Clear-InputErrors
    $missing = @()

    if ([string]::IsNullOrWhiteSpace([string]$ui.inputs['installDir'].Text)) {
      $missing += 'installDir'
      Set-InputError -Key 'installDir' -Message 'Selecciona una carpeta.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$ui.inputs['licenciaAccountEmail'].Text)) {
      $missing += 'licenciaAccountEmail'
      Set-InputError -Key 'licenciaAccountEmail' -Message 'Indica un correo.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$ui.inputs['puertoApi'].Text)) {
      $missing += 'puertoApi'
      Set-InputError -Key 'puertoApi' -Message 'Campo requerido.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$ui.inputs['puertoPortal'].Text)) {
      $missing += 'puertoPortal'
      Set-InputError -Key 'puertoPortal' -Message 'Campo requerido.'
    }
    if ([string]::IsNullOrWhiteSpace([string]$ui.inputs['portalAlumnoUrl'].Text)) {
      $missing += 'portalAlumnoUrl'
      Set-InputError -Key 'portalAlumnoUrl' -Message 'URL requerida.'
    }

    $ui.uiState.missingFields = $missing
    $ui.uiState.canProceed = ($missing.Count -eq 0)
    return ($missing.Count -eq 0)
  }

  $form = New-Object System.Windows.Forms.Form
  $form.Text = $HubTitleText
  $form.StartPosition = 'CenterScreen'
  $form.Width = 1300
  $form.Height = 920
  $form.MinimumSize = New-Object System.Drawing.Size(1180, 820)
  $form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::Dpi
  $form.BackColor = $theme.canvas
  $form.ForeColor = $theme.text
  $form.Font = $theme.bodyFont

  $header = New-Object System.Windows.Forms.TableLayoutPanel
  $header.Dock = 'Top'
  $header.Height = 112
  $header.Padding = New-Object System.Windows.Forms.Padding(28, 18, 28, 12)
  $header.BackColor = $theme.header
  $header.ColumnCount = 2
  [void]$header.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
  [void]$header.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 290)))
  [void]$form.Controls.Add($header)

  $headerLeft = New-Object System.Windows.Forms.FlowLayoutPanel
  $headerLeft.Dock = 'Fill'
  $headerLeft.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
  $headerLeft.WrapContents = $false
  $headerLeft.AutoSize = $true
  [void]$header.Controls.Add($headerLeft, 0, 0)

  $titleLabel = New-TitleLabel -Text $HubTitleText -Font $theme.titleFont -Color $theme.text
  [void]$headerLeft.Controls.Add($titleLabel)
  [void]$headerLeft.Controls.Add((Add-Paragraph -Parent $headerLeft -Text 'Asistente guiado para instalar, reparar y dejar listo el entorno sin exponer opciones tecnicas innecesarias.' -Color $theme.textMuted -Bottom 0 -Font $theme.bodyFont))

  $brandCard = New-Object System.Windows.Forms.Panel
  $brandCard.Dock = 'Fill'
  $brandCard.BackColor = $theme.primarySoft
  $brandCard.Padding = New-Object System.Windows.Forms.Padding(16, 14, 16, 14)
  $brandCard.BorderStyle = 'FixedSingle'
  [void]$header.Controls.Add($brandCard, 1, 0)
  $brandStack = New-Object System.Windows.Forms.FlowLayoutPanel
  $brandStack.Dock = 'Fill'
  $brandStack.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
  $brandStack.WrapContents = $false
  $brandStack.AutoSize = $true
  [void]$brandCard.Controls.Add($brandStack)

  $brandTitle = New-TitleLabel -Text 'Listo para detectar' -Font $theme.labelFont -Color $theme.primary
  [void]$brandStack.Controls.Add($brandTitle)
  $brandSummary = Add-Paragraph -Parent $brandStack -Text 'El Hub analiza la instalacion y te propone la accion correcta.' -Color $theme.text -Bottom 0 -Font $theme.smallFont -MaxWidth 250

  $root = New-Object System.Windows.Forms.TableLayoutPanel
  $root.Dock = 'Fill'
  $root.Padding = New-Object System.Windows.Forms.Padding(22, 18, 22, 22)
  $root.ColumnCount = 2
  [void]$root.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Absolute, 340)))
  [void]$root.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
  [void]$form.Controls.Add($root)

  $sidebar = New-Object System.Windows.Forms.FlowLayoutPanel
  $sidebar.Dock = 'Fill'
  $sidebar.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
  $sidebar.WrapContents = $false
  $sidebar.AutoScroll = $true
  [void]$root.Controls.Add($sidebar, 0, 0)

  New-Stepper -Parent $sidebar | Out-Null
  New-StatusCard -Parent $sidebar -Key 'detectSummary' -Title 'Deteccion inicial' -Body 'Se revisara instalacion, flavor recomendado, prerequisitos y carpeta objetivo.' | Out-Null

  $content = New-Object System.Windows.Forms.TableLayoutPanel
  $content.Dock = 'Fill'
  $content.RowCount = 3
  [void]$content.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
  [void]$content.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 200)))
  [void]$content.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Absolute, 64)))
  [void]$root.Controls.Add($content, 1, 0)

  $pageHost = New-Object System.Windows.Forms.Panel
  $pageHost.Dock = 'Fill'
  [void]$content.Controls.Add($pageHost, 0, 0)

  $statusCard = New-Card -Parent $content -Dock 'Fill' -Padding 18 -MarginBottom 0 -BackColor $theme.card
  $statusCardRow = New-Object System.Windows.Forms.TableLayoutPanel
  $statusCardRow.Dock = 'Fill'
  $statusCardRow.RowCount = 3
  [void]$statusCardRow.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
  [void]$statusCardRow.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
  [void]$statusCardRow.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
  [void]$statusCard.Controls.Add($statusCardRow)

  $statusLabel = New-TitleLabel -Text 'Listo para iniciar' -Font $theme.sectionFont -Color $theme.text
  [void]$statusCardRow.Controls.Add($statusLabel, 0, 0)
  $statusDetailLabel = Add-Paragraph -Parent $statusCardRow -Text 'El asistente detectara la instalacion y te sugerira la accion mas segura.' -Color $theme.textMuted -Bottom 10 -Font $theme.smallFont
  $statusDetailLabel.Dock = 'Top'

  $techSection = New-AdvancedSection -Parent $statusCardRow -Title 'Ver detalle tecnico' -Hint 'El log tecnico queda oculto por defecto. Solo abre esta seccion si necesitas diagnostico fino.'
  $techSection.Card.Dock = 'Fill'
  $techSection.Toggle.Text = 'Ver detalle tecnico'
  $techSection.Toggle.Width = 200
  $logBox = New-Object System.Windows.Forms.TextBox
  $logBox.Multiline = $true
  $logBox.Dock = 'Fill'
  $logBox.Height = 100
  $logBox.ScrollBars = 'Vertical'
  $logBox.ReadOnly = $true
  $logBox.BackColor = [System.Drawing.Color]::FromArgb(249, 251, 254)
  $logBox.ForeColor = $theme.text
  $logBox.Font = $theme.mono
  [void]$techSection.Content.Controls.Add($logBox)

  $actionBarHost = New-Object System.Windows.Forms.Panel
  $actionBarHost.Dock = 'Fill'
  [void]$content.Controls.Add($actionBarHost, 0, 2)
  $actionBar = New-PrimaryActionBar -Parent $actionBarHost
  $btnBack = $actionBar.Back
  $btnNext = $actionBar.Next
  $btnRun = $actionBar.Run
  $btnExit = $actionBar.Close
  function New-Page {
    param([string]$Title, [string]$Description)
    $page = New-Object System.Windows.Forms.TableLayoutPanel
    $page.Dock = 'Fill'
    $page.RowCount = 3
    $page.Padding = New-Object System.Windows.Forms.Padding(6)
    [void]$page.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$page.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$page.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    $page.Visible = $false
    [void]$pageHost.Controls.Add($page)

    $pageTitle = New-TitleLabel -Text $Title -Font $theme.sectionFont -Color $theme.text
    [void]$page.Controls.Add($pageTitle, 0, 0)
    $desc = New-Object System.Windows.Forms.Label
    $desc.Text = $Description
    $desc.AutoSize = $true
    $desc.MaximumSize = New-Object System.Drawing.Size(860, 0)
    $desc.ForeColor = $theme.textMuted
    $desc.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 18)
    $desc.Font = $theme.bodyFont
    [void]$page.Controls.Add($desc, 0, 1)

    $body = New-Object System.Windows.Forms.Panel
    $body.Dock = 'Fill'
    $body.AutoScroll = $true
    [void]$page.Controls.Add($body, 0, 2)
    $ui.pages += $page
    return $body
  }

  $pageSmartStart = New-Page -Title 'Inicio inteligente' -Description 'Detecto el estado del equipo, propongo la accion correcta y preparo una instalacion guiada.'
  $heroRows = New-Section -Parent $pageSmartStart -Title 'Esto es lo que hare' -Hint 'Patron de wizard de instalacion: detectar, confirmar lo minimo, verificar y ejecutar.' -Variant 'hero'
  $heroActionLabel = Add-Paragraph -Parent $pageSmartStart -Text 'Analizando equipo...' -Color $theme.text -Bottom 16 -Font $theme.sectionFont
  [void](New-InputRow -Layout $heroRows -Key 'smartRecommendedAction' -Label 'Accion sugerida' -Value ([string]$Flow.resolvedMode) -Type 'combo' -Options @('install', 'repair', 'uninstall', 'auto') -HelpText 'Puedes ajustarla, pero el sistema propone la accion mas segura segun el estado detectado.')
  $ui.inputs['smartRecommendedAction'].Enabled = $false
  New-StatusCard -Parent $pageSmartStart -Key 'inferredCard' -Title 'Resumen detectado' -Body 'Pendiente.' | Out-Null
  [void](Add-Paragraph -Parent $pageSmartStart -Text 'Siguiente paso: revisa solo cinco campos rapidos. Todo lo tecnico queda colapsado.' -Color $theme.textMuted -Bottom 0 -Font $theme.smallFont)

  $pageQuickReview = New-Page -Title 'Revision rapida' -Description 'Solo te pido confirmar lo minimo para una instalacion docente local segura.'
  $quickRows = New-Section -Parent $pageQuickReview -Title 'Confirmacion rapida' -Hint 'Estos campos quedan visibles porque suelen cambiar por equipo o institucion.'
  [void](New-InputRow -Layout $quickRows -Key 'mode' -Label 'Accion' -Value $Flow.resolvedMode -Type 'combo' -Options @('install', 'repair', 'uninstall', 'auto') -HelpText 'El sistema propone una accion, pero puedes corregirla si tu caso lo requiere.' -Required $true)
  [void](New-InputRow -Layout $quickRows -Key 'installDir' -Label 'Carpeta destino' -Value $Flow.installDir -ButtonText 'Explorar' -HelpText 'Ubicacion principal donde se instalara o reparara EvaluaPro.' -Required $true -OnClick {
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.SelectedPath = [string]$ui.inputs['installDir'].Text
    $dialog.Description = 'Selecciona carpeta de instalacion de EvaluaPro'
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $ui.inputs['installDir'].Text = $dialog.SelectedPath
    }
  })
  [void](New-InputRow -Layout $quickRows -Key 'licenciaAccountEmail' -Label 'Correo de licencia' -Value $Flow.licenciaAccountEmail -HelpText 'Se usara para activar o verificar la licencia institucional.' -Required $true)
  [void](New-InputRow -Layout $quickRows -Key 'puertoApi' -Label 'Puerto API' -Value ([string]$Flow.puertoApi) -HelpText 'Puerto local del backend docente.' -Required $true)
  [void](New-InputRow -Layout $quickRows -Key 'puertoPortal' -Label 'Puerto portal' -Value ([string]$Flow.puertoPortal) -HelpText 'Puerto local para abrir portal y dashboard.' -Required $true)
  [void](New-InputRow -Layout $quickRows -Key 'portalAlumnoUrl' -Label 'URL portal alumno' -Value $Flow.portalAlumnoUrl -HelpText 'Direccion publica del portal para alumnos.' -Required $true)

  $compatSection = New-Section -Parent $pageQuickReview -Title 'Compatibilidad detectada' -Hint 'Este bloque se autocompleta segun instalacion previa y defaults.'
  [void](New-InputRow -Layout $compatSection -Key 'flavor' -Label 'Flavor' -Value ([string]$Flow.flavorId) -Type 'combo' -Options @((Get-InstallerFlavorCatalog).flavors | ForEach-Object { [string]$_.flavorId }) -HelpText 'Se mantiene visible por compatibilidad, pero no es la decision principal.')
  [void](New-InputRow -Layout $compatSection -Key 'tenantId' -Label 'TenantId (opcional)' -Value $Flow.tenantId -HelpText 'Solo si tu esquema de licencia ya te lo entrego.')
  [void](New-InputRow -Layout $compatSection -Key 'codigoActivacion' -Label 'Codigo de activacion (opcional)' -Value $Flow.codigoActivacion -HelpText 'Si ya cuentas con el codigo, se aplicara durante el flujo.')

  $advancedSection = New-AdvancedSection -Parent $pageQuickReview -Title 'Mostrar opciones tecnicas' -Hint 'Configuracion avanzada para soporte TI. El usuario docente normal no deberia necesitar abrir esto.'
  $stackRows = New-Section -Parent $advancedSection.Content -Title 'Stack y acceso' -Hint 'Backend, llaves de integracion y API comercial.' -Variant 'advanced'
  [void](New-InputRow -Layout $stackRows -Key 'apiComercialBaseUrl' -Label 'API comercial' -Value $Flow.apiComercialBaseUrl -HelpText 'Base URL del servicio comercial/licenciamiento.')
  [void](New-InputRow -Layout $stackRows -Key 'mongoUri' -Label 'MONGODB_URI' -Value $Flow.mongoUri -HelpText 'Conexion interna a MongoDB local.')
  [void](New-InputRow -Layout $stackRows -Key 'jwtSecreto' -Label 'JWT_SECRETO' -Value $Flow.jwtSecreto -Type 'password' -HelpText 'Solo cambiar si conoces el contrato de autenticacion.')
  [void](New-InputRow -Layout $stackRows -Key 'nodeEnv' -Label 'NODE_ENV' -Value ([string]$Flow.nodeEnv) -Type 'combo' -Options @('production', 'development', 'test') -HelpText 'Por defecto debe permanecer en production.')
  [void](New-InputRow -Layout $stackRows -Key 'corsOrigenes' -Label 'CORS_ORIGENES' -Value $Flow.corsOrigenes -Type 'multiline' -HelpText 'Lista de origenes permitidos para frontend/portal.')
  [void](New-InputRow -Layout $stackRows -Key 'portalAlumnoApiKey' -Label 'PORTAL_ALUMNO_API_KEY' -Value $Flow.portalAlumnoApiKey -Type 'password' -HelpText 'Llave del portal alumno.')
  [void](New-InputRow -Layout $stackRows -Key 'portalApiKey' -Label 'PORTAL_API_KEY' -Value $Flow.portalApiKey -Type 'password' -HelpText 'Llave de API del portal.')
  [void](New-CheckRow -Layout $stackRows -Key 'correoModuloActivo' -Text 'Activar modulo de correo' -Checked (Test-BoolString -Value ([string]$Flow.correoModuloActivo)) -HelpText 'Solo si tu operacion ya cuenta con webhook y token.')
  [void](New-InputRow -Layout $stackRows -Key 'notificacionesWebhookUrl' -Label 'Webhook URL' -Value $Flow.notificacionesWebhookUrl -HelpText 'Endpoint de notificaciones para correo.')
  [void](New-InputRow -Layout $stackRows -Key 'notificacionesWebhookToken' -Label 'Webhook token' -Value $Flow.notificacionesWebhookToken -Type 'password' -HelpText 'Token del webhook de notificaciones.')

  $securityRows = New-Section -Parent $advancedSection.Content -Title 'Seguridad y recuperacion' -Hint 'Recuperacion de contrasena y credenciales Google.' -Variant 'advanced'
  [void](New-CheckRow -Layout $securityRows -Key 'passwordResetEnabled' -Text 'Activar recuperacion de contrasena segura' -Checked (Test-BoolString -Value ([string]$Flow.passwordResetEnabled)) -HelpText 'Se recomienda mantenerlo activo.')
  [void](New-InputRow -Layout $securityRows -Key 'passwordResetTokenMinutes' -Label 'PASSWORD_RESET_TOKEN_MINUTES' -Value ([string]$Flow.passwordResetTokenMinutes) -HelpText 'Minutos de vigencia del token de recuperacion.')
  [void](New-InputRow -Layout $securityRows -Key 'passwordResetUrlBase' -Label 'PASSWORD_RESET_URL_BASE' -Value $Flow.passwordResetUrlBase -HelpText 'URL base usada al enviar enlaces de recuperacion.')
  [void](New-CheckRow -Layout $securityRows -Key 'requireGoogleOAuth' -Text 'Requerir OAuth Google/Classroom' -Checked (Test-BoolString -Value ([string]$Flow.requireGoogleOAuth)) -HelpText 'Solo si la institucion usa integracion con Google.')
  [void](New-InputRow -Layout $securityRows -Key 'googleOauthClientId' -Label 'GOOGLE_OAUTH_CLIENT_ID' -Value $Flow.googleOauthClientId -HelpText 'ClientId principal de OAuth Google.')
  [void](New-InputRow -Layout $securityRows -Key 'googleClassroomClientId' -Label 'GOOGLE_CLASSROOM_CLIENT_ID' -Value $Flow.googleClassroomClientId -HelpText 'ClientId dedicado a Classroom.')
  [void](New-InputRow -Layout $securityRows -Key 'googleClassroomClientSecret' -Label 'GOOGLE_CLASSROOM_CLIENT_SECRET' -Value $Flow.googleClassroomClientSecret -Type 'password' -HelpText 'Secret asociado al cliente Classroom.')
  [void](New-InputRow -Layout $securityRows -Key 'googleClassroomRedirectUri' -Label 'GOOGLE_CLASSROOM_REDIRECT_URI' -Value $Flow.googleClassroomRedirectUri -HelpText 'URI de retorno de Google Classroom.')

  $updateRows = New-Section -Parent $advancedSection.Content -Title 'Actualizaciones' -Hint 'Canal y artefactos del updater.' -Variant 'advanced'
  [void](New-InputRow -Layout $updateRows -Key 'updateChannel' -Label 'Canal' -Value ([string]$Flow.updateChannel) -Type 'combo' -Options @('stable', 'rc', 'beta', 'alpha') -HelpText 'El canal recomendado para usuarios finales es stable.')
  [void](New-InputRow -Layout $updateRows -Key 'updateOwner' -Label 'Owner' -Value $Flow.updateOwner -HelpText 'Owner del repositorio de releases.')
  [void](New-InputRow -Layout $updateRows -Key 'updateRepo' -Label 'Repo' -Value $Flow.updateRepo -HelpText 'Repositorio donde se publica el installer.')
  [void](New-CheckRow -Layout $updateRows -Key 'updateRequireSha256' -Text 'Exigir verificacion SHA-256' -Checked (Test-BoolString -Value ([string]$Flow.updateRequireSha256)) -HelpText 'Debe permanecer activo para validar integridad.')
  [void](New-InputRow -Layout $updateRows -Key 'updateAssetName' -Label 'Asset instalador' -Value $Flow.updateAssetName -HelpText 'Nombre del EXE que se buscara en release.')
  [void](New-InputRow -Layout $updateRows -Key 'updateShaAssetName' -Label 'Asset SHA' -Value $Flow.updateShaAssetName -HelpText 'Hash SHA asociado al instalador.')
  [void](New-InputRow -Layout $updateRows -Key 'updateFeedUrl' -Label 'Feed URL (opcional)' -Value $Flow.updateFeedUrl -HelpText 'Solo si usas feed alterno a GitHub Releases.')

  $pageVerification = New-Page -Title 'Verificacion' -Description 'Antes de ejecutar, el asistente valida prerequisitos, salud local y posibles riesgos.'
  [void](Add-Paragraph -Parent $pageVerification -Text 'La idea es que leas esta pantalla en menos de cinco segundos y sepas si debes instalar, reparar o revisar algo.' -Color $theme.textMuted -Bottom 14)
  $verifyCardsHost = New-Object System.Windows.Forms.FlowLayoutPanel
  $verifyCardsHost.Dock = 'Top'
  $verifyCardsHost.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
  $verifyCardsHost.WrapContents = $false
  $verifyCardsHost.AutoSize = $true
  [void]$pageVerification.Controls.Add($verifyCardsHost)
  New-StatusCard -Parent $verifyCardsHost -Key 'verifyAction' -Title 'Accion recomendada' -Body 'Pendiente.' | Out-Null
  New-StatusCard -Parent $verifyCardsHost -Key 'verifyPrereq' -Title 'Prerequisitos' -Body 'Pendiente.' | Out-Null
  New-StatusCard -Parent $verifyCardsHost -Key 'verifyHealth' -Title 'Estado local' -Body 'Pendiente.' | Out-Null
  New-StatusCard -Parent $verifyCardsHost -Key 'verifyRisk' -Title 'Antes de ejecutar' -Body 'Pendiente.' | Out-Null

  $pageResult = New-Page -Title 'Instalacion y resultado' -Description 'Aqui veras el progreso por fases, el resumen final y herramientas de cierre.'
  New-StatusCard -Parent $pageResult -Key 'resultSummary' -Title 'Estado general' -Body 'Todavia no se ha ejecutado ningun flujo.' | Out-Null
  $phaseCardsHost = New-Object System.Windows.Forms.FlowLayoutPanel
  $phaseCardsHost.Dock = 'Top'
  $phaseCardsHost.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
  $phaseCardsHost.WrapContents = $false
  $phaseCardsHost.AutoSize = $true
  [void]$pageResult.Controls.Add($phaseCardsHost)
  foreach ($phase in $phaseOrder) {
    $card = New-Card -Parent $phaseCardsHost -Dock 'Top' -Padding 14 -MarginBottom 8 -BackColor $theme.cardAlt
    $label = New-TitleLabel -Text $phaseTitles[$phase] -Font $theme.labelFont -Color $theme.text
    [void]$card.Controls.Add($label)
    $badge = Add-Paragraph -Parent $card -Text 'Pendiente' -Color $theme.textMuted -Bottom 0 -Font $theme.smallFont
    $ui.phaseCards[$phase] = [pscustomobject]@{ card = $card; label = $label; badge = $badge }
  }

  $toolsSection = New-AdvancedSection -Parent $pageResult -Title 'Mostrar herramientas' -Hint 'Acciones secundarias para soporte y cierre del proceso.'
  $toolsRow = New-Object System.Windows.Forms.FlowLayoutPanel
  $toolsRow.Dock = 'Top'
  $toolsRow.AutoSize = $true
  $toolsRow.WrapContents = $true
  [void]$toolsSection.Content.Controls.Add($toolsRow)

  function New-ToolButton {
    param([string]$Text)
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Width = 170
    $button.Height = 40
    $button.Margin = New-Object System.Windows.Forms.Padding(0, 0, 10, 10)
    $button.Font = $theme.buttonFont
    $button.BackColor = $theme.primarySoft
    $button.ForeColor = $theme.primary
    [void]$toolsRow.Controls.Add($button)
    return $button
  }

  $btnOpenDashboard = New-ToolButton -Text 'Abrir dashboard'
  $btnOpenFolder = New-ToolButton -Text 'Abrir carpeta'
  $btnOpenLogs = New-ToolButton -Text 'Abrir logs'
  $btnVerify = New-ToolButton -Text 'Verificar estado'
  $btnRegenShortcuts = New-ToolButton -Text 'Regenerar accesos'

  function Add-UiLog {
    param([string]$Level, [string]$Message)
    $line = '[{0}] [{1}] {2}' -f (Get-Date).ToString('HH:mm:ss'), $Level, $Message
    $logBox.AppendText($line + [Environment]::NewLine)
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
    Write-InstallerHubLog -Context ([pscustomobject]@{ FilePath = $Flow.logPath }) -Level $Level -Message $Message
    [System.Windows.Forms.Application]::DoEvents()
  }
  $uiLog = {
    param([string]$Level, [string]$Message)
    $line = '[{0}] [{1}] {2}' -f (Get-Date).ToString('HH:mm:ss'), $Level, $Message
    $logBox.AppendText($line + [Environment]::NewLine)
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
    Write-InstallerHubLog -Context ([pscustomobject]@{ FilePath = $Flow.logPath }) -Level $Level -Message $Message
    [System.Windows.Forms.Application]::DoEvents()
  }.GetNewClosure()

  function Show-HubDialog {
    param(
      [string]$Text,
      [string]$Title,
      [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information
    )
    if ($suppressDialogsForTests -or $isGuiSelfTest) {
      & $uiLog 'dialog' ("SUPPRESSED_DIALOG [$Title] " + ($Text -replace "`r?`n", ' | '))
      return [System.Windows.Forms.DialogResult]::OK
    }
    return [System.Windows.Forms.MessageBox]::Show(
      $Text,
      $Title,
      [System.Windows.Forms.MessageBoxButtons]::OK,
      $Icon
    )
  }

  function Set-FlowInstallationHealth {
    param([object]$Value)
    if ($Flow.PSObject.Properties.Match('installationHealth').Count -eq 0) {
      Add-Member -InputObject $Flow -NotePropertyName 'installationHealth' -NotePropertyValue $Value -Force
      return
    }
    $Flow.installationHealth = $Value
  }

  function Refresh-UiState {
    Sync-UiToFlow
    $ui.uiState = New-UiState
    $ui.uiState.preflight = Test-InstallerHubGuiPreflight -ModulesPath 'ok' -PrereqManifestPath $PrereqManifestPath
    try {
      $ui.uiState.health = Get-EvaluaProInstallationHealth -InstallDir ([string]$Flow.installDir)
      Set-FlowInstallationHealth -Value $ui.uiState.health
    } catch {
      $ui.uiState.health = [pscustomobject]@{ state = 'desconocido'; issues = @($_.Exception.Message) }
      Set-FlowInstallationHealth -Value $ui.uiState.health
    }

    $ui.uiState.detectedFlavorName = [string]$Flow.flavor.displayName
    $healthState = [string]$ui.uiState.health.state
    switch ($healthState) {
      'ok' {
        $ui.uiState.heroTitle = 'Detecte una instalacion operativa de EvaluaPro'
        $ui.uiState.heroBody = 'Puedes abrir el dashboard, verificar el estado o ejecutar una reparacion controlada sin reconfigurar todo.'
        $ui.uiState.recommendation = 'Recomendacion: reparar o abrir instalacion existente.'
        $ui.uiState.recommendationBadge = 'Instalacion operativa'
        $ui.uiState.runLabel = 'Reparar / abrir instalacion'
        $ui.uiState.installStateLabel = 'Equipo listo; se detecto instalacion funcional.'
        $ui.uiState.riskSummary = 'El riesgo tecnico es bajo. La reparacion solo se recomienda si notas fallos o quieres refrescar artefactos.'
      }
      'ausente' {
        $ui.uiState.heroTitle = 'Detecte que este equipo aun no tiene EvaluaPro instalado'
        $ui.uiState.heroBody = 'El asistente preparara la instalacion con valores recomendados para que avances sin abrir opciones tecnicas.'
        $ui.uiState.recommendation = 'Recomendacion: instalar ahora con configuracion guiada.'
        $ui.uiState.recommendationBadge = 'Instalacion nueva'
        $ui.uiState.runLabel = 'Instalar ahora'
        $ui.uiState.installStateLabel = 'No se encontro instalacion previa.'
        $ui.uiState.riskSummary = 'Debes confirmar carpeta, correo de licencia y puertos antes de iniciar.'
      }
      default {
        $ui.uiState.heroTitle = 'Detecte una instalacion existente que conviene reparar'
        $ui.uiState.heroBody = 'Hay indicios de instalacion incompleta o degradada. El asistente propone repararla antes de cualquier otro paso.'
        $ui.uiState.recommendation = 'Recomendacion: reparar instalacion y revisar prerequisitos antes de continuar.'
        $ui.uiState.recommendationBadge = 'Instalacion degradada'
        $ui.uiState.runLabel = 'Reparar instalacion'
        $ui.uiState.installStateLabel = 'Se detectaron componentes faltantes o inconsistencias.'
        $ui.uiState.riskSummary = if ($ui.uiState.health.issues.Count -gt 0) { ($ui.uiState.health.issues -join ' | ') } else { 'Hay inconsistencias que deben corregirse.' }
      }
    }

    if (-not $ui.uiState.preflight.ok) {
      $ui.uiState.prereqLabel = 'Preflight con incidencias: ' + ($ui.uiState.preflight.issues -join ' | ')
    } else {
      $ui.uiState.prereqLabel = 'Preflight OK: modulos y manifiestos resueltos correctamente.'
    }

    $ui.uiState.quickSummary = 'Detectado: ' + $ui.uiState.detectedFlavorName + ' | Modo sugerido: ' + [string]$Flow.resolvedMode + ' | Carpeta: ' + [string]$Flow.installDir
    $ui.uiState.canProceed = (Test-QuickInputs)
  }

  function Render-UiState {
    $brandTitle.Text = $ui.uiState.recommendationBadge
    $brandSummary.Text = $ui.uiState.recommendation
    $heroActionLabel.Text = $ui.uiState.heroTitle
    $ui.inputs['smartRecommendedAction'].SelectedItem = [string]$Flow.resolvedMode
    Update-StatusCard -Key 'detectSummary' -Title 'Deteccion inicial' -Body $ui.uiState.quickSummary -Tone 'neutral'
    Update-StatusCard -Key 'inferredCard' -Title 'Inferido' -Body ('Accion: {0} | Carpeta: {1}' -f [string]$Flow.resolvedMode, [string]$Flow.installDir) -Tone 'success'
    $manualBody = 'Nada pendiente.'
    if (-not $ui.uiState.canProceed -and $ui.uiState.missingFields.Count -gt 0) {
      $manualBody = 'Faltan datos rapidos: ' + ($ui.uiState.missingFields -join ', ')
    }
    Update-StatusCard -Key 'verifyAction' -Title 'Accion recomendada' -Body $ui.uiState.recommendation -Tone 'success'
    Update-StatusCard -Key 'verifyPrereq' -Title 'Prerequisitos' -Body $ui.uiState.prereqLabel -Tone $(if ($ui.uiState.preflight.ok) { 'success' } else { 'danger' })
    $healthBody = 'Estado: ' + [string]$ui.uiState.health.state
    if ($ui.uiState.health.issues.Count -gt 0) {
      $healthBody += ' | ' + ($ui.uiState.health.issues -join ' | ')
    }
    Update-StatusCard -Key 'verifyHealth' -Title 'Estado local' -Body $healthBody -Tone $(if ([string]$ui.uiState.health.state -eq 'ok') { 'success' } elseif ([string]$ui.uiState.health.state -eq 'ausente') { 'warn' } else { 'danger' })
    Update-StatusCard -Key 'verifyRisk' -Title 'Antes de ejecutar' -Body $ui.uiState.riskSummary -Tone $(if ($ui.uiState.canProceed) { 'warn' } else { 'danger' })
    Update-StatusCard -Key 'resultSummary' -Title 'Estado general' -Body ($ui.uiState.resultSummary + ' ' + $ui.uiState.resultDetail) -Tone 'neutral'
    $statusLabel.Text = $ui.uiState.heroTitle
    $statusDetailLabel.Text = $ui.uiState.heroBody
    $btnRun.Text = $ui.uiState.runLabel
  }
  function Show-Page {
    param([int]$Index)
    if ($Index -lt 0) { $Index = 0 }
    if ($Index -ge $ui.pages.Count) { $Index = $ui.pages.Count - 1 }
    for ($i = 0; $i -lt $ui.pages.Count; $i++) {
      $ui.pages[$i].Visible = ($i -eq $Index)
    }
    $ui.currentPageIndex = $Index
    Set-StepperState -Index $Index
    $btnBack.Enabled = ($Index -gt 0)
    $btnNext.Enabled = ($Index -lt ($ui.pages.Count - 1))
    $btnRun.Enabled = ($Index -eq ($ui.pages.Count - 1))
  }

  function Update-ExecutionPhaseUi {
    param([string]$Name, [string]$State, [string]$StatusText)
    if ($phaseIndex.ContainsKey($Name)) {
      Update-PhaseCard -PhaseName $Name -State $State
    }
    if ($StatusText) {
      $statusLabel.Text = $StatusText
      $statusDetailLabel.Text = 'El proceso esta actualizando componentes y verificaciones en tiempo real.'
      $ui.uiState.resultSummary = $StatusText
      Update-StatusCard -Key 'resultSummary' -Title 'Estado general' -Body $ui.uiState.resultSummary -Tone 'neutral'
    }
  }

  function Reset-ExecutionUi {
    foreach ($phase in $phaseOrder) {
      Update-PhaseCard -PhaseName $phase -State 'pending'
    }
    $ui.uiState.resultSummary = 'Listo para ejecutar el flujo.'
    $ui.uiState.resultDetail = 'En cuanto inicies, veras aqui el avance detallado por fases.'
    Update-StatusCard -Key 'resultSummary' -Title 'Estado general' -Body $ui.uiState.resultSummary -Tone 'neutral'
  }

  function Run-InstallerFlowUi {
    if (-not (Test-QuickInputs)) {
      $statusLabel.Text = 'Faltan datos minimos antes de continuar'
      $statusDetailLabel.Text = 'Corrige los campos marcados en rojo. No necesitas abrir opciones tecnicas para resolver esto.'
      return
    }

    if ($isGuiSelfTest -and $skipFlowInGuiSelfTest) {
      Reset-ExecutionUi
      $statusLabel.Text = 'Self-test GUI: flujo simulado'
      $statusDetailLabel.Text = 'Se valido click de ejecucion sin correr instalacion real.'
      foreach ($phase in $phaseOrder) {
        Update-PhaseCard -PhaseName $phase -State 'done'
      }
      $ui.uiState.resultSummary = 'Self-test GUI completo (flujo simulado).'
      $ui.uiState.resultDetail = 'Se validaron acciones clickeables y navegacion.'
      Update-StatusCard -Key 'resultSummary' -Title 'Estado general' -Body ($ui.uiState.resultSummary + ' ' + $ui.uiState.resultDetail) -Tone 'success'
      & $uiLog 'test' 'UI_SELFTEST_RUN_SIMULATED'
      return
    }

    try {
      Reset-ExecutionUi
      Sync-UiToFlow
      Refresh-UiState
      Render-UiState
      Show-Page -Index 3
      Add-UiLog 'system' ('Resumen inicial: ' + $ui.uiState.quickSummary)
      Add-UiLog 'system' ('Flavor: {0} | modo solicitado: {1} | modo efectivo: {2}' -f $Flow.flavorId, $Flow.requestedMode, $Flow.resolvedMode)

      Invoke-InstallerFlowCore -OnUiLog {
        param($lvl, $msg)
        Add-UiLog $lvl $msg
      } -OnStepUpdate {
        param($idx, $state, $txt)
        if ($idx -ge 2 -and $idx -le 9) {
          Update-ExecutionPhaseUi -Name $phaseOrder[$idx - 2] -State $state -StatusText $txt
        } elseif ($txt) {
          $statusLabel.Text = $txt
          $ui.uiState.resultSummary = $txt
        }
      }

      $summary = 'Proceso completado correctamente (exit=0).'
      if ($Flow.rebootRequired) {
        $summary += ' Reinicio recomendado por msiexec (3010).'
      }
      $ui.uiState.resultSummary = $summary
      $ui.uiState.resultDetail = 'Fase final: ' + [string]$Flow.lastPhase + ' | Log: ' + [string]$Flow.logPath
      Update-StatusCard -Key 'resultSummary' -Title 'Estado general' -Body ($ui.uiState.resultSummary + ' ' + $ui.uiState.resultDetail) -Tone 'success'
      $statusLabel.Text = 'Instalacion completada'
      $statusDetailLabel.Text = $ui.uiState.resultDetail
      Add-UiLog 'ok' $summary
      Show-HubDialog -Text $summary -Title 'EvaluaPro Installer Hub' -Icon ([System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    } catch {
      $code = if ($Flow.exitCode -gt 0) { $Flow.exitCode } else { 1 }
      Update-ExecutionPhaseUi -Name $Flow.lastPhase -State 'error' -StatusText ('Proceso fallido (exit=' + $code + ').')
      $ui.uiState.resultSummary = "Fallo en fase '$($Flow.lastPhase)': $($_.Exception.Message)"
      $ui.uiState.resultDetail = 'Revisa el log: ' + [string]$Flow.logPath
      Update-StatusCard -Key 'resultSummary' -Title 'Estado general' -Body ($ui.uiState.resultSummary + ' ' + $ui.uiState.resultDetail) -Tone 'danger'
      $statusLabel.Text = 'Se detecto un error durante la ejecucion'
      $statusDetailLabel.Text = $ui.uiState.resultDetail
      Add-UiLog 'error' $ui.uiState.resultSummary
      Show-HubDialog -Text ("Ocurrio un error (exit=$code):`n$($_.Exception.Message)`n`nRevisa el log:`n$($Flow.logPath)") -Title 'EvaluaPro Installer Hub' -Icon ([System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
    }
  }

  $ui.inputs['mode'].Add_SelectedIndexChanged({
    Sync-UiToFlow
    Refresh-UiState
    Render-UiState
  })
  $ui.inputs['flavor'].Add_SelectedIndexChanged({
    try {
      $selectedFlavor = Get-InstallerFlavorDefinition -FlavorId ([string]$ui.inputs['flavor'].SelectedItem)
      $Flow.flavor = $selectedFlavor
      $Flow.flavorId = [string]$selectedFlavor.flavorId
      $ui.inputs['updateAssetName'].Text = [string]$selectedFlavor.installerHubExeName
      $ui.inputs['updateShaAssetName'].Text = ([string]$selectedFlavor.installerHubExeName + '.sha256')
      if (-not $Flow.installation -or -not $Flow.installation.Installed) {
        $ui.inputs['installDir'].Text = Get-DefaultInstallDirForFlavor -Flavor $selectedFlavor
      }
      Sync-UiToFlow
      Refresh-UiState
      Render-UiState
    } catch {}
  })
  $btnBack.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_BACK'
    Show-Page -Index ($ui.currentPageIndex - 1)
  })
  $btnNext.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_NEXT'
    if ($ui.currentPageIndex -eq 1) {
      Test-QuickInputs | Out-Null
      Refresh-UiState
      Render-UiState
      if (-not $ui.uiState.canProceed) {
        $statusLabel.Text = 'Completa la revision rapida antes de continuar'
        $statusDetailLabel.Text = 'Solo faltan los campos minimos visibles; no necesitas entrar a opciones tecnicas.'
        return
      }
    }
    Show-Page -Index ($ui.currentPageIndex + 1)
  })
  $btnRun.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_RUN'
    Run-InstallerFlowUi
  })
  $btnExit.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_CLOSE'
    $form.Close()
  })
  $btnOpenLogs.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_OPEN_LOGS'
    if ($isGuiSelfTest) {
      & $uiLog 'test' 'UI_CLICK_OPEN_LOGS_OK'
      return
    }
    $logDir = Split-Path -Parent $Flow.logPath
    if (Test-Path $logDir) {
      Start-Process explorer.exe -ArgumentList ('"{0}"' -f $logDir) | Out-Null
    }
  })
  $btnOpenFolder.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_OPEN_FOLDER'
    if ($isGuiSelfTest) {
      & $uiLog 'test' 'UI_CLICK_OPEN_FOLDER_OK'
      return
    }
    if ($Flow.installDir -and (Test-Path $Flow.installDir)) {
      Start-Process explorer.exe -ArgumentList ('"{0}"' -f $Flow.installDir) | Out-Null
    }
  })
  $btnOpenDashboard.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_OPEN_DASHBOARD'
    if ($isGuiSelfTest) {
      & $uiLog 'test' 'UI_CLICK_OPEN_DASHBOARD_OK'
      return
    }
    try {
      $installation = Get-EvaluaProInstallationInfo
      $installLocation = [string]$installation.InstallLocation
      if (-not $installLocation) { $installLocation = $Flow.installDir }
      $launcher = Join-Path $installLocation 'scripts\launcher-tray-hidden.vbs'
      if (Test-Path $launcher) {
        Start-Process -FilePath 'wscript.exe' -ArgumentList ('//nologo "{0}" prod 4519' -f $launcher) -WindowStyle Hidden | Out-Null
      } else {
        Start-Process 'http://127.0.0.1:4519/' | Out-Null
      }
    } catch {
      Show-HubDialog -Text 'No se pudo abrir el dashboard automaticamente.' -Title 'EvaluaPro Installer Hub' -Icon ([System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    }
  })
  $btnVerify.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_VERIFY'
    Refresh-UiState
    Render-UiState
    Show-HubDialog -Text ('Estado: ' + [string]$ui.uiState.health.state + "`n`n" + (($ui.uiState.health.issues | ForEach-Object { '- ' + $_ }) -join [Environment]::NewLine)) -Title 'EvaluaPro Installer Hub' -Icon ([System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
  })
  $btnRegenShortcuts.Add_Click({
    & $uiLog 'ui' 'UI_CLICK_REGEN_SHORTCUTS'
    if ($isGuiSelfTest) {
      & $uiLog 'test' 'UI_CLICK_REGEN_SHORTCUTS_OK'
      return
    }
    try {
      $installation = Get-EvaluaProInstallationInfo
      $installLocation = [string]$installation.InstallLocation
      if (-not $installLocation) { $installLocation = $Flow.installDir }
      $scriptPath = Join-Path $installLocation 'scripts\create-shortcuts.ps1'
      if (-not (Test-Path -LiteralPath $scriptPath)) {
        throw "No se encontro create-shortcuts.ps1 en $installLocation"
      }
      Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -Port 4519 -Force' -f $scriptPath) -WindowStyle Hidden -Wait | Out-Null
      & $uiLog 'ok' 'Accesos directos regenerados desde Hub.'
      Refresh-UiState
      Render-UiState
    } catch {
      & $uiLog 'error' ("No se pudieron regenerar accesos: $($_.Exception.Message)")
    }
  })

  Add-UiLog 'system' ('Sesion iniciada. Log: ' + [string]$Flow.logPath)
  Add-UiLog 'info' ('Prereq manifest: ' + [string]$PrereqManifestPath)
  Sync-UiToFlow
  Refresh-UiState
  Render-UiState
  Add-UiLog 'info' ('Resumen inicial: ' + $ui.uiState.quickSummary)
  Show-Page -Index 0

  if ($isGuiSelfTest) {
    & $uiLog 'test' 'UI_SELFTEST_START'
    $selfTestTimer = New-Object System.Windows.Forms.Timer
    $selfTestTimer.Interval = 650
    $selfTestTimer.Add_Tick({
      $selfTestTimer.Stop()
      try {
        & $uiLog 'test' 'UI_CLICK_TECH_TOGGLE_OPEN'
        $techSection.Toggle.PerformClick()
        Start-Sleep -Milliseconds 150
        & $uiLog 'test' 'UI_CLICK_TECH_TOGGLE_CLOSE'
        $techSection.Toggle.PerformClick()
        Start-Sleep -Milliseconds 150

        $btnNext.PerformClick()
        Start-Sleep -Milliseconds 150

        & $uiLog 'test' 'UI_CLICK_ADVANCED_TOGGLE_OPEN'
        $advancedSection.Toggle.PerformClick()
        Start-Sleep -Milliseconds 150
        & $uiLog 'test' 'UI_CLICK_ADVANCED_TOGGLE_CLOSE'
        $advancedSection.Toggle.PerformClick()
        Start-Sleep -Milliseconds 150

        $btnNext.PerformClick()
        Start-Sleep -Milliseconds 150
        $btnNext.PerformClick()
        Start-Sleep -Milliseconds 150

        & $uiLog 'test' 'UI_CLICK_TOOLS_TOGGLE_OPEN'
        $toolsSection.Toggle.PerformClick()
        Start-Sleep -Milliseconds 150

        $btnOpenLogs.PerformClick()
        $btnOpenFolder.PerformClick()
        $btnOpenDashboard.PerformClick()
        $btnVerify.PerformClick()
        $btnRegenShortcuts.PerformClick()
        & $uiLog 'test' 'UI_CLICK_TOOLS_TOGGLE_CLOSE'
        $toolsSection.Toggle.PerformClick()
        Start-Sleep -Milliseconds 150
        $btnRun.PerformClick()
        Start-Sleep -Milliseconds 150

        if ($btnBack.Enabled) { $btnBack.PerformClick() }
        Start-Sleep -Milliseconds 150
        if ($btnNext.Enabled) { $btnNext.PerformClick() }

        & $uiLog 'test' 'UI_SELFTEST_OK'
      } catch {
        & $uiLog 'error' ("UI_SELFTEST_FAILED: $($_.Exception.Message)")
      } finally {
        $form.Close()
      }
    }.GetNewClosure())
    $selfTestTimer.Start()
  }

  if (@('1', 'true', 'yes', 'on') -contains [string]$env:EVALUAPRO_INSTALLER_GUI_SMOKE) {
    $closeAfterMs = 3500
    $rawCloseAfterMs = [string]$env:EVALUAPRO_INSTALLER_GUI_AUTO_CLOSE_MS
    if (-not [string]::IsNullOrWhiteSpace($rawCloseAfterMs)) {
      try { $closeAfterMs = [int]$rawCloseAfterMs } catch {}
    }
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = [Math]::Max(1000, $closeAfterMs)
    $timer.Add_Tick({
      $timer.Stop()
      $form.Close()
  })
    $timer.Start()
  }

  [void]$form.ShowDialog()
}

Export-ModuleMember -Function @(
  'Test-InstallerHubGuiPreflight',
  'Invoke-InstallerHubWizardUi'
)

