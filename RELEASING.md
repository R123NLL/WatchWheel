# Releasing Watch Wheel on GitHub

The repository is prepared so a release can be published from any machine that has Git access to the repository. The release build itself runs on GitHub Actions.

## One-time repository setup

1. Push this repository to GitHub.
2. Make sure GitHub Actions are enabled for the repository.
3. No API keys or repository secrets are required for the included release workflow; it uses GitHub's built-in workflow token.

## Before each release

Update the version consistently in:

- `Directory.Build.props`
- `release.json`
- `build.yaml`
- the compatibility/version text in `README.md` and `INSTALL.md`
- `RELEASE_NOTES.md`
- `CHANGELOG.md`

The release script checks `AssemblyVersion`, `FileVersion`, and `release.json` for consistency. The GitHub release workflow also requires the Git tag to match `release.json` exactly.

## Validate locally (recommended)

From the repository root:

```powershell
.\scripts\Build-Release.ps1
```

This runs the JavaScript reliability checks when Node.js is available, compiles the plugin, validates the assembly identity/version, creates `meta.json`, creates the release ZIP, and writes a SHA-256 file.

Expected output for this release:

```text
artifacts/WatchWheel-1.0.2.0.zip
artifacts/WatchWheel-1.0.2.0.zip.sha256
```

## Commit and push

Use your normal default branch name (`main`, `master`, etc.). Example:

```bash
git status
git add -A
git commit -m "Release Watch Wheel 1.0.2.0"
git push origin main
```

## Create the release

Create and push a tag that exactly matches `v` + the version in `release.json`:

```bash
git tag v1.0.2.0
git push origin v1.0.2.0
```

Pushing the tag triggers `.github/workflows/release.yaml`. The workflow:

1. checks that the tag matches `release.json`;
2. installs .NET 9 and Node 22;
3. runs `scripts/Build-Release.ps1`;
4. creates a GitHub Release titled `Watch Wheel 1.0.2.0`;
5. uses `RELEASE_NOTES.md` as the release body;
6. uploads the plugin ZIP and SHA-256 file.

GitHub also adds its normal source-code archives automatically. Users should install the `WatchWheel-<version>.zip` asset created by the workflow, not the source-code archive.

## If the release workflow fails

Do not reuse a mismatched tag. Fix the repository/version metadata, delete the failed remote tag if appropriate, then create the correct tag. Review the Actions log before publishing assets manually.

## Manual fallback

If GitHub Actions are unavailable, run:

```powershell
.\scripts\Build-Release.ps1
```

Then create a GitHub Release manually for tag `v1.0.2.0` and upload:

- `artifacts/WatchWheel-1.0.2.0.zip`
- `artifacts/WatchWheel-1.0.2.0.zip.sha256`

Use `RELEASE_NOTES.md` for the release description.
