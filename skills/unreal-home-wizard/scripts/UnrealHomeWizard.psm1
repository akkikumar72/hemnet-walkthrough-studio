Set-StrictMode -Version 2.0

function Get-UhwUnrealInstallations {
    $results = @()

    $manifestRoot = Join-Path $env:ProgramData 'Epic\EpicGamesLauncher\Data\Manifests'
    if (Test-Path -LiteralPath $manifestRoot) {
        Get-ChildItem -LiteralPath $manifestRoot -Filter '*.item' -File -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $manifest = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
                if ($manifest.AppName -like 'UE_*' -and $manifest.InstallLocation) {
                    $editor = Join-Path $manifest.InstallLocation 'Engine\Binaries\Win64\UnrealEditor.exe'
                    $command = Join-Path $manifest.InstallLocation 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
                    if (Test-Path -LiteralPath $command) {
                        $results += [pscustomobject]@{
                            Version = ($manifest.AppName -replace '^UE_', '')
                            InstallLocation = $manifest.InstallLocation
                            Editor = $editor
                            Command = $command
                            Source = 'Epic manifest'
                        }
                    }
                }
            }
            catch {
                Write-Verbose "Could not parse Epic manifest $($_.FullName): $($_.Exception.Message)"
            }
        }
    }

    $buildsKey = 'HKCU:\SOFTWARE\Epic Games\Unreal Engine\Builds'
    if (Test-Path -LiteralPath $buildsKey) {
        $properties = Get-ItemProperty -LiteralPath $buildsKey
        foreach ($property in $properties.PSObject.Properties) {
            if ($property.Name -like 'PS*' -or -not ($property.Value -is [string])) { continue }
            $install = [string]$property.Value
            $command = Join-Path $install 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
            if (Test-Path -LiteralPath $command) {
                $results += [pscustomobject]@{
                    Version = ($property.Name -replace '[{}]', '')
                    InstallLocation = $install
                    Editor = (Join-Path $install 'Engine\Binaries\Win64\UnrealEditor.exe')
                    Command = $command
                    Source = 'Registered build'
                }
            }
        }
    }

    $standardRoots = @()
    if ($env:ProgramFiles) { $standardRoots += (Join-Path $env:ProgramFiles 'Epic Games') }
    if (${env:ProgramFiles(x86)}) { $standardRoots += (Join-Path ${env:ProgramFiles(x86)} 'Epic Games') }
    foreach ($root in $standardRoots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        Get-ChildItem -LiteralPath $root -Directory -Filter 'UE_*' -ErrorAction SilentlyContinue | ForEach-Object {
            $command = Join-Path $_.FullName 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
            if (Test-Path -LiteralPath $command) {
                $results += [pscustomobject]@{
                    Version = ($_.Name -replace '^UE_', '')
                    InstallLocation = $_.FullName
                    Editor = (Join-Path $_.FullName 'Engine\Binaries\Win64\UnrealEditor.exe')
                    Command = $command
                    Source = 'Standard location'
                }
            }
        }
    }

    $seen = @{}
    $results | Where-Object {
        $key = $_.Command.ToLowerInvariant()
        if ($seen.ContainsKey($key)) { return $false }
        $seen[$key] = $true
        return $true
    }
}

function Get-UhwProjectAssociation {
    param([Parameter(Mandatory = $true)][string]$ProjectFile)
    $resolved = (Resolve-Path -LiteralPath $ProjectFile).Path
    $project = Get-Content -LiteralPath $resolved -Raw | ConvertFrom-Json
    [string]$project.EngineAssociation
}

function Resolve-UhwUnrealEditor {
    param(
        [string]$ProjectFile,
        [string]$UnrealEditor
    )

    if ($UnrealEditor) {
        $resolved = (Resolve-Path -LiteralPath $UnrealEditor).Path
        $command = if ([System.IO.Path]::GetFileName($resolved) -eq 'UnrealEditor-Cmd.exe') {
            $resolved
        }
        else {
            Join-Path (Split-Path -Parent $resolved) 'UnrealEditor-Cmd.exe'
        }
        if (-not (Test-Path -LiteralPath $command)) {
            throw "UnrealEditor-Cmd.exe was not found next to: $resolved"
        }
        return [pscustomobject]@{
            Version = 'explicit'
            InstallLocation = (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $resolved))))
            Editor = $resolved
            Command = $command
            Source = 'Explicit path'
        }
    }

    $installs = @(Get-UhwUnrealInstallations)
    if ($installs.Count -eq 0) { return $null }

    if ($ProjectFile -and (Test-Path -LiteralPath $ProjectFile)) {
        $association = Get-UhwProjectAssociation -ProjectFile $ProjectFile
        $match = $installs | Where-Object {
            $_.Version -eq $association -or $_.Version -like "$association.*"
        } | Select-Object -First 1
        if ($match) { return $match }
    }

    $installs | Sort-Object Version -Descending | Select-Object -First 1
}

function Get-UhwEpicLauncher {
    foreach ($uninstallRoot in @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
    )) {
        if (-not (Test-Path -LiteralPath $uninstallRoot)) { continue }
        foreach ($child in Get-ChildItem -LiteralPath $uninstallRoot -ErrorAction SilentlyContinue) {
            $item = Get-ItemProperty -LiteralPath $child.PSPath -ErrorAction SilentlyContinue
            $displayProperty = $item.PSObject.Properties['DisplayName']
            $locationProperty = $item.PSObject.Properties['InstallLocation']
            if ($displayProperty -and $locationProperty -and $displayProperty.Value -like '*Epic Games Launcher*' -and $locationProperty.Value) {
                foreach ($relative in @(
                    'Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe',
                    'Launcher\Engine\Binaries\Win64\EpicGamesLauncher.exe',
                    'Portal\Binaries\Win64\EpicGamesLauncher.exe'
                )) {
                    $candidate = Join-Path $locationProperty.Value $relative
                    if (Test-Path -LiteralPath $candidate) { return $candidate }
                }
            }
        }
    }

    $registryPath = 'HKLM:\SOFTWARE\EpicGames\Unreal Engine'
    if (Test-Path -LiteralPath $registryPath) {
        foreach ($child in Get-ChildItem -LiteralPath $registryPath -ErrorAction SilentlyContinue) {
            $item = Get-ItemProperty -LiteralPath $child.PSPath
            if ($item.InstalledDirectory) {
                $candidate = Join-Path $item.InstalledDirectory 'Portal\Binaries\Win64\EpicGamesLauncher.exe'
                if (Test-Path -LiteralPath $candidate) { return $candidate }
            }
        }
    }

    $candidates = @()
    if (${env:ProgramFiles(x86)}) {
        $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe')
    }
    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles 'Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe')
    }
    $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

Export-ModuleMember -Function Get-UhwUnrealInstallations, Get-UhwProjectAssociation, Resolve-UhwUnrealEditor, Get-UhwEpicLauncher
