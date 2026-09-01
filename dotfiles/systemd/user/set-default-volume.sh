#!/usr/bin/env bash
set -euo pipefail

sink="@DEFAULT_AUDIO_SINK@"
deadline=$((SECONDS + 30))

until wpctl get-volume "$sink" >/dev/null 2>&1; do
  if ((SECONDS >= deadline)); then
    echo "Timed out waiting for default audio sink" >&2
    exit 1
  fi
  sleep 0.5
done

wpctl set-mute "$sink" 0
wpctl set-volume "$sink" 0.5
