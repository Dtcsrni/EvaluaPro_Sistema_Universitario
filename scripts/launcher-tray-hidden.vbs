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

Dim mode, port, runId
mode = "none"
port = "4519"
If WScript.Arguments.Count >= 1 Then mode = ResolveMode(WScript.Arguments(0))
If WScript.Arguments.Count >= 2 Then port = ResolvePort(WScript.Arguments(1), "4519")
runId = BuildRunId()

shell.CurrentDirectory = rootDir

' Show a lightweight splash while starting (only when a port is provided).
Dim splashExec
Set splashExec = Nothing
If port <> "0" And port <> "" Then
	On Error Resume Next
	Set splashExec = shell.Exec("mshta.exe " & q & rootDir & "\scripts\dashboard-splash.hta?port=" & port & "&mode=" & mode & "&runId=" & runId & q)
	If Err.Number = 0 Then
		' Try to bring splash to foreground.
		shell.AppActivate splashExec.ProcessID
	End If
	On Error GoTo 0
End If

Dim psExe, psArgs, cmd
psExe = ResolvePowerShellExe(shell.ExpandEnvironmentStrings("%WINDIR%"))
psArgs = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & q & rootDir & "\scripts\launcher-broker.ps1" & q & " -Action open-dashboard -Mode " & QuoteArg(mode) & " -Port " & QuoteArg(port) & " -RunId " & QuoteArg(runId)
cmd = psExe & " " & psArgs

shell.Run cmd, 0, False

' Wait until the broker reports a final state, then close splash.
If port <> "0" And port <> "" Then
	Dim ok, tries, maxTries, url
	Dim splashStartMs, minSplashMs
	Dim brokerState, brokerStatus
	splashStartMs = Timer
	minSplashMs = 1.2 ' seconds
	ok = False
	tries = 0
	maxTries = 900 ' ~180s with 200ms sleep; the broker can still be bringing up stack/portal.
	url = "http://127.0.0.1:" & port & "/api/status"

	Do While (tries < maxTries) And (ok = False)
		tries = tries + 1
		Dim lockPort
		lockPort = ReadLockPort(rootDir)
		If lockPort <> "" And lockPort <> port Then
			port = lockPort
			url = "http://127.0.0.1:" & port & "/api/status"
		End If
		brokerStatus = ReadBootstrapState(rootDir, runId)
		brokerState = LCase(CStr(GetJsonValue(brokerStatus, "state")))
		If brokerState = "healthy" Then
			ok = True
		ElseIf brokerState = "degraded" Then
			ok = True
		ElseIf brokerState = "failed" Then
			ok = False
			Exit Do
		Else
			WScript.Sleep 200
		End If
	Loop

	If LCase(CStr(GetJsonValue(brokerStatus, "state"))) = "healthy" Then
		AppendShortcutLog rootDir, "Arranque OK en puerto " & port & " (broker=" & runId & ")."
	ElseIf LCase(CStr(GetJsonValue(brokerStatus, "state"))) = "degraded" Then
		AppendShortcutLog rootDir, "Dashboard activo pero salud incompleta en puerto " & port & " (broker=" & runId & ")."
		On Error Resume Next
		If Not (splashExec Is Nothing) Then splashExec.Terminate
		KillSplashByWmi
		On Error GoTo 0
		MsgBox "EvaluaPro detectó dashboard activo, pero stack/portal no alcanzaron salud completa." & vbCrLf & _
			"Revisa el runtime Docker compatible (WSL2 + Docker Engine o Docker Desktop) y logs en carpeta 'logs'.", vbExclamation, "EvaluaPro - Inicio parcial"
	Else
		AppendShortcutLog rootDir, "No se pudo completar arranque por broker (port=" & port & ", runId=" & runId & ")."
		On Error Resume Next
		If Not (splashExec Is Nothing) Then splashExec.Terminate
		KillSplashByWmi
		On Error GoTo 0
		MsgBox "EvaluaPro no pudo iniciar dashboard a tiempo." & vbCrLf & _
			"Verifica Node y un runtime Docker compatible (WSL2 + Docker Engine o Docker Desktop) y vuelve a intentar.", vbCritical, "EvaluaPro - Error de inicio"
	End If

	' Close splash only if the dashboard is reachable; otherwise let the HTA show a helpful error.
	If LCase(CStr(GetJsonValue(brokerStatus, "state"))) = "healthy" Then
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

Function ApiHealthReady(ByVal u, ByVal mode)
	On Error Resume Next
	Dim req, body, okApi, okPortal, okWebDev, okWebProd, normalizedMode, okDocente
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
	okWebDev = RegexTest(body, """webDocenteDev""\s*:\s*\{[\s\S]*?""ok""\s*:\s*true")
	okWebProd = RegexTest(body, """webDocenteProd""\s*:\s*\{[\s\S]*?""ok""\s*:\s*true")
	okPortal = RegexTest(body, """apiPortal""\s*:\s*\{[\s\S]*?""ok""\s*:\s*true")
	normalizedMode = LCase(Trim(CStr(mode)))
	If normalizedMode = "dev" Then
		okDocente = (okApi And okWebDev)
	Else
		okDocente = (okApi And okWebProd)
	End If
	' El acceso directo docente debe abrir cuando la plataforma docente ya es utilizable.
	' El portal alumno sigue intentando levantarse en paralelo, pero no bloquea la apertura.
	ApiHealthReady = okDocente Or (okApi And okPortal)
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

Function QuoteArg(ByVal value)
	QuoteArg = q & Replace(CStr(value), q, "") & q
End Function

Function BuildRunId()
	Dim guid
	On Error Resume Next
	guid = CreateObject("Scriptlet.TypeLib").Guid
	If Err.Number <> 0 Then
		Err.Clear
		guid = CStr(Timer)
	End If
	On Error GoTo 0
	guid = Replace(guid, "{", "")
	guid = Replace(guid, "}", "")
	guid = Replace(guid, "-", "")
	BuildRunId = "ep" & LCase(guid)
End Function

Function ReadBootstrapState(ByVal rootDir, ByVal runId)
	On Error Resume Next
	Dim path, content
	path = rootDir & "\logs\bootstrap-state-" & runId & ".json"
	If Not fso.FileExists(path) Then
		ReadBootstrapState = ""
		Exit Function
	End If
	content = ReadAllText(path)
	ReadBootstrapState = content
	On Error GoTo 0
End Function

Function GetJsonValue(ByVal obj, ByVal key)
	On Error Resume Next
	Dim re
	Set re = New RegExp
	re.Pattern = """" & key & """\s*:\s*""([^""]*)"""
	re.IgnoreCase = True
	re.Global = False
	If re.Test(CStr(obj)) Then
		GetJsonValue = re.Execute(CStr(obj))(0).SubMatches(0)
	Else
		GetJsonValue = ""
	End If
	On Error GoTo 0
End Function

Function ReadAllText(ByVal path)
	On Error Resume Next
	Dim stream
	Set stream = CreateObject("ADODB.Stream")
	stream.Type = 2
	stream.Charset = "utf-8"
	stream.Open
	stream.LoadFromFile path
	ReadAllText = stream.ReadText(-1)
	stream.Close
	Set stream = Nothing
	On Error GoTo 0
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
