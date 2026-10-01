# Releasing Watch Wheel

WatchWheel server/Web releases are public Jellyfin plugin releases. Android TV releases are private and follow the separate pipeline in `WatchWheel-TV-Next/TV_PIPELINE.md`.

## Release safety rules

- `scripts/Build-Release.ps1` is the canonical plugin build.
- Never deploy a DLL copied from `Jellyfin.Plugin.WatchWheel/bin/Release`.
- Never overwrite a loaded Jellyfin plugin DLL in place.
- Normal version upgrades are published through GitHub + the Jellyfin repository manifest.
- `scripts/Deploy-Server-Safely.ps1` exists only for intentional same-version/test fallback deployment and requires Jellyfin to be stopped before the atomic replacement.

## Before each plugin release

Update the version consistently in:

- `Directory.Build.props`
- `release.json`
- `build.yaml`
- any compatibility/version text that is part of the release
- `RELEASE_NOTES.md`
- `CHANGELOG.md`

The release script checks `AssemblyVersion`, `FileVersion`, and `release.json` for consistency.

## Validate locally

From the repository root:

```powershell
.\scripts\Build-Release.ps1
```

The script:

1. runs deterministic JavaScript checks when Node.js is available;
2. runs `git diff --check` when Git is available;
3. compiles a fresh non-incremental Release build into a temporary directory;
4. validates the assembly identity/version;
5. verifies WatchWheel remains unsigned (`PublicKeyToken=null`) with no malformed public-key metadata;
6. creates `meta.json`;
7. creates the canonical plugin ZIP;
8. writes a SHA-256 file.

Outputs:

```text
artifacts/WatchWheel-<version>.zip
artifacts/WatchWheel-<version>.zip.sha256
```

## Commit/push

```powershell
git status --short
git diff --check
git add -A
git commit -m "Release Watch Wheel <version>"
git push origin main
```

## Publish the Git tag

Use:

```powershell
.\scripts\Publish-Plugin-Tag.ps1
```

The script refuses a dirty repository, reruns the canonical release build, requires local HEAD to match its upstream, refuses a reused tag, creates `v<version>`, and pushes it.

The existing `.github/workflows/release.yaml` workflow then builds the release again in GitHub Actions and creates the GitHub Release from the tagged commit.

## Publish the Jellyfin repository dependency

Wait until the GitHub Release has been created. Then update the stable manifest from the **exact published release ZIP**:

```powershell
.\scripts\Update-Plugin-Manifest.ps1 -Channel stable
```

The script downloads `WatchWheel-<version>.zip` from the GitHub Release and computes the MD5 checksum required by the Jellyfin repository manifest from that exact asset. It then updates `manifest.json`.

Review and publish the manifest:

```powershell
git diff -- manifest.json
git add manifest.json
git commit -m "Publish Watch Wheel <version> in stable manifest"
git push origin main
```

Jellyfin installations using the WatchWheel repository can now discover/update to the new plugin version through the normal plugin dependency mechanism.

For an opt-in test channel:

```powershell
.\scripts\Update-Plugin-Manifest.ps1 -Channel test -Tag v<version>-test
```

The tag supplied to `-Tag` must contain a published release asset named `WatchWheel-<release.json version>.zip`.

## Manual same-version/test fallback

Direct deployment should not be the normal version-upgrade path. When a same-version test/hotfix must be installed directly on a server:

```powershell
.\scripts\Deploy-Server-Safely.ps1 `
  -Server user@server `
  -RemotePluginDir "/path/to/Watch Wheel_<version>"
```

The script:

1. extracts only the canonical release ZIP;
2. validates DLL identity/version/public-key metadata;
3. stages the DLL/meta outside the live plugin path;
4. compares SHA-256 after upload;
5. waits for you to STOP Jellyfin;
6. refuses to continue if a Jellyfin process is still visible (unless explicitly overridden);
7. backs up the existing files;
8. uses atomic rename inside the plugin filesystem rather than copying over a loaded DLL;
9. tells you to START Jellyfin and verify its startup log.

This protects against Linux/.NET loader failures caused by replacing a DLL while the process still has it mapped.
