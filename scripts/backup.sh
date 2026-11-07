#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
out="backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir "$out"
resume() { docker compose start app cron proxy >/dev/null; }
# Stop all writers before dumping SQL and archiving the application volume.
docker compose stop proxy cron app
trap resume EXIT
docker compose exec -T db pg_dump -U calendar -d calendar -Fc > "$out/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar app -C /var/www/html -czf - . > "$out/nextcloud.tar.gz"
tar -czf "$out/deployment.tar.gz" .env compose.yaml nginx certs secrets
printf '%s\n' "Backup saved in $out. Contains passwords and private keys; protect it."
