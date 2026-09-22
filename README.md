<img width="320" height="180" alt="banner" src="https://github.com/user-attachments/assets/82485f66-0b2b-4129-b31f-9b2c0594646d" />

# Watch Wheel for Jellyfin

Watch Wheel is a Jellyfin plugin that helps a signed-in user choose what to watch from media they can actually access. It builds a wheel from unwatched movies and TV series, understands TV progress so a series points to the next episode, and keeps each user's browser preferences separate.

## Features

- Movies, TV series, or both.
- Unwatched and optional in-progress titles.
- Genre, decade, release year, runtime, rating, and library filters.
- Next-episode awareness for TV series.
- Winner card with details, play/resume, and episode details.
- Remove/restore candidates without modifying the Jellyfin library.
- Recent-pick history.
- Desktop and Android-friendly playback behavior.
- Per-user, per-server browser storage for filters, recent picks, and removed titles.

## Compatibility

Release **1.0.2.0** targets:

- Jellyfin server ABI: **10.11.11.0**
- .NET: **9.0**

A different Jellyfin server version may require rebuilding the plugin against that server's matching Jellyfin packages and updating `targetAbi`.

## Privacy and portability

Watch Wheel has no hard-coded account, server, library, media-path, host, or API-key configuration. The server API resolves the currently authenticated Jellyfin user at request time and only queries libraries visible to that user.

Browser state is stored locally under a key derived from the Jellyfin server ID and current Jellyfin user ID. That prevents one account's filters/history from being reused by another account on the same browser/server combination. Watch Wheel does not require Radarr, Sonarr, Seerr, or any external service.

The plugin GUID (`4c6f5316-58f6-4d90-87cc-b8ca47b40a01`) is intentionally stable. It identifies Watch Wheel to Jellyfin and must remain the same for upgrades.

## Install

For a normal installation, download the release asset `WatchWheel-1.0.2.0.zip` and follow [INSTALL.md](INSTALL.md).

The release ZIP contains only:

- `Jellyfin.Plugin.WatchWheel.dll`
- `meta.json`

## Build from source

Requirements:

- .NET SDK 9
- PowerShell 7 (recommended for the release script)
- Node.js 22 or newer (recommended; used by the mocked reliability checks)

Build the plugin directly:

```powershell
dotnet restore .\Jellyfin.Plugin.WatchWheel\Jellyfin.Plugin.WatchWheel.csproj
dotnet build .\Jellyfin.Plugin.WatchWheel\Jellyfin.Plugin.WatchWheel.csproj -c Release
```

Build the same ZIP used for a GitHub release:

```powershell
.\scripts\Build-Release.ps1
```

The generated files are written to `artifacts/` and are intentionally ignored by Git.

## Development checks

```powershell
node .\checks\watchwheel-reliability.cjs
```

The check suite exercises key client-side behaviors in a mocked Jellyfin API/DOM environment. A real Jellyfin server is still required for end-to-end validation.

## Publishing a release

See [RELEASING.md](RELEASING.md). The repository includes a tag-triggered GitHub Actions workflow that builds, validates, and publishes the release ZIP and SHA-256 file automatically.

## License

GPL-3.0. See [LICENSE](LICENSE).
