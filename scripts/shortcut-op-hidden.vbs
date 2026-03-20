' Launches shortcut operations PowerShell helper hidden.
' Usage: wscript.exe //nologo shortcut-op-hidden.vbs <action> <port> <mode>

Option Explicit

Dim shell, fso
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim q
q = Chr(34)

Dim scriptDir, rootDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)

Dim actionName, port, mode
actionName = "open-dashboard"
port = "4519"
mode = "auto"
If WScript.Arguments.Count >= 1 Then actionName = ResolveAction(WScript.Arguments(0))
If WScript.Arguments.Count >= 2 Then port = ResolvePort(WScript.Arguments(1), "4519")
If WScript.Arguments.Count >= 3 Then mode = ResolveMode(WScript.Arguments(2))

shell.CurrentDirectory = rootDir

Dim psExe, psArgs, cmd
psExe = ResolvePowerShellExe(shell.ExpandEnvironmentStrings("%WINDIR%"))
psArgs = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & q & rootDir & "\scripts\launcher-broker.ps1" & q & _
         " -Action " & QuoteArg(actionName) & " -Port " & QuoteArg(port) & " -Mode " & QuoteArg(mode)
cmd = psExe & " " & psArgs

shell.Run cmd, 0, False

Function QuoteArg(ByVal value)
    QuoteArg = q & Replace(CStr(value), q, "") & q
End Function

Function ResolveAction(ByVal value)
    Dim v
    v = LCase(Trim(CStr(value)))
    Select Case v
        Case "open-dashboard", "restart-stack", "stop-all", "repair", "open-hub", "regenerate-shortcuts", "verify-installation"
            ResolveAction = v
        Case Else
            ResolveAction = "open-dashboard"
    End Select
End Function

Function ResolveMode(ByVal value)
    Dim v
    v = LCase(Trim(CStr(value)))
    Select Case v
        Case "dev", "prod", "auto"
            ResolveMode = v
        Case Else
            ResolveMode = "auto"
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
