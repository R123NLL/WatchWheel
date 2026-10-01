#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${WATCHWHEEL_TV_SYNC_CONFIG:-$HOME/.config/watchwheel/tv-sync.env}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

: "${WATCHWHEEL_TV_REPO:?Set WATCHWHEEL_TV_REPO, e.g. owner/private-tv-repo}"

TOKEN_FILE="${WATCHWHEEL_GITHUB_TOKEN_FILE:-$HOME/.config/watchwheel/github-token}"
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "GitHub token file not found: $TOKEN_FILE" >&2
  exit 2
fi

TOKEN="$(<"$TOKEN_FILE")"
if [[ -z "$TOKEN" ]]; then
  echo "GitHub token file is empty: $TOKEN_FILE" >&2
  exit 3
fi

for cmd in curl python3 sha256sum stat find sort mv mkdir mktemp install rm tail awk; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "Required command is missing: $cmd" >&2
    exit 4
  }
done

if [[ -n "${WATCHWHEEL_TV_UPDATES:-}" ]]; then
  TARGET="$WATCHWHEEL_TV_UPDATES"
else
  : "${WATCHWHEEL_PLUGIN_ROOT:?Set WATCHWHEEL_PLUGIN_ROOT or WATCHWHEEL_TV_UPDATES}"
  PLUGIN_DIR="$({ find "$WATCHWHEEL_PLUGIN_ROOT" -maxdepth 1 -type d -name 'Watch Wheel_*' -print 2>/dev/null || true; } | sort -V | tail -n 1)"
  if [[ -z "$PLUGIN_DIR" ]]; then
    echo "No Watch Wheel plugin directory found below: $WATCHWHEEL_PLUGIN_ROOT" >&2
    exit 5
  fi
  TARGET="$PLUGIN_DIR/TvUpdates"
fi

mkdir -p "$TARGET"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/watchwheel-tv-sync.XXXXXX")"
cleanup() {
  rm -rf "$TMP"
  TOKEN=''
}
trap cleanup EXIT

api_get() {
  local url="$1"
  local accept="$2"
  local output="$3"

  # Feed sensitive headers via stdin so the token is not exposed in process args.
  {
    printf 'fail\n'
    printf 'silent\n'
    printf 'show-error\n'
    printf 'location\n'
    printf 'header = "Authorization: Bearer %s"\n' "$TOKEN"
    printf 'header = "Accept: %s"\n' "$accept"
    printf 'header = "X-GitHub-Api-Version: 2022-11-28"\n'
    printf 'header = "User-Agent: WatchWheel-TV-Sync"\n'
    printf 'url = "%s"\n' "$url"
    printf 'output = "%s"\n' "$output"
  } | curl --config -
}

RELEASE_JSON="$TMP/release.json"
api_get \
  "https://api.github.com/repos/$WATCHWHEEL_TV_REPO/releases/latest" \
  'application/vnd.github+json' \
  "$RELEASE_JSON"

readarray -t RELEASE_DATA < <(python3 - "$RELEASE_JSON" <<'PY'
import json, sys
p = sys.argv[1]
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)
if data.get('draft'):
    raise SystemExit('Latest GitHub release is a draft')
print(data.get('tag_name') or '')
for asset in data.get('assets', []):
    name = asset.get('name') or ''
    if name == 'update.json':
        print('UPDATE_ID=' + str(asset.get('id') or ''))
PY
)

TAG="${RELEASE_DATA[0]:-}"
UPDATE_ID=''
for line in "${RELEASE_DATA[@]:1}"; do
  case "$line" in
    UPDATE_ID=*) UPDATE_ID="${line#UPDATE_ID=}" ;;
  esac
done

if [[ -z "$TAG" || -z "$UPDATE_ID" ]]; then
  echo "Latest private release does not contain update.json." >&2
  exit 6
fi

UPDATE_JSON="$TMP/update.json"
api_get \
  "https://api.github.com/repos/$WATCHWHEEL_TV_REPO/releases/assets/$UPDATE_ID" \
  'application/octet-stream' \
  "$UPDATE_JSON"

