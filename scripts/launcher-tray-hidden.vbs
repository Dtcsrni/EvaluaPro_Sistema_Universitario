' Launches the tray PowerShell wrapper fully hidden.
' Usage: wscript.exe //nologo launcher-tray-hidden.vbs <mode> <port>

Option Explicit

Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim q
q = Chr(34)

Dim scriptDir, rootDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)

Dim mode, port
mode = "none"
port = "4519"
If WScript.Arguments.Count >= 1 Then mode = ResolveMode(WScript.Arguments(0))
If WScript.Arguments.Count >= 2 Then port = ResolvePort(WScript.Arguments(1), "4519")

shell.CurrentDirectory = rootDir

' Show a lightweight splash while starting (only when a port is provided).
Dim splashExec
Set splashExec = Nothing
If port <> "0" And port <> "" Then
	On Error Resume Next
	Set splashExec = shell.Exec("mshta.exe " & q & rootDir & "\scripts\dashboard-splash.hta?port=" & port & "&mode=" & mode & q)
	If Err.Number = 0 Then
		' Try to bring splash to foreground.
		shell.AppActivate splashExec.ProcessID
	End If
	On Error GoTo 0
End If

Dim psExe, psArgs, cmd
psExe = ResolvePowerShellExe(shell.ExpandEnvironmentStrings("%WINDIR%"))
psArgs = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & q & rootDir & "\scripts\launcher-tray.ps1" & q & " -Mode " & QuoteArg(mode) & " -Port " & QuoteArg(port) & " -NoOpen"
cmd = psExe & " " & psArgs

shell.Run cmd, 0, False

' Wait until the dashboard HTTP endpoint responds, then open browser and close splash.
If port <> "0" And port <> "" Then
	Dim ok, tries, maxTries, url
	Dim startedFallback
	Dim splashStartMs, minSplashMs
	Dim healthOk, healthTries, healthMaxTries, baseUrl
	Dim strictHealth
	splashStartMs = Timer
	minSplashMs = 1.2 ' seconds
	ok = False
	healthOk = False
	strictHealth = (LCase(mode) = "dev" Or LCase(mode) = "prod")
	tries = 0
	startedFallback = False
	maxTries = 120 ' ~24s with 200ms sleep
	url = "http://127.0.0.1:" & port & "/api/status"
	baseUrl = "http://127.0.0.1:" & port

	Do While (tries < maxTries) And (ok = False)
		tries = tries + 1
		Dim lockPort
		lockPort = ReadLockPort(rootDir)
		If lockPort <> "" And lockPort <> port Then
			port = lockPort
			url = "http://127.0.0.1:" & port & "/api/status"
			baseUrl = "http://127.0.0.1:" & port
		End If
		ok = HttpOk(url)
		If ok = False Then
			If (startedFallback = False) And (tries >= 6) Then
				StartDashboardFallback rootDir, mode, port
				startedFallback = True
			End If
			WScript.Sleep 200
		End If
	Loop

	If ok = True And strictHealth = True Then
		healthTries = 0
		healthMaxTries = 180 ' ~90s con 500ms
		Do While (healthTries < healthMaxTries) And (healthOk = False)
			healthTries = healthTries + 1
			lockPort = ReadLockPort(rootDir)
			If lockPort <> "" And lockPort <> port Then
				port = lockPort
				baseUrl = "http://127.0.0.1:" & port
			End If
			healthOk = ApiHealthReady(baseUrl & "/api/health")
			If healthOk = False Then
				WScript.Sleep 500
			End If
		Loop
	End If

	If ok = True And (healthOk = True Or strictHealth = False) Then
		shell.Run "cmd.exe /c start " & q & q & " " & q & "http://127.0.0.1:" & port & "/" & q, 0, False
		AppendShortcutLog rootDir, "Arranque OK en puerto " & port & " (salud confirmada)."
	ElseIf ok = True And healthOk = False And strictHealth = True Then
		AppendShortcutLog rootDir, "Dashboard activo pero salud incompleta en puerto " & port & "."
		On Error Resume Next
		If Not (splashExec Is Nothing) Then splashExec.Terminate
		KillSplashByWmi
		On Error GoTo 0
		MsgBox "EvaluaPro detectó dashboard activo, pero stack/portal no alcanzaron salud completa." & vbCrLf & _
			"Revisa Docker Desktop y logs en carpeta 'logs'.", vbExclamation, "EvaluaPro - Inicio parcial"
	Else
		AppendShortcutLog rootDir, "No se pudo levantar dashboard en el tiempo esperado (port=" & port & ")."
		On Error Resume Next
		If Not (splashExec Is Nothing) Then splashExec.Terminate
		KillSplashByWmi
		On Error GoTo 0
		MsgBox "EvaluaPro no pudo iniciar dashboard a tiempo." & vbCrLf & _
			"Verifica Docker Desktop, Node y vuelve a intentar.", vbCritical, "EvaluaPro - Error de inicio"
	End If

	' Close splash only if the dashboard is reachable; otherwise let the HTA show a helpful error.
	If ok = True And healthOk = True Then
		' Ensure the splash stays visible briefly (avoid instant close when already running).
		Dim elapsed
		elapsed = Timer - splashStartMs
		If elapsed < minSplashMs Then
			WScript.Sleep CLng((minSplashMs - elapsed) * 1000)
		End If
		On Error Resume Next
		If Not (splashExec Is Nothing) Then
			splashExec.Terminate
		End If
		' Fallback: ensure no lingering mshta.exe stays open.
		KillSplashByWmi
		On Error GoTo 0
	End If
End If

