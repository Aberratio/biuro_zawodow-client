param(
  [string]$Path = "dist\placeholder.svg",
  [switch]$KillAll
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Path)) {
  Write-Host "No file to unlock: $Path"
  exit 0
}

$targetPath = (Resolve-Path -LiteralPath $Path).Path

$source = @"
using System;
using System.Runtime.InteropServices;

public static class RestartManager {
  const int CCH_RM_MAX_APP_NAME = 255;
  const int CCH_RM_MAX_SVC_NAME = 63;

  enum RM_APP_TYPE {
    RmUnknownApp = 0,
    RmMainWindow = 1,
    RmOtherWindow = 2,
    RmService = 3,
    RmExplorer = 4,
    RmConsole = 5,
    RmCritical = 1000
  }

  [StructLayout(LayoutKind.Sequential)]
  struct RM_UNIQUE_PROCESS {
    public int dwProcessId;
    public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
  }

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct RM_PROCESS_INFO {
    public RM_UNIQUE_PROCESS Process;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)]
    public string strAppName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)]
    public string strServiceShortName;
    public RM_APP_TYPE ApplicationType;
    public uint AppStatus;
    public uint TSSessionId;
    [MarshalAs(UnmanagedType.Bool)]
    public bool bRestartable;
  }

  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmStartSession(out uint pSessionHandle, int dwSessionFlags, string strSessionKey);

  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)]
  static extern int RmRegisterResources(uint pSessionHandle, UInt32 nFiles, string[] rgsFilenames, UInt32 nApplications, IntPtr rgApplications, UInt32 nServices, string[] rgsServiceNames);

  [DllImport("rstrtmgr.dll")]
  static extern int RmGetList(uint dwSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);

  [DllImport("rstrtmgr.dll")]
  static extern int RmEndSession(uint pSessionHandle);

  public static string[] GetLockers(string path) {
    uint handle;
    int result = RmStartSession(out handle, 0, Guid.NewGuid().ToString());
    if (result != 0) {
      throw new Exception("RmStartSession failed: " + result);
    }

    try {
      result = RmRegisterResources(handle, 1, new[] { path }, 0, IntPtr.Zero, 0, null);
      if (result != 0) {
        throw new Exception("RmRegisterResources failed: " + result);
      }

      uint needed = 0;
      uint count = 0;
      uint reason = 0;
      result = RmGetList(handle, out needed, ref count, null, ref reason);
      if (needed == 0) {
        return new string[0];
      }

      count = needed;
      var processes = new RM_PROCESS_INFO[count];
      result = RmGetList(handle, out needed, ref count, processes, ref reason);
      if (result != 0) {
        throw new Exception("RmGetList failed: " + result);
      }

      string[] lockers = new string[count];
      for (int i = 0; i < count; i++) {
        lockers[i] = processes[i].Process.dwProcessId + "|" + processes[i].strAppName;
      }

      return lockers;
    } finally {
      RmEndSession(handle);
    }
  }
}
"@

if (-not ("RestartManager" -as [type])) {
  Add-Type -TypeDefinition $source
}

$lockers = [RestartManager]::GetLockers($targetPath)
if ($lockers.Count -eq 0) {
  Write-Host "No locking processes found for $targetPath"
  exit 0
}

$blocked = $false

foreach ($locker in $lockers) {
  $parts = $locker -split "\|", 2
  $processId = [int]$parts[0]
  $appName = $parts[1]
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue

  if ($null -eq $process) {
    continue
  }

  if ($KillAll -or $process.ProcessName -eq "dllhost") {
    Write-Host "Stopping $($process.ProcessName).exe PID $processId locking $targetPath"
    try {
      Stop-Process -Id $processId -Force
    } catch {
      & taskkill.exe /PID $processId /F | Write-Host
      if ($LASTEXITCODE -ne 0) {
        throw "Could not stop $($process.ProcessName).exe PID $processId. Close File Explorer preview windows or run the build terminal as administrator."
      }
    }
    continue
  }

  $blocked = $true
  Write-Warning "Not stopping $($process.ProcessName).exe PID $processId ($appName). Run with -KillAll if you really want to terminate every locking process."
}

if ($blocked) {
  exit 1
}
