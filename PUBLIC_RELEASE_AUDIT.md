# Public release audit

The source tree was reviewed for environment-specific or personal values before the 1.0.2.0 public-ready package was created.

## Removed or generalized

- Personal Windows development paths (`C:\Users\...`).
- Personal/hosted-service SSH username and hostname from deployment documentation.
- Personal author name in assembly/package metadata.
- Personal repository owner label in release metadata.
- Generated `obj/` files containing absolute NuGet/project paths and PDB references.
- Previously built release artifacts/DLLs containing old assembly metadata and source paths.
- One-off migration/deployment files that existed only to apply the earlier snapshot to a specific local repository.
- Template-only sample plugin settings that were not used by Watch Wheel.

## Intentionally retained

- Plugin GUID `4c6f5316-58f6-4d90-87cc-b8ca47b40a01`: this is the stable application identity required for upgrades and is not a user identifier.
- Generic test identities such as `alice` and `bob`: these exist only in the mocked reliability test and are not Jellyfin account defaults.
- Generic development-relative paths under `.vscode`: these are portable defaults and can be changed by each developer.

## Runtime behavior

No hard-coded Jellyfin user ID, library ID, server address, media path, Radarr/Sonarr/Seerr endpoint, API key, token, or password is present in the source. Watch Wheel derives the current authenticated user and accessible libraries from Jellyfin at runtime.
