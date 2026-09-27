param(
    [string]$ProjectFile,
    [string]$UnrealEditor,
    [string]$JsonPath,
    [switch]$RunUnrealSmoke
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'UnrealHomeWizard.psm1') -Force

$checks = @()
function Add-Check {
    param([string]$Name, [string]$Status, [string]$Detail)
    $script:checks += [pscustomobject]@{ name = $Name; status = $Status; detail = $Detail }
}

if ($env:OS -eq 'Windows_NT' -and [Environment]::Is64BitOperatingSystem) {
    Add-Check 'Windows' 'pass' ([Environment]::OSVersion.VersionString)
}
else {
    Add-Check 'Windows' 'fail' 'The tested v0.1 workflow requires 64-bit Windows.'
}

$computer = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
if ($computer) {
    $memoryGb = [math]::Round($computer.TotalPhysicalMemory / 1GB, 1)
    Add-Check 'System memory' $(if ($memoryGb -ge 31) { 'pass' } else { 'warn' }) "$memoryGb GB usable; Epic recommends the 32 GB installed-memory class for UE5 authoring."
}
else {
    Add-Check 'System memory' 'warn' 'Could not read system memory.'
}

$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Where-Object { $_.Name })
$nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($nvidiaSmi) {
    $nvidia = & $nvidiaSmi.Source --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits 2>$null
    if ($LASTEXITCODE -eq 0 -and $nvidia) {
        Add-Check 'GPU' 'pass' (($nvidia | ForEach-Object { "$_ (name, VRAM MB, driver)" }) -join '; ')
    }
    elseif ($gpus.Count -gt 0) {
        Add-Check 'GPU' 'pass' (($gpus | ForEach-Object { $_.Name }) -join '; ')
    }
}
elseif ($gpus.Count -gt 0) {
    Add-Check 'GPU' 'pass' (($gpus | ForEach-Object { $_.Name }) -join '; ')
}
else {
    Add-Check 'GPU' 'warn' 'Could not identify a graphics adapter. Epic recommends a DirectX 12 GPU with 8 GB or more graphics memory.'
}

$probePath = if ($ProjectFile) { $ProjectFile } else { $PSScriptRoot }
$driveName = (Split-Path -Qualifier ([System.IO.Path]::GetFullPath($probePath))).TrimEnd(':\')
$drive = Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue
if ($drive) {
    $freeGb = [math]::Round($drive.Free / 1GB, 1)
    Add-Check 'Free disk space' $(if ($freeGb -ge 50) { 'pass' } else { 'warn' }) "$freeGb GB free on $($drive.Name):; 100 GB of working headroom is recommended for larger projects."
}

$launcher = Get-UhwEpicLauncher
if ($launcher) {
    Add-Check 'Epic Games Launcher' 'pass' $launcher
}
else {
    Add-Check 'Epic Games Launcher' 'warn' 'Not detected. Standard Unreal installation requires Epic Games Launcher and an Epic account.'
}

$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) {
    Add-Check 'Codex CLI' 'pass' $codex.Source
}
else {
    Add-Check 'Codex CLI' 'warn' 'CLI not found on PATH. Codex desktop may still be available.'
}

$resolvedProject = $null
$projectData = $null
if ($ProjectFile) {
    $resolvedProject = (Resolve-Path -LiteralPath $ProjectFile).Path
    if ([System.IO.Path]::GetExtension($resolvedProject) -ne '.uproject') {
        throw "ProjectFile must point to a .uproject file: $resolvedProject"
    }
    $projectData = Get-Content -LiteralPath $resolvedProject -Raw | ConvertFrom-Json
    Add-Check 'Unreal project' 'pass' "$resolvedProject (engine $($projectData.EngineAssociation))"
}
else {
    Add-Check 'Unreal project' 'warn' 'No project supplied. This is sufficient for machine discovery only.'
}

$install = Resolve-UhwUnrealEditor -ProjectFile $resolvedProject -UnrealEditor $UnrealEditor
if ($install) {
    Add-Check 'Unreal Engine' 'pass' "$($install.Version) at $($install.InstallLocation)"
}
else {
    Add-Check 'Unreal Engine' 'fail' 'No UnrealEditor-Cmd.exe installation was detected.'
}

if ($projectData) {
    $enabled = @($projectData.Plugins | Where-Object { $_.Enabled } | ForEach-Object { $_.Name })
    foreach ($plugin in @('PythonScriptPlugin', 'EditorScriptingUtilities')) {
        if ($enabled -contains $plugin) {
            Add-Check "Project plugin: $plugin" 'pass' 'Enabled in the .uproject file.'
        }
        else {
            Add-Check "Project plugin: $plugin" 'fail' 'Required for the built-in editor Python bridge.'
        }
    }
    if ($enabled -contains 'ArchVisCharacter') {
        Add-Check 'Project plugin: ArchVisCharacter' 'pass' 'Available for a gravity-bound no-C++ walkthrough.'
    }
    else {
        Add-Check 'Project plugin: ArchVisCharacter' 'warn' 'Recommended for the default no-C++ walkthrough.'
    }
}

$smokeReport = $null
if ($RunUnrealSmoke) {
    if (-not $resolvedProject) { throw 'RunUnrealSmoke requires -ProjectFile.' }
    if (-not $install) { throw 'RunUnrealSmoke requires a detected Unreal installation.' }
    $runner = Join-Path $PSScriptRoot 'invoke-unreal-python.ps1'
    $smoke = Join-Path $PSScriptRoot 'unreal_smoke_test.py'
    & $runner -ProjectFile $resolvedProject -PythonScript $smoke -UnrealEditor $install.Command
    $smokeReport = Join-Path (Split-Path -Parent $resolvedProject) 'Saved\UnrealHomeWizard\smoke-test.json'
    if (Test-Path -LiteralPath $smokeReport) {
        Add-Check 'Unreal Python smoke test' 'pass' $smokeReport
    }
    else {
        Add-Check 'Unreal Python smoke test' 'fail' 'Unreal did not produce the expected JSON report.'
    }
}

$failed = @($checks | Where-Object { $_.status -eq 'fail' }).Count
$warnings = @($checks | Where-Object { $_.status -eq 'warn' }).Count
$overall = if ($failed -gt 0) { 'blocked' } elseif ($warnings -gt 0) { 'needs-user-action' } else { 'ready' }
$report = [pscustomobject]@{
    generatedAt = (Get-Date).ToString('o')
    status = $overall
    checks = $checks
}

foreach ($check in $checks) {
    $mark = switch ($check.status) { 'pass' { '[PASS]' } 'warn' { '[WARN]' } default { '[FAIL]' } }
    Write-Host "$mark $($check.name): $($check.detail)"
}
Write-Host "Overall: $overall"

if ($JsonPath) {
    $fullJsonPath = [System.IO.Path]::GetFullPath($JsonPath)
    $parent = Split-Path -Parent $fullJsonPath
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $fullJsonPath -Encoding UTF8
    Write-Host "Report: $fullJsonPath"
}

if ($failed -gt 0) { exit 2 }
