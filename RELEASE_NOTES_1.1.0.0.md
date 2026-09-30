# Watch Wheel 1.1.0.0

Watch Wheel 1.1 is a major feature release focused on giving Jellyfin users more ways to choose what to watch, with new presentation modes, viewer-specific media organization, improved filtering, and a substantial reliability and UI polish pass.

## Popcorn Mode

Introduces a completely new way to pick a title.

- Horizontal cinematic popcorn reel
- Dedicated winner presentation separate from Classic Mode
- Animated popcorn-box reveal with poster emergence
- Smooth launch, travel, deceleration, settle, and reveal sequence
- Custom Popcorn sound design synchronized to reel movement and winner reveal
- Responsive Web presentation for desktop and narrower layouts
- Reduced-motion support

## CommunityRating Rarity System

Popcorn Mode now visually represents Jellyfin CommunityRating using rarity-style auras.

- Gold: rating 8.5+
- Red: rating 7.5–8.49
- Purple: rating 6.5–7.49
- Blue: below 6.5 or unrated

Rarity is presentation-only and does not affect winner selection or odds.

Each tier uses its own halo, rim lighting, underglow, center-crossing emphasis, and winner-reveal lighting.

## Watcher Profiles

Media can now be assigned to custom watcher profiles.

Examples include individual household members or viewing groups.

- Create, rename, and delete watchers
- Assign movies and series to one or multiple watchers
- Assign a title to all watchers at once
- Filter the wheel by watcher
- Watcher IDs remain stable across renames
- Removing a watcher does not remove media

## Classic Mode Improvements

Classic Mode received a visual refresh while retaining the familiar Watch Wheel experience.

- Premium theater-style atmosphere
- Improved visual depth and readability
- Smooth background transitions between Classic and Popcorn modes
- Existing wheel and winner workflows remain intact

## Filtering Improvements

The Watch Status filter has been simplified into a single consistent system:

- All Unwatched
- All Media
- Not Started
- In Progress

Existing filtering by media type, genre, decade, library, and watcher remains supported.

## Settings Improvements

The Settings experience has been rebuilt for more reliable interaction.

- Dedicated backdrop architecture
- Settings stays open while interacting with controls
- Native dropdowns behave correctly
- Click outside, Close, and Escape dismiss Settings
- Choices visibility remains configurable

## Movies and Series

Existing Jellyfin-aware behavior remains supported.

- Movie winners open the selected movie
- Series winners resolve to the next episode to watch
- In-progress media is handled according to Watch Status
- Remove from Wheel and Spin Again remain available

## Reliability and Performance

This release includes a substantial cleanup and hardening pass.

- Bounded Popcorn reel rendering
- Reusable Web reel items
- Improved animation cancellation
- Stale callback protection
- Bounded audio voice pools
- Safer repeated spins and mode switching
- Explicit production asset allowlist
- Hardened embedded asset serving
- Removed obsolete experimental assets and legacy sound files
- No machine-specific or user-specific production configuration

## Compatibility

Watch Wheel 1.1.0.0 targets Jellyfin 10.11.11 / ABI 10.11.11.0.

Use a build targeting your Jellyfin server version when running a different Jellyfin release.

## Upgrade

Existing Watch Wheel users can update through the stable Watch Wheel plugin repository or install the release ZIP manually.

A Jellyfin server restart is required after updating the plugin.
