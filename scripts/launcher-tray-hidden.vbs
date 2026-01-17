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
If WScript.Arguments.Count >= 1 Then mode = WScript.Arguments(0)
If WScript.Arguments.Count >= 2 Then port = WScript.Arguments(1)

shell.CurrentDirectory = rootDir

Dim psExe, psArgs, cmd
psExe = q & shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe" & q
psArgs = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File " & q & rootDir & "\scripts\launcher-tray.ps1" & q & " -Mode " & mode & " -Port " & port & " -NoOpen"
cmd = psExe & " " & psArgs

shell.Run cmd, 0, False
