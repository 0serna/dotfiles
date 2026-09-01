#!/usr/bin/env bash
set -euo pipefail

sink="@DEFAULT_AUDIO_SINK@"
deadline=$((SECONDS + 30))

while true; do
  if wpctl set-mute "$sink" 0 >/dev/null 2>&1 &&
    wpctl set-volume "$sink" 0.5 >/dev/null 2>&1; then
    exit 0
  fi

  if ((SECONDS >= deadline)); then
    echo "Timed out waiting for default audio sink" >&2
    exit 1
  fi

  sleep 0.5
done
