[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$release = Get-Content (Join-Path $root 'release.json') -Raw | ConvertFrom-Json
[xml]$props = Get-Content (Join-Path $root 'Directory.Build.props') -Raw
if ([string]$props.Project.PropertyGroup.AssemblyVersion -ne $release.version) { throw 'Release and assembly versions differ.' }
if ([string]$props.Project.PropertyGroup.FileVersion -ne $release.version) { throw 'Release and file versions differ.' }
Get-Command dotnet -ErrorAction Stop | Out-Null
if (Get-Command node -ErrorAction SilentlyContinue) {
    & node (Join-Path $root 'checks/watchwheel-reliability.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'Reliability checks failed.' }
} else { Write-Warning 'Node.js is unavailable; mocked reliability checks were not run.' }
$artifacts = Join-Path $root 'artifacts'
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$temp = Join-Path $artifacts ('.build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
try {
    $build = Join-Path $temp 'build'
    $project = Join-Path $root 'Jellyfin.Plugin.WatchWheel/Jellyfin.Plugin.WatchWheel.csproj'
    & dotnet build $project --configuration Release --no-incremental --output $build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed; no release archive was produced.' }
    $dll = Join-Path $build 'Jellyfin.Plugin.WatchWheel.dll'
    $assembly = [System.Reflection.AssemblyName]::GetAssemblyName($dll)
    if ($assembly.Name -ne 'Jellyfin.Plugin.WatchWheel' -or $assembly.Version.ToString() -ne $release.version) { throw 'Unexpected assembly identity/version.' }
    $payload = Join-Path $temp 'payload'
    New-Item -ItemType Directory -Path $payload | Out-Null
    Copy-Item $dll $payload
    $manifest = [ordered]@{
        category = $release.category; changelog = $release.changelog
        description = $release.description; guid = $release.guid
        name = $release.name; overview = $release.overview; owner = $release.owner
        targetAbi = $release.targetAbi; timestamp = [DateTime]::UtcNow.ToString('o')
        version = $release.version; status = 'Active'; autoUpdate = $false
        assemblies = @('Jellyfin.Plugin.WatchWheel.dll')
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $payload 'meta.json'), ($manifest | ConvertTo-Json -Depth 4), $utf8)
    $name = 'WatchWheel-' + $release.version + '.zip'
    $zip = Join-Path $temp $name
    Compress-Archive -Path (Join-Path $payload 'Jellyfin.Plugin.WatchWheel.dll'), (Join-Path $payload 'meta.json') -DestinationPath $zip
    $hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    $destination = Join-Path $artifacts $name
    Move-Item $zip $destination -Force
    [IO.File]::WriteAllText(($destination + '.sha256'), "$hash  $name`n", $utf8)
    Write-Host "Release archive: $destination"
    Write-Host "SHA256: $hash"
} finally {
    if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
}
