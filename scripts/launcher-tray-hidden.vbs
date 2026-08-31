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
mode = "prod"
port = "4519"
If WScript.Arguments.Count >= 1 Then mode = ResolveMode(WScript.Arguments(0))
If WScript.Arguments.Count >= 2 Then port = ResolvePort(WScript.Arguments(1), "4519")
runId = BuildRunId()

shell.CurrentDirectory = rootDir

Dim psExe, psArgs, cmd
psExe = ResolvePowerShellExe(shell.ExpandEnvironmentStrings("%WINDIR%"))
psArgs = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & q & rootDir & "\scripts\launcher-broker.ps1" & q & " -Action open-dashboard -Mode " & QuoteArg(mode) & " -Port " & QuoteArg(port) & " -RunId " & QuoteArg(runId)
cmd = psExe & " " & psArgs

shell.Run cmd, 0, False

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

Function ResolveMode(ByVal value)
	Dim v
	v = LCase(Trim(CStr(value)))
	Select Case v
		Case "none", "dev", "prod", "auto"
			ResolveMode = v
		Case Else
			ResolveMode = "prod"
	End Select
End Function

Function ResolvePort(ByVal value, ByVal defaultPort)
	On Error Resume Next
	Dim v, re, n
	v = Trim(CStr(value))
	If v = "" Or v = "4000" Or v = "4173" Then
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
