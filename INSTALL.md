# Installing Watch Wheel

These instructions are written so the same release package can be installed on Windows, Linux, Docker/container installations, hosted Jellyfin services, and custom data-directory layouts.

## 1. Check compatibility

Watch Wheel **1.0.2.0** targets Jellyfin **10.11.11** / ABI **10.11.11.0**.

Before installing, confirm your Jellyfin server version from the Dashboard. If your server is on a different Jellyfin release, use a Watch Wheel build that targets that server version or rebuild from source with matching Jellyfin package versions.

## 2. Download the release

From the GitHub Releases page, download:

- `WatchWheel-1.0.2.0.zip`
- `WatchWheel-1.0.2.0.zip.sha256` (recommended)

Do **not** use GitHub's automatically generated "Source code" ZIP as the plugin package.

### Optional: verify the checksum

PowerShell:

```powershell
(Get-FileHash .\WatchWheel-1.0.2.0.zip -Algorithm SHA256).Hash.ToLower()
Get-Content .\WatchWheel-1.0.2.0.zip.sha256
```

Linux:

```bash
sha256sum -c WatchWheel-1.0.2.0.zip.sha256
```

macOS:

```bash
shasum -a 256 WatchWheel-1.0.2.0.zip
cat WatchWheel-1.0.2.0.zip.sha256
```

The hashes must match.

## 3. Locate the Jellyfin plugins directory

The safest rule is:

```text
<JELLYFIN_DATA_DIR>/plugins
```

If you use a custom Jellyfin data directory, use that directory rather than assuming a platform default. Jellyfin's Dashboard can show the server paths for custom/container installations.

Common examples include:

| Installation | Typical plugin directory |
| --- | --- |
| Debian/Ubuntu packages | `/var/lib/jellyfin/plugins` |
| Windows direct/portable user install | `%LOCALAPPDATA%\jellyfin\plugins` |
| Windows tray/server install | `%PROGRAMDATA%\Jellyfin\Server\plugins` |
| Official Docker | inside the container/config volume, under the Jellyfin data directory's `plugins` folder |
| LinuxServer.io / hosted services | provider-specific path under the mounted/configured Jellyfin data directory |

If your provider exposes a file manager or shell, use the actual Jellyfin data path supplied by that provider.

## 4. Stop Jellyfin

Stop the Jellyfin server before replacing an existing plugin version. This avoids locked files on Windows and prevents the running process from using a partially changed plugin directory.

For Docker/Compose, stop the Jellyfin container. For hosted services, use the provider's stop/restart control.

## 5. Back up the old Watch Wheel plugin

Inside the plugins directory, look for folders named similarly to:

```text
WatchWheel_1.0.1.0
WatchWheel_1.0.2.0
```

Move any existing `WatchWheel_*` folder to a backup location **outside** the active plugins directory. Do not delete Jellyfin's `plugins/configurations` directory.

## 6. Install the release

Create this folder inside the Jellyfin plugins directory:

```text
WatchWheel_1.0.2.0
```

Extract the release ZIP into it. The final layout must be:

```text
<JELLYFIN_DATA_DIR>/plugins/
└── WatchWheel_1.0.2.0/
    ├── Jellyfin.Plugin.WatchWheel.dll
    └── meta.json
```

There should not be another nested `WatchWheel-1.0.2.0` folder inside it.

### Linux permissions

The Jellyfin service account must be able to read the directory and both files. If you copied the files as root, align ownership/permissions with the other plugin folders on your server.

## 7. Start Jellyfin and verify

Start Jellyfin again, then:

1. Open **Dashboard -> Plugins** and confirm **Watch Wheel 1.0.2.0** loads without an error.
2. Refresh the Jellyfin web app. A hard refresh may be useful after an upgrade.
3. Open **Watch Wheel** from the Jellyfin menu.
4. Confirm the candidate count loads.
5. Test a movie spin and, if available, a TV series spin.
6. Confirm series playback targets the next episode rather than the beginning of the series.
7. Test one or two filters and confirm they remain scoped to the signed-in account.

## Updating later

For each future Watch Wheel release:

1. Download the new release ZIP and checksum.
2. Stop Jellyfin.
3. Move the old `WatchWheel_<version>` folder outside the active plugins directory.
4. Create `WatchWheel_<new-version>`.
5. Extract the new `dll` and `meta.json` there.
6. Start Jellyfin and verify the plugin version.

Watch Wheel browser history/filter state is separate from the plugin binary and normally remains intact for the same Jellyfin server/user/browser.

## Rollback

1. Stop Jellyfin.
2. Move the new Watch Wheel directory out of the plugins directory.
3. Restore the previously backed-up `WatchWheel_<old-version>` directory.
4. Start Jellyfin.
5. Confirm the old version loads.

## Troubleshooting

### Plugin does not appear

- Confirm the ZIP was extracted and not copied as a ZIP only.
- Confirm `Jellyfin.Plugin.WatchWheel.dll` and `meta.json` are directly inside the `WatchWheel_<version>` directory.
- Confirm Jellyfin was fully restarted.
- Check file ownership/permissions on Linux.
- Check the Jellyfin server log for plugin load errors.

### Plugin reports an ABI/version error

The release was built for Jellyfin 10.11.11. Use a build matching your server or rebuild from source with matching `Jellyfin.Controller` and `Jellyfin.Model` package versions and update `targetAbi`.

### Watch Wheel opens but shows no titles

- Confirm the signed-in user can browse the expected Movie/TV libraries in Jellyfin itself.
- Reset Watch Wheel filters.
- Check whether all eligible titles are already watched for that user.
- If a specific library is selected, switch to **All libraries** and retry.

### UI still looks like the old version

Hard-refresh the browser page or clear only the web application's cached assets. Do not delete Jellyfin user data or plugin configuration just to refresh the front-end.

## Jellyfin references

- Plugin installation: https://jellyfin.org/docs/general/server/plugins/
- Data-directory/platform examples: https://jellyfin.org/docs/general/administration/backup-and-restore/
- Container installation/configuration: https://jellyfin.org/docs/general/installation/container/
