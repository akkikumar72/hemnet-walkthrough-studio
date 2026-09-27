param(
    [Parameter(Mandatory = $true)][string]$ProjectFile,
    [Parameter(Mandatory = $true)][string]$PythonScript,
    [string]$UnrealEditor,
    [string]$LogFile,
    [switch]$VerboseOutput
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'UnrealHomeWizard.psm1') -Force

$project = (Resolve-Path -LiteralPath $ProjectFile).Path
$script = (Resolve-Path -LiteralPath $PythonScript).Path
if ([System.IO.Path]::GetExtension($project) -ne '.uproject') {
    throw "ProjectFile must point to a .uproject file: $project"
}
if ([System.IO.Path]::GetExtension($script) -ne '.py') {
    throw "PythonScript must point to a .py file: $script"
}

$install = Resolve-UhwUnrealEditor -ProjectFile $project -UnrealEditor $UnrealEditor
if (-not $install) { throw 'UnrealEditor-Cmd.exe was not detected.' }

if (-not $LogFile) {
    $logDirectory = Join-Path (Split-Path -Parent $project) 'Saved\UnrealHomeWizard'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $LogFile = Join-Path $logDirectory ('python-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
}
else {
    $LogFile = [System.IO.Path]::GetFullPath($LogFile)
    New-Item -ItemType Directory -Path (Split-Path -Parent $LogFile) -Force | Out-Null
}

$arguments = @(
    $project,
    "-ExecutePythonScript=$script",
    '-unattended',
    '-NoSplash',
    '-NoSound',
    '-ddc=InstalledNoZenLocalFallback',
    '-stdout',
    '-FullStdOutLogOutput'
)

Write-Host "Unreal command: $($install.Command)"
Write-Host "Project: $project"
Write-Host "Python: $script"
Write-Host "Log: $LogFile"

if ($VerboseOutput) {
    & $install.Command @arguments 2>&1 | Tee-Object -FilePath $LogFile
}
else {
    & $install.Command @arguments *> $LogFile
}
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    throw "Unreal Python execution failed with exit code $exitCode. Review: $LogFile"
}

Write-Host 'Unreal Python execution completed.'
