#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
occ() { docker compose exec -T -u www-data app php occ "$@"; }
occ status
# Requires Internet on first installation; persists in the nextcloud volume.
if ! occ app:list --output=json | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit("calendar" not in d.get("enabled",{}) and "calendar" not in d.get("disabled",{}))'; then
  occ app:install calendar
fi
occ app:enable calendar
occ app:enable user_ldap
occ background:cron
occ config:system:set defaultapp --value=calendar
occ config:system:set default_language --value=el
occ config:system:set default_locale --value=el_GR
occ config:system:set default_phone_region --value=GR
# No public calendar links or email invitations are needed for this deployment.
occ config:app:set core shareapi_allow_links --value=no
occ config:app:set dav sendInvitations --value=no
occ config:app:set dav sendEventReminders --value=no
printf '%s\n' 'Calendar ready. Configure AD and the read-only share using docs/SETUP.md.'
