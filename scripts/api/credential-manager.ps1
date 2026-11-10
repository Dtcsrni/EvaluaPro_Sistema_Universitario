param(
  [Parameter(Mandatory = $true)][ValidateSet('read', 'write', 'delete')][string]$Operation,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9/_-]{1,200}$')][string]$Target
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class EvaluaProCredentialManager {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct Credential {
    public uint Flags;
    public uint Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public long LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  [DllImport("Advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredWrite(ref Credential credential, uint flags);
  [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("Advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredDelete(string target, uint type, uint flags);
  [DllImport("Advapi32.dll", SetLastError = false)]
  private static extern void CredFree(IntPtr credential);

  public static void Write(string target, string value) {
    byte[] bytes = Encoding.UTF8.GetBytes(value ?? "");
    if (bytes.Length == 0 || bytes.Length > 2500) throw new InvalidOperationException("Credential size is invalid.");
    IntPtr blob = Marshal.AllocHGlobal(bytes.Length);
    try {
      Marshal.Copy(bytes, 0, blob, bytes.Length);
      IntPtr targetPointer = Marshal.StringToHGlobalUni(target);
      IntPtr userPointer = Marshal.StringToHGlobalUni(Environment.UserName);
      Credential credential = new Credential {
        Type = 1,
        TargetName = targetPointer,
        CredentialBlob = blob,
        CredentialBlobSize = (uint)bytes.Length,
        Persist = 2,
        UserName = userPointer
      };
      try {
        if (!CredWrite(ref credential, 0)) throw new InvalidOperationException("Windows Credential Manager write failed.");
      } finally {
        Marshal.FreeHGlobal(targetPointer);
        Marshal.FreeHGlobal(userPointer);
      }
    } finally {
      for (int i = 0; i < bytes.Length; i++) Marshal.WriteByte(blob, i, 0);
      Marshal.FreeHGlobal(blob);
      Array.Clear(bytes, 0, bytes.Length);
    }
  }

  public static string Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) {
      if (Marshal.GetLastWin32Error() == 1168) return null;
      throw new InvalidOperationException("Windows Credential Manager read failed.");
    }
    try {
      Credential credential = Marshal.PtrToStructure<Credential>(pointer);
      if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0 || credential.CredentialBlobSize > 2500) return null;
      int size = checked((int)credential.CredentialBlobSize);
      byte[] bytes = new byte[size];
      try {
        Marshal.Copy(credential.CredentialBlob, bytes, 0, bytes.Length);
        return Encoding.UTF8.GetString(bytes);
      } finally {
        Array.Clear(bytes, 0, bytes.Length);
        for (int i = 0; i < size; i++) Marshal.WriteByte(credential.CredentialBlob, i, 0);
      }
    } finally {
      CredFree(pointer);
    }
  }

  public static void Delete(string target) {
    if (!CredDelete(target, 1, 0) && Marshal.GetLastWin32Error() != 1168) {
      throw new InvalidOperationException("Windows Credential Manager delete failed.");
    }
  }
}
'@

$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json -ErrorAction Stop
switch ($Operation) {
  'read' {
    $value = [EvaluaProCredentialManager]::Read($Target)
    @{ value = $value } | ConvertTo-Json -Compress
  }
  'write' {
    [EvaluaProCredentialManager]::Write($Target, [string]$payload.value)
    '{"ok":true}'
  }
  'delete' {
    [EvaluaProCredentialManager]::Delete($Target)
    '{"ok":true}'
  }
}
