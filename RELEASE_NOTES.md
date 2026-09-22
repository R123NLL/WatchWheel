# Watch Wheel 1.0.2.0

This is the public-ready Watch Wheel release for Jellyfin 10.11.11.

## Highlights

- Portable installation documentation for Windows, Linux, Docker/container, hosted, and custom Jellyfin layouts.
- Removed machine/account-specific development and deployment values from the distributable source.
- Removed generated `obj/` content and old local release artifacts from the Git-ready package.
- Generic project author/owner metadata.
- Added tag-driven GitHub release automation.
- Kept the existing Watch Wheel plugin GUID so upgrades continue to be recognized as the same plugin.
- Preserves the existing wheel, advanced filters, next-episode TV behavior, winner card, Android playback handling, saved filters/history, and reliability protections.

## Compatibility

- Jellyfin: 10.11.11 / ABI 10.11.11.0
- .NET: 9.0

See `INSTALL.md` for the full installation, upgrade, rollback, and troubleshooting guide.
