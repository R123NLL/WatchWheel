[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = Get-Content (Join-Path $root 'release.json') -Raw | ConvertFrom-Json
$version = [string]$release.version
$tag = "v$version"

Get-Command git -ErrorAction Stop | Out-Null

$dirty = @(& git -C $root status --porcelain)
if ($dirty.Count -gt 0) {
    throw "Repository is not clean. Commit the release metadata/code first.`n$($dirty -join "`n")"
}

# Re-run the canonical package build immediately before tagging.
& (Join-Path $PSScriptRoot 'Build-Release.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Canonical release build failed.' }

$head = ((@(& git -C $root rev-parse HEAD)) -join '').Trim()
$upstream = ((@(& git -C $root rev-parse '@{u}' 2>$null)) -join '').Trim()
if (-not $upstream) {
    throw 'Current branch has no upstream. Push/set the upstream before publishing.'
}
if ($head -ne $upstream) {
    throw "Local HEAD is not identical to its upstream. Push/pull first. HEAD=$head Upstream=$upstream"
}

$localTag = ((@(& git -C $root tag --list $tag)) -join '').Trim()
if ($localTag) {
    throw "Local tag already exists: $tag"
}
$remoteTag = ((@(& git -C $root ls-remote --tags origin "refs/tags/$tag")) -join '').Trim()
if ($remoteTag) {
    throw "Remote tag already exists: $tag"
}

& git -C $root tag -a $tag -m "Watch Wheel $version"
if ($LASTEXITCODE -ne 0) { throw "Could not create tag $tag." }

& git -C $root push origin $tag
if ($LASTEXITCODE -ne 0) { throw "Could not push tag $tag." }

Write-Host ''
Write-Host "Published tag $tag." -ForegroundColor Green
Write-Host 'GitHub Actions will build the canonical plugin ZIP and create the public WatchWheel release.'
Write-Host 'After the GitHub release exists, run:' -ForegroundColor Yellow
Write-Host "  .\scripts\Update-Plugin-Manifest.ps1 -Channel stable -Tag $tag"
Write-Host 'Then review, commit, and push manifest.json so Jellyfin sees the dependency update.'
