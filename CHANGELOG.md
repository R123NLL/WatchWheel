# Changelog

## 1.0.2.0 — public-ready release

- Remove personal/local deployment values and generated build files from the publishable source package.
- Replace host-specific install notes with a portable Jellyfin installation, update, rollback, and troubleshooting guide.
- Replace personal author/owner metadata with project-level contributor metadata.
- Add a tag-triggered GitHub Actions release workflow.
- Add release notes and a repeatable release checklist.
- Remove inherited template-only configuration fields.
- Keep the stable plugin GUID so existing installations upgrade as the same plugin.
- Preserve advanced filters, winner card, next-episode playback, Android playback handling, per-user browser state, and reliability fixes.

## 1.0.1.0 — release candidate source

- Preserve the full wheel with every eligible choice.
- Add runtime, rating, year and library filters with a cleaner advanced-filter layout.
- Improve the winner card and Android play/resume behavior.
- Add request timeouts, retry paths and stale-response/account-switch guards.
- Rename the Template project to WatchWheel while preserving the plugin GUID.
- Align release metadata; report the actual assembly version from the status endpoint.
- Replace unused sample settings with a concise information page while retaining legacy configuration fields for compatibility.
- Add migration backups, release packaging, checksum generation and build-only GitHub Actions.
