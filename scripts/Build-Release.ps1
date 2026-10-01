[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releasePath = Join-Path $root 'release.json'
$propsPath = Join-Path $root 'Directory.Build.props'

$release = Get-Content $releasePath -Raw | ConvertFrom-Json
[xml]$props = Get-Content $propsPath -Raw

if ([string]$props.Project.PropertyGroup.AssemblyVersion -ne [string]$release.version) {
    throw 'Release and assembly versions differ.'
}
if ([string]$props.Project.PropertyGroup.FileVersion -ne [string]$release.version) {
    throw 'Release and file versions differ.'
}

Get-Command dotnet -ErrorAction Stop | Out-Null

# Run the deterministic checks that are safe in CI. Preview helpers that open a
# local server/browser are intentionally excluded.
$nodeChecks = @(
    'checks/watchwheel-reliability.cjs',
    'checks/slot-sound.cjs',
    'checks/watcher-foundation.cjs',
    'checks/popcorn-mode.cjs',
    'checks/popcorn-rarity.cjs'
)

if (Get-Command node -ErrorAction SilentlyContinue) {
    foreach ($relative in $nodeChecks) {
        $check = Join-Path $root $relative
        if (-not (Test-Path $check)) { continue }
        & node $check
        if ($LASTEXITCODE -ne 0) {
            throw "Release check failed: $relative"
        }
    }
} else {
    Write-Warning 'Node.js is unavailable; JavaScript release checks were not run.'
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    & git -C $root diff --check
    if ($LASTEXITCODE -ne 0) {
        throw 'git diff --check failed.'
    }
}

$artifacts = Join-Path $root 'artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

$temp = Join-Path $artifacts ('.build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null

try {
    $build = Join-Path $temp 'build'
    $project = Join-Path $root 'Jellyfin.Plugin.WatchWheel/Jellyfin.Plugin.WatchWheel.csproj'

    & dotnet build $project --configuration Release --no-incremental --output $build
    if ($LASTEXITCODE -ne 0) {
        throw 'Build failed; no release archive was produced.'
    }

    $dll = Join-Path $build 'Jellyfin.Plugin.WatchWheel.dll'
    if (-not (Test-Path $dll)) {
        throw "Release DLL was not produced: $dll"
    }

    # Always inspect the canonical clean-build DLL, never bin/Release output.
    $dll = (Resolve-Path $dll).Path
    $assembly = [System.Reflection.AssemblyName]::GetAssemblyName($dll)

    if (($assembly.Name -ne 'Jellyfin.Plugin.WatchWheel') -or ($assembly.Version.ToString() -ne [string]$release.version)) {
        throw 'Unexpected assembly identity/version.'
    }

    # WatchWheel is intentionally not strong-name signed. A malformed public key
    # can make Linux/.NET report "Invalid assembly public key" before plugin code
    # executes, so fail the release before packaging if that metadata ever drifts.
    if (($assembly.Flags -ne [System.Reflection.AssemblyNameFlags]::None) -or ($assembly.GetPublicKey().Length -ne 0) -or ($assembly.GetPublicKeyToken().Length -ne 0)) {
        throw 'Unexpected strong-name/public-key metadata on WatchWheel DLL.'
    }

    $dllSha = (Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant()

    $payload = Join-Path $temp 'payload'
    New-Item -ItemType Directory -Path $payload | Out-Null
    Copy-Item -LiteralPath $dll -Destination (Join-Path $payload 'Jellyfin.Plugin.WatchWheel.dll')

    $manifest = [ordered]@{
        category    = $release.category
        changelog   = $release.changelog
        description = $release.description
        guid        = $release.guid
        name        = $release.name
        overview    = $release.overview
        owner       = $release.owner
        targetAbi   = $release.targetAbi
        timestamp   = [DateTime]::UtcNow.ToString('o')
        version     = $release.version
        status      = 'Active'
        autoUpdate  = $false
        assemblies  = @('Jellyfin.Plugin.WatchWheel.dll')
    }

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText(
        (Join-Path $payload 'meta.json'),
        ($manifest | ConvertTo-Json -Depth 4) + "`n",
        $utf8
    )

    $name = 'WatchWheel-' + $release.version + '.zip'
    $zip = Join-Path $temp $name

    $payloadFiles = @(
        (Join-Path $payload 'Jellyfin.Plugin.WatchWheel.dll'),
        (Join-Path $payload 'meta.json')
    )
    Compress-Archive -Path $payloadFiles -DestinationPath $zip

    $zipSha = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    $destination = Join-Path $artifacts $name

    Move-Item -LiteralPath $zip -Destination $destination -Force
    [IO.File]::WriteAllText(
        ($destination + '.sha256'),
        "$zipSha  $name`n",
        $utf8
    )

    Write-Host ''
    Write-Host 'WatchWheel server release build complete.' -ForegroundColor Green
    Write-Host "Version     : $($release.version)"
    Write-Host "Release ZIP : $destination"
    Write-Host "ZIP SHA256  : $zipSha"
    Write-Host "DLL SHA256  : $dllSha"
    Write-Host 'Assembly key: unsigned / PublicKeyToken=null (verified)'
    Write-Host ''
    Write-Host 'IMPORTANT: deploy the DLL from this release ZIP, never a DLL copied from bin\Release.' -ForegroundColor Yellow
}
finally {
    if (Test-Path $temp) {
        Remove-Item -LiteralPath $temp -Recurse -Force
    }
}
