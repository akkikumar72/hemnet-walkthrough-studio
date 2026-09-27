param(
    [Parameter(Mandatory = $true)][string]$Destination,
    [string]$Name = 'MyHome',
    [string]$EngineVersion = '5.8'
)

$ErrorActionPreference = 'Stop'
if ($Name -notmatch '^[A-Za-z][A-Za-z0-9_]{1,39}$') {
    throw 'Name must start with a letter and contain 2-40 letters, numbers, or underscores.'
}

$root = [System.IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $root) {
    if ((Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
        throw "Destination is not empty: $root"
    }
}
else {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
}

foreach ($directory in @('Config', 'Content', 'PrivateInput', 'Results', 'Scripts')) {
    New-Item -ItemType Directory -Path (Join-Path $root $directory) -Force | Out-Null
}

$project = [ordered]@{
    FileVersion = 3
    EngineAssociation = $EngineVersion
    Category = 'Architecture'
    Description = 'Photo-based home reconstruction created with Unreal Home Wizard.'
    Plugins = @(
        [ordered]@{ Name = 'PythonScriptPlugin'; Enabled = $true },
        [ordered]@{ Name = 'EditorScriptingUtilities'; Enabled = $true },
        [ordered]@{ Name = 'ArchVisCharacter'; Enabled = $true },
        [ordered]@{ Name = 'MovieRenderPipeline'; Enabled = $true }
    )
}
$projectPath = Join-Path $root ($Name + '.uproject')
$project | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $projectPath -Encoding UTF8

@'
Binaries/
Build/
DerivedDataCache/
Intermediate/
Saved/
.vs/
PrivateInput/
Results/
.env
.env.*
!.env.example
'@ | Set-Content -LiteralPath (Join-Path $root '.gitignore') -Encoding UTF8

@'
# Home project brief

Status: setup
Scope: unanswered
References: unanswered
Output: unanswered
Rights and privacy: unanswered
Known dimensions: none recorded
Inferred areas: none recorded
Current stage: technical preflight
Next decision: supply references
'@ | Set-Content -LiteralPath (Join-Path $root 'HOME_PROJECT_BRIEF.md') -Encoding UTF8

Write-Host "Created project: $projectPath"
Write-Host 'PrivateInput and Results are ignored by Git.'
