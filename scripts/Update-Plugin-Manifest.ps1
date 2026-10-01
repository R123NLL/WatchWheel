[CmdletBinding()]
param(
    [ValidateSet('stable', 'test')]
    [string]$Channel = 'stable',
    [string]$Tag,
    [switch]$KeepDownloadedAsset
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = Get-Content (Join-Path $root 'release.json') -Raw | ConvertFrom-Json
$version = [string]$release.version

if (-not $Tag) {
    $Tag = "v$version"
}

Get-Command gh -ErrorAction Stop | Out-Null
Get-Command git -ErrorAction Stop | Out-Null

& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI is not authenticated. Run gh auth login first.'
}

Push-Location $root
try {
    $repoInfo = (& gh repo view --json nameWithOwner,isPrivate) | ConvertFrom-Json
} finally {
    Pop-Location
}
if (-not $repoInfo.nameWithOwner) {
    throw 'Could not determine the GitHub repository.'
}

$releaseInfo = (& gh release view $Tag --json tagName,isDraft,isPrerelease,url --repo $repoInfo.nameWithOwner) | ConvertFrom-Json
if (-not $releaseInfo.tagName) {
    throw "GitHub release not found: $Tag"
}
if ($releaseInfo.isDraft) {
    throw "GitHub release $Tag is still a draft."
}

$expectedAsset = "WatchWheel-$version.zip"
$temp = Join-Path ([IO.Path]::GetTempPath()) ('watchwheel-manifest-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null

try {
    & gh release download $Tag --repo $repoInfo.nameWithOwner --pattern $expectedAsset --dir $temp --clobber
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to download release asset $expectedAsset from $Tag."
    }

    $asset = Join-Path $temp $expectedAsset
    if (-not (Test-Path $asset)) {
        throw "Downloaded release asset is missing: $asset"
    }

    # Jellyfin plugin repository manifests use the MD5 checksum of the exact
    # published ZIP asset. Never calculate this from a separately rebuilt ZIP.
    $md5 = (Get-FileHash -LiteralPath $asset -Algorithm MD5).Hash.ToLowerInvariant()

    $manifestName = if ($Channel -eq 'stable') { 'manifest.json' } else { 'manifest-test.json' }
    $manifestPath = Join-Path $root $manifestName

    if (-not (Test-Path $manifestPath)) {
        throw "Manifest not found: $manifestPath"
    }

    $manifest = @(Get-Content $manifestPath -Raw | ConvertFrom-Json)
    $plugin = @($manifest | Where-Object { [string]$_.guid -eq [string]$release.guid }) | Select-Object -First 1
    if (-not $plugin) {
        throw "Plugin GUID $($release.guid) was not found in $manifestName."
    }

    $sourceUrl = "https://github.com/$($repoInfo.nameWithOwner)/releases/download/$Tag/$expectedAsset"
    $entry = [ordered]@{
        version   = $version
        changelog = [string]$release.changelog
        targetAbi = [string]$release.targetAbi
        sourceUrl = $sourceUrl
        checksum  = $md5
        timestamp = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }

    $existing = @($plugin.versions | Where-Object { [string]$_.version -ne $version })
    $plugin.versions = @([pscustomobject]$entry) + $existing

    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $manifestJson = ConvertTo-Json -InputObject $manifest -Depth 20
    [IO.File]::WriteAllText(
        $manifestPath,
        $manifestJson + "`n",
        $utf8
    )

    Write-Host ''
    Write-Host "Updated $manifestName for WatchWheel $version." -ForegroundColor Green
    Write-Host "Release asset : $expectedAsset"
    Write-Host "Release tag   : $Tag"
    Write-Host "MD5 checksum  : $md5"
    Write-Host "Source URL    : $sourceUrl"
    Write-Host ''
    Write-Host 'Review the manifest diff, then commit and push it. Jellyfin will consume the repository update normally.' -ForegroundColor Yellow

    if ($KeepDownloadedAsset) {
        $keep = Join-Path (Join-Path $root 'artifacts') $expectedAsset
        New-Item -ItemType Directory -Force -Path (Split-Path $keep -Parent) | Out-Null
        Copy-Item -LiteralPath $asset -Destination $keep -Force
        Write-Host "Published asset copy: $keep"
    }
}
finally {
    if (Test-Path $temp) {
        Remove-Item -LiteralPath $temp -Recurse -Force
    }
}
