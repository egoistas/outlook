#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
mapfile -t images < <(docker compose config --images | sort -u)
docker image inspect "${images[@]}" > backups/image-manifest.json
docker save -o backups/images.tar "${images[@]}"
printf '%s\n' 'Saved images and exact image metadata. Also run backup.sh to include the installed Calendar app and data.'
