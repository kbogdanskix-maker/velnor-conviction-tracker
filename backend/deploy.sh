#!/usr/bin/env bash
#
# Deploy the backend AND bring the scheduled machines up to the same image.
#
# Use this instead of a bare `fly deploy`.
#
# Why this exists
# ---------------
# `fly deploy` only updates machines that belong to a process group declared in
# fly.toml. The cron machines (velnor-purge-demo, velnor-warm-quotes) were
# created with `fly machine run --schedule`, which Fly does not manage from
# fly.toml — there is no `schedule` key for it, and no deploy flag that picks
# them up. So a bare `fly deploy` silently leaves them on whatever image they
# were created with, and they drift further behind on every release.
#
# That is not theoretical: on 2026-09-30 both crons were found running an image
# three deploys old, which predated the curl_cffi session fix — so the hourly
# quote warm was running code whose Yahoo calls Yahoo refuses.
#
# This script deploys, then points every *scheduled* machine at the image the
# app process group just got. `fly machine update --image` preserves the
# machine's command, schedule and restart policy; the script re-reads all three
# afterwards and fails loudly if any of them changed.
#
# Adding a new cron needs no change here — machines are discovered by having a
# schedule set, not by a hardcoded list.

set -euo pipefail

APP="${FLY_APP:-velnor-api}"
cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/3  Deploying $APP"
fly deploy --app "$APP" "$@"

say "2/3  Reading the image the app process group is now on"
MACHINES_JSON="$(fly machines list --json --app "$APP")"

TARGET_IMAGE="$(printf '%s' "$MACHINES_JSON" | python3 -c '
import sys, json
for m in json.load(sys.stdin):
    cfg = m.get("config") or {}
    if (cfg.get("metadata") or {}).get("fly_process_group") == "app":
        print(cfg.get("image", ""))
        break
')"

# Compare on the resolved digest, not config.image: the app machine reports a
# tag ("…:deployment-01ABC") while an updated cron reports the digest it
# resolved to, so comparing config.image would never match and every run would
# pointlessly re-update machines that are already current.
TARGET_DIGEST="$(printf '%s' "$MACHINES_JSON" | python3 -c '
import sys, json
for m in json.load(sys.stdin):
    cfg = m.get("config") or {}
    if (cfg.get("metadata") or {}).get("fly_process_group") == "app":
        print((m.get("image_ref") or {}).get("digest", ""))
        break
')"

if [ -z "$TARGET_IMAGE" ]; then
  echo "ERROR: could not find an app-process-group machine to read the image from." >&2
  exit 1
fi
echo "     $TARGET_IMAGE"

say "3/3  Syncing scheduled machines"
# id<TAB>name<TAB>image — only machines that actually have a schedule.
SCHEDULED="$(printf '%s' "$MACHINES_JSON" | python3 -c '
import sys, json
for m in json.load(sys.stdin):
    cfg = m.get("config") or {}
    if cfg.get("schedule"):
        digest = (m.get("image_ref") or {}).get("digest", "")
        print("\t".join([m["id"], m.get("name", "?"), digest]))
')"

if [ -z "$SCHEDULED" ]; then
  echo "     No scheduled machines found — nothing to sync."
  exit 0
fi

printf '%s\n' "$SCHEDULED" | while IFS=$'\t' read -r ID NAME DIGEST; do
  [ -z "$ID" ] && continue
  if [ -n "$TARGET_DIGEST" ] && [ "$DIGEST" = "$TARGET_DIGEST" ]; then
    echo "     $NAME already current — skipped"
    continue
  fi
  echo "     $NAME: updating"
  fly machine update "$ID" --app "$APP" --image "$TARGET_IMAGE" --yes >/dev/null

  # A cron that lost its schedule or its command is worse than a stale one:
  # it either never runs again, or boots the image's default CMD (uvicorn)
  # and sits there costing money. Verify rather than assume.
  fly machine status "$ID" --app "$APP" --display-config 2>/dev/null \
    | python3 -c '
import sys, re, json
m = re.search(r"\{.*\}", sys.stdin.read(), re.S)
cfg = json.loads(m.group(0))
sched = cfg.get("schedule")
cmd = (cfg.get("init") or {}).get("cmd")
if not sched or not cmd:
    print("       FAILED: schedule=%r cmd=%r" % (sched, cmd))
    raise SystemExit(1)
print("       ok - schedule=%s, cmd=%s" % (sched, " ".join(cmd)))
' || { echo "       ERROR: $NAME lost its schedule or command — fix before relying on it." >&2; exit 1; }
done

say "Done. App and scheduled machines are on the same image."
