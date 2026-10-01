[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Server,

    [Parameter(Mandatory = $true)]
    [string]$RemotePluginDir,

    [string]$ReleaseZip,

    [switch]$AllowVersionFolderMismatch,

    [switch]$SkipProcessCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = Get-Content (Join-Path $root 'release.json') -Raw | ConvertFrom-Json
$version = [string]$release.version

if (-not $ReleaseZip) {
    $ReleaseZip = Join-Path $root "artifacts\WatchWheel-$version.zip"
}

if (-not (Test-Path $ReleaseZip)) {
    throw "Release ZIP not found: $ReleaseZip. Run scripts\Build-Release.ps1 first."
}

$ReleaseZip = (Resolve-Path $ReleaseZip).Path

Get-Command ssh -ErrorAction Stop | Out-Null
Get-Command scp -ErrorAction Stop | Out-Null

if ($RemotePluginDir -match "'") {
    throw 'RemotePluginDir cannot contain a single quote.'
}

$remoteLeaf = Split-Path $RemotePluginDir -Leaf
if (-not $AllowVersionFolderMismatch -and $remoteLeaf -notmatch ('_' + [regex]::Escape($version) + '$')) {
    throw @"
The remote plugin folder does not end with _$version:
$RemotePluginDir

For normal version upgrades, publish through the WatchWheel repository and let Jellyfin update the plugin.
Use this script only for same-version testing/hotfix deployment, or pass -AllowVersionFolderMismatch intentionally.
"@
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ('watchwheel-server-deploy-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null

try {
    Expand-Archive -LiteralPath $ReleaseZip -DestinationPath $temp -Force

    $dll = Join-Path $temp 'Jellyfin.Plugin.WatchWheel.dll'
    $meta = Join-Path $temp 'meta.json'

    if (-not (Test-Path $dll) -or -not (Test-Path $meta)) {
        throw 'Release ZIP must contain Jellyfin.Plugin.WatchWheel.dll and meta.json.'
    }

    $dll = (Resolve-Path $dll).Path
    $assembly = [System.Reflection.AssemblyName]::GetAssemblyName($dll)

    if (($assembly.Name -ne 'Jellyfin.Plugin.WatchWheel') -or ($assembly.Version.ToString() -ne $version)) {
        throw 'Release DLL identity/version does not match release.json.'
    }

    if (($assembly.Flags -ne [System.Reflection.AssemblyNameFlags]::None) -or ($assembly.GetPublicKey().Length -ne 0) -or ($assembly.GetPublicKeyToken().Length -ne 0)) {
        throw 'Release DLL has unexpected public-key/strong-name metadata.'
    }

    $localSha = (Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant()
    $stageId = [guid]::NewGuid().ToString('N')
    $remoteHome = ((& ssh $Server 'printf %s "$HOME"') -join '').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $remoteHome) { throw 'Could not determine remote HOME.' }
    $remoteStage = "$remoteHome/.watchwheel-stage-$stageId"

    Write-Host ''
    Write-Host 'Staging canonical WatchWheel release on server...' -ForegroundColor Cyan
    Write-Host "Server       : $Server"
    Write-Host "Plugin folder: $RemotePluginDir"
    Write-Host "Version      : $version"
    Write-Host "DLL SHA256   : $localSha"

    & ssh $Server "mkdir -p '$remoteStage'"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create remote staging directory.' }

    & scp $dll "${Server}:$remoteStage/Jellyfin.Plugin.WatchWheel.dll"
    if ($LASTEXITCODE -ne 0) { throw 'DLL upload failed.' }

    & scp $meta "${Server}:$remoteStage/meta.json"
    if ($LASTEXITCODE -ne 0) { throw 'meta.json upload failed.' }

    $remoteSha = (& ssh $Server "sha256sum '$remoteStage/Jellyfin.Plugin.WatchWheel.dll' | awk '{print `$1}'").Trim().ToLowerInvariant()
    if ($LASTEXITCODE -ne 0 -or $remoteSha -ne $localSha) {
        throw "Remote staged DLL checksum mismatch. Local=$localSha Remote=$remoteSha"
    }

    Write-Host ''
    Write-Host 'The release is staged, but the live DLL has NOT been touched.' -ForegroundColor Green
    Write-Host 'STOP Jellyfin completely from your hosting/control panel now.' -ForegroundColor Yellow
    [void](Read-Host 'Press ENTER only after Jellyfin is fully stopped')

    if (-not $SkipProcessCheck) {
        $processOutput = (& ssh $Server "pgrep -fa '[j]ellyfin' || true") -join "`n"
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not verify Jellyfin process state.'
        }
        if ($processOutput.Trim()) {
            throw "Jellyfin still appears to be running. Nothing was replaced.`n$processOutput"
        }
    }

    $timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')

    $pluginQ = "'$RemotePluginDir'"
    $stageQ = "'$remoteStage'"
    $shaQ = "'$localSha'"
    $stampQ = "'$timestamp'"

    $remoteScript = @'
set -eu
PLUGIN=__PLUGIN__
STAGE=__STAGE__
EXPECTED_SHA=__SHA__
STAMP=__STAMP__

[ -d "$PLUGIN" ] || { echo "Plugin directory missing: $PLUGIN" >&2; exit 20; }
[ -f "$STAGE/Jellyfin.Plugin.WatchWheel.dll" ] || { echo "Staged DLL missing" >&2; exit 21; }
[ -f "$STAGE/meta.json" ] || { echo "Staged meta.json missing" >&2; exit 22; }

ACTUAL_SHA=$(sha256sum "$STAGE/Jellyfin.Plugin.WatchWheel.dll" | awk '{print $1}')
[ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] || { echo "Staged DLL checksum mismatch" >&2; exit 23; }

if [ -f "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll" ]; then
  mv "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll" "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll.backup-$STAMP"
fi
if [ -f "$PLUGIN/meta.json" ]; then
  cp "$PLUGIN/meta.json" "$PLUGIN/meta.json.backup-$STAMP"
fi

# Atomic rename inside the same filesystem. Never cp over a loaded live DLL.
mv "$STAGE/Jellyfin.Plugin.WatchWheel.dll" "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll.new"
mv "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll.new" "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll"
mv "$STAGE/meta.json" "$PLUGIN/meta.json.new"
mv "$PLUGIN/meta.json.new" "$PLUGIN/meta.json"
rmdir "$STAGE" 2>/dev/null || true

sha256sum "$PLUGIN/Jellyfin.Plugin.WatchWheel.dll"
'@
    $remoteScript = $remoteScript.Replace('__PLUGIN__', $pluginQ).Replace('__STAGE__', $stageQ).Replace('__SHA__', $shaQ).Replace('__STAMP__', $stampQ)

    $result = $remoteScript | & ssh $Server 'bash -s'
    if ($LASTEXITCODE -ne 0) {
        throw 'Remote atomic deployment failed.'
    }

    $result | Write-Host

    Write-Host ''
    Write-Host 'Canonical release DLL installed while Jellyfin was stopped.' -ForegroundColor Green
    Write-Host 'START Jellyfin from the hosting/control panel now.' -ForegroundColor Yellow
    Write-Host 'Then verify the Watch Wheel plugin status and startup log.'
    Write-Host ''
    Write-Host 'Normal version upgrades should use the GitHub/Jellyfin repository pipeline; this script is the safe manual fallback.' -ForegroundColor DarkYellow
}
finally {
    if (Test-Path $temp) {
        Remove-Item -LiteralPath $temp -Recurse -Force
    }
}