Sub KillSplashByWmi()
	On Error Resume Next
	Dim svc, procs, p, cmdline
	Set svc = GetObject("winmgmts:{impersonationLevel=impersonate}!\\.\root\cimv2")
	Set procs = svc.ExecQuery("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='mshta.exe'")
	For Each p In procs
		cmdline = LCase(CStr("" & p.CommandLine))
		If InStr(1, cmdline, "dashboard-splash.hta", vbTextCompare) > 0 Then
			p.Terminate
		End If
	Next
	On Error GoTo 0
End Sub

Function HttpOk(ByVal u)
	On Error Resume Next
	Dim req
	Set req = CreateObject("WinHttp.WinHttpRequest.5.1")
	req.Open "GET", u, False
	req.SetTimeouts 300, 300, 300, 600
	req.Send
	If Err.Number <> 0 Then
		Err.Clear
		HttpOk = False
	Else
		' Consider any 2xx/3xx/4xx (except connection errors) as "server is up".
		If (req.Status >= 200) And (req.Status < 500) Then
			HttpOk = True
		Else
			HttpOk = False
		End If
	End If
	On Error GoTo 0
End Function

Function RegexTest(ByVal txt, ByVal pattern)
	On Error Resume Next
	Dim re
	Set re = New RegExp
	re.Pattern = pattern
	re.IgnoreCase = True
	re.Global = False
	RegexTest = re.Test(txt)
	On Error GoTo 0
End Function

Function ApiHealthReady(ByVal u)
	On Error Resume Next
	Dim req, body, okApi, okPortal
	Set req = CreateObject("WinHttp.WinHttpRequest.5.1")
	req.Open "GET", u, False
	req.SetTimeouts 400, 400, 500, 900
	req.Send
	If Err.Number <> 0 Then
		Err.Clear
		ApiHealthReady = False
		Exit Function
	End If
	If req.Status < 200 Or req.Status >= 500 Then
		ApiHealthReady = False
		Exit Function
	End If
	body = req.ResponseText
	okApi = RegexTest(body, """apiDocente""\s*:\s*\{[\s\S]*?""ok""\s*:\s*true")
	okPortal = RegexTest(body, """apiPortal""\s*:\s*\{[\s\S]*?""ok""\s*:\s*true")
	ApiHealthReady = (okApi And okPortal)
	On Error GoTo 0
End Function

Sub AppendShortcutLog(ByVal rootDir, ByVal message)
	On Error Resume Next
	Dim fso, logDir, logPath, f
	Set fso = CreateObject("Scripting.FileSystemObject")
	logDir = rootDir & "\logs"
	If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
	logPath = logDir & "\shortcut-launch.log"
	Set f = fso.OpenTextFile(logPath, 8, True)
	f.WriteLine "[" & CStr(Now) & "] " & message
	f.Close
	On Error GoTo 0
End Sub

Sub StartDashboardFallback(ByVal rootDir, ByVal mode, ByVal port)
	On Error Resume Next
	Dim psExe, psArgs, cmd
	psExe = ResolvePowerShellExe(shell.ExpandEnvironmentStrings("%WINDIR%"))
	psArgs = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & q & rootDir & "\scripts\launcher-dashboard.ps1" & q & " -Mode " & QuoteArg(mode) & " -NoOpen"
	If port <> "0" And port <> "" Then
		psArgs = psArgs & " -Port " & QuoteArg(port)
	End If
	cmd = psExe & " " & psArgs
	shell.Run cmd, 0, False
	On Error GoTo 0
End Sub

Function QuoteArg(ByVal value)
	QuoteArg = q & Replace(CStr(value), q, "") & q
End Function

Function ResolveMode(ByVal value)
	Dim v
	v = LCase(Trim(CStr(value)))
	Select Case v
		Case "none", "dev", "prod", "auto"
			ResolveMode = v
		Case Else
			ResolveMode = "none"
	End Select
End Function

Function ResolvePort(ByVal value, ByVal defaultPort)
	On Error Resume Next
	Dim v, re, n
	v = Trim(CStr(value))
	If v = "" Then
		ResolvePort = defaultPort
		Exit Function
	End If
	Set re = New RegExp
	re.Pattern = "^[0-9]{1,5}$"
	re.IgnoreCase = True
	If re.Test(v) Then
		n = CLng(v)
		If (n >= 1) And (n <= 65535) Then
			ResolvePort = CStr(n)
			Exit Function
		End If
	End If
	ResolvePort = defaultPort
	On Error GoTo 0
End Function

Function ResolvePowerShellExe(ByVal winDir)
	On Error Resume Next
	Dim candidate
	candidate = winDir & "\System32\WindowsPowerShell\v1.0\powershell.exe"
	If fso.FileExists(candidate) Then
		ResolvePowerShellExe = QuoteArg(candidate)
		Exit Function
	End If
	ResolvePowerShellExe = "powershell.exe"
	On Error GoTo 0
End Function

Function ReadLockPort(ByVal rootDir)
	On Error Resume Next
	Dim fso, p, f, text, re, matches
	Set fso = CreateObject("Scripting.FileSystemObject")
	p = rootDir & "\logs\dashboard.lock.json"
	If Not fso.FileExists(p) Then
		ReadLockPort = ""
		Exit Function
	End If
	Set f = fso.OpenTextFile(p, 1, False)
	text = f.ReadAll
	f.Close
	Set re = New RegExp
	re.Pattern = """port""\s*:\s*([0-9]+)"
	re.IgnoreCase = True
	If re.Test(text) Then
		Set matches = re.Execute(text)
		If matches.Count > 0 Then
			ReadLockPort = matches(0).SubMatches(0)
			Exit Function
		End If
	End If
	ReadLockPort = ""
	On Error GoTo 0
End Function
