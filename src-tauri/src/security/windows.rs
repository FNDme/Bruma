//! Windows probes. Everything goes through PowerShell with -NoProfile and
//! -NonInteractive and comes back as JSON, which `parsers::windows` decodes.

use super::parsers::windows as p;
use super::parsers::CheckOutcome;
use super::runner::{run_ok, CommandOutput};

fn powershell(script: &str) -> Result<CommandOutput, String> {
    let script = format!(
        "$ProgressPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; {script}"
    );
    run_ok(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ],
    )
}

const ANTIVIRUS_SCRIPT: &str = r#"
$products = Get-CimInstance -Namespace 'root/SecurityCenter2' -ClassName AntiVirusProduct -ErrorAction Stop |
    Select-Object displayName, productState
ConvertTo-Json -InputObject @($products) -Compress
"#;

pub fn antivirus() -> Result<CheckOutcome<String>, String> {
    let output = powershell(ANTIVIRUS_SCRIPT)
        .map_err(|e| format!("could not query Windows Security Center: {e}"))?;
    let products = p::parse_windows_av_json(&output.stdout)?;
    Ok(p::windows_antivirus_outcome(&products))
}

const BITLOCKER_SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
$drive = $env:SystemDrive
if (-not $drive) { $drive = 'C:' }
$shell = $null
try {
    $shell = (New-Object -ComObject Shell.Application).NameSpace("$drive\").Self.ExtendedProperty('System.Volume.BitLockerProtection')
} catch {}
$volume = Get-CimInstance -Namespace 'root/cimv2/Security/MicrosoftVolumeEncryption' -ClassName Win32_EncryptableVolume -Filter "DriveLetter='$drive'"
[PSCustomObject]@{
    Drive = $drive
    Shell = $shell
    CimProtection = if ($volume) { [int]$volume.ProtectionStatus } else { $null }
    CimConversion = if ($volume) { [int]$volume.ConversionStatus } else { $null }
} | ConvertTo-Json -Compress
"#;

pub fn disk_encryption() -> Result<CheckOutcome<String>, String> {
    let output = powershell(BITLOCKER_SCRIPT)
        .map_err(|e| format!("could not read the BitLocker status: {e}"))?;
    let info = p::parse_bitlocker_json(&output.stdout)?;
    p::windows_encryption_outcome(&info)
}

const SCREEN_LOCK_SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
function Get-RegValue($path, $name) {
    $item = Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue
    if ($null -eq $item) { return $null }
    $value = $item.$name
    if ($null -eq $value) { return $null }
    return [string]$value
}
$desktop = 'HKCU:\Control Panel\Desktop'
$policy = 'HKCU:\Software\Policies\Microsoft\Windows\Control Panel\Desktop'
$system = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
[PSCustomObject]@{
    VideoIdle = (powercfg /q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Out-String)
    ConsoleLock = (powercfg /q SCHEME_CURRENT SUB_NONE CONSOLELOCK | Out-String)
    ScreenSaveActive = Get-RegValue $desktop 'ScreenSaveActive'
    ScreenSaverIsSecure = Get-RegValue $desktop 'ScreenSaverIsSecure'
    ScreenSaveTimeOut = Get-RegValue $desktop 'ScreenSaveTimeOut'
    ScreenSaverExe = Get-RegValue $desktop 'SCRNSAVE.EXE'
    PolicyScreenSaveActive = Get-RegValue $policy 'ScreenSaveActive'
    PolicyScreenSaverIsSecure = Get-RegValue $policy 'ScreenSaverIsSecure'
    PolicyScreenSaveTimeOut = Get-RegValue $policy 'ScreenSaveTimeOut'
    PolicyScreenSaverExe = Get-RegValue $policy 'SCRNSAVE.EXE'
    InactivityTimeoutSecs = Get-RegValue $system 'InactivityTimeoutSecs'
    HasBattery = [bool](Get-CimInstance -ClassName Win32_Battery)
} | ConvertTo-Json -Compress
"#;

pub fn screen_lock() -> Result<CheckOutcome<u32>, String> {
    let output = powershell(SCREEN_LOCK_SCRIPT)
        .map_err(|e| format!("could not read the screen lock settings: {e}"))?;
    let info = p::parse_windows_lock_json(&output.stdout)?;
    p::windows_screen_lock_outcome(&info)
}
