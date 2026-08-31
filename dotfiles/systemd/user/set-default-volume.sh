#!/usr/bin/env bash
set -euo pipefail

wpctl set-mute @DEFAULT_AUDIO_SINK@ 0
wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.5