readarray -t META < <(python3 - "$UPDATE_JSON" <<'PY'
import json, re, sys
p = sys.argv[1]
with open(p, 'r', encoding='utf-8') as f:
    data = json.load(f)
required = ['version', 'versionCode', 'packageName', 'apk', 'sha256', 'sizeBytes']
missing = [k for k in required if k not in data]
if missing:
    raise SystemExit('update.json missing: ' + ', '.join(missing))
if data['packageName'] != 'org.watchwheel.tv.next':
    raise SystemExit('Unexpected packageName in update.json')
apk = str(data['apk'])
if not re.fullmatch(r'WatchWheel-TV-[A-Za-z0-9._-]+\.apk', apk):
    raise SystemExit('Unexpected APK filename in update.json')
sha = str(data['sha256']).lower()
if not re.fullmatch(r'[0-9a-f]{64}', sha):
    raise SystemExit('Invalid SHA256 in update.json')
print(str(data['version']))
print(str(int(data['versionCode'])))
print(apk)
print(sha)
print(str(int(data['sizeBytes'])))
PY
)

if [[ ${#META[@]} -ne 5 ]]; then
  echo "Invalid update.json metadata." >&2
  exit 10
fi

VERSION="${META[0]}"
VERSION_CODE="${META[1]}"
APK_NAME="${META[2]}"
EXPECTED_SHA="${META[3]}"
EXPECTED_SIZE="${META[4]}"

APK_ID="$(python3 - "$RELEASE_JSON" "$APK_NAME" <<'PY'
import json, sys
release_path, wanted = sys.argv[1:]
with open(release_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
for asset in data.get('assets', []):
    if asset.get('name') == wanted:
        print(asset.get('id') or '')
        break
PY
)"

if [[ -z "$APK_ID" ]]; then
  echo "Release $TAG does not contain $APK_NAME." >&2
  exit 7
fi

APK_TMP="$TMP/$APK_NAME"
api_get \
  "https://api.github.com/repos/$WATCHWHEEL_TV_REPO/releases/assets/$APK_ID" \
  'application/octet-stream' \
  "$APK_TMP"

ACTUAL_SHA="$(sha256sum "$APK_TMP" | awk '{print $1}')"
ACTUAL_SIZE="$(stat -c '%s' "$APK_TMP")"

if [[ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
  echo "APK SHA256 mismatch. Expected=$EXPECTED_SHA Actual=$ACTUAL_SHA" >&2
  exit 8
fi
if [[ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]]; then
  echo "APK size mismatch. Expected=$EXPECTED_SIZE Actual=$ACTUAL_SIZE" >&2
  exit 9
fi

# Publish the APK first, then metadata last. The TV can never observe metadata
# for an APK that has not finished downloading and verification.
install -m 0664 "$APK_TMP" "$TARGET/$APK_NAME.new"
mv -f "$TARGET/$APK_NAME.new" "$TARGET/$APK_NAME"
install -m 0664 "$UPDATE_JSON" "$TARGET/update.json.new"
mv -f "$TARGET/update.json.new" "$TARGET/update.json"

# Keep only the APK referenced by the active update.json. Old update APKs are
# safe to remove after the new metadata is atomically in place.
find "$TARGET" -maxdepth 1 -type f -name 'WatchWheel-TV-*.apk' ! -name "$APK_NAME" -delete

printf '\nWatchWheel TV release synced from private GitHub.\n'
printf 'Repository : %s\n' "$WATCHWHEEL_TV_REPO"
printf 'GitHub tag : %s\n' "$TAG"
printf 'TV version : %s (%s)\n' "$VERSION" "$VERSION_CODE"
printf 'APK        : %s\n' "$TARGET/$APK_NAME"
printf 'SHA256     : %s\n' "$ACTUAL_SHA"
printf 'Metadata   : %s\n' "$TARGET/update.json"
printf 'Jellyfin restart is not required for TV update files.\n'
