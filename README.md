# Ημερολόγιο Οργανισμού

Dockerized Nextcloud Calendar για εσωτερικό LAN και Active Directory.
Ο αρχηγός διαχειρίζεται το «Πρόγραμμα Οργανισμού». Οι διευθυντές το βλέπουν
με δικαιώματα μόνο ανάγνωσης. Τα προσωπικά τους ημερολόγια παραμένουν ανεξάρτητα.
Δεν περιλαμβάνεται mail server ούτε custom Outlook clone.

## Γρήγορη εκκίνηση

Σε Linux VM με Docker Engine, Compose v2, Git, Python 3 και OpenSSL:

```bash
git clone https://github.com/egoistas/outlook.git
cd outlook
python3 scripts/init.py calendar.example.internal
# Δημιούργησε αντίστοιχη εγγραφή DNS προς την IP του VM.
docker compose pull
docker compose up -d --wait --wait-timeout 900
bash scripts/bootstrap.sh
```

Άνοιξε `https://calendar.example.internal`. Το hostname είναι παράδειγμα:
χρησιμοποίησε όνομα στο δικό σου εσωτερικό DNS.
Ο τοπικός τεχνικός λογαριασμός είναι `calendar-admin`· ο αρχικός κωδικός βρίσκεται
στο `secrets/admin_password`. Ο αρχηγός θα χρησιμοποιεί τον δικό του λογαριασμό AD,
όχι τον τεχνικό administrator.

Το init δημιουργεί προσωρινό self-signed πιστοποιητικό. Πριν χρησιμοποιήσεις
κωδικούς AD, αντικατάστησέ το με πιστοποιητικό της εσωτερικής CA που εμπιστεύονται
τα PCs. Δες [αναλυτική εγκατάσταση](docs/SETUP.md).

## Περιεχόμενα

- Nextcloud Apache, PostgreSQL, Redis, cron και Nginx HTTPS.
- Μόνο η θύρα 443 δημοσιεύεται. Η βάση και το Redis δεν δημοσιεύονται στο VM.
- Named volumes για εφαρμογή/config/Calendar/data και PostgreSQL.
- LDAP/AD app και οδηγίες περιορισμού εισόδου σε συγκεκριμένη ομάδα.
- [Backup, επαναφορά και offline μεταφορά](docs/OPERATIONS.md).

Αρχική πρόταση για μικρή ομάδα: Ubuntu Server 24.04 LTS, 2 vCPU, 4 GB RAM,
40 GB δίσκος, σταθερή IP και DNS του AD. Είναι αφετηρία χωρητικότητας,
όχι μετρημένο production sizing. Το VM χρειάζεται σωστή ώρα/NTP.

## Κατάσταση επαλήθευσης

Έγιναν στατικοί έλεγχοι YAML, shell, παραγωγής αρχικής ρύθμισης και
ελέγχων αποφυγής overwrite. Δεν υπήρχε Docker daemon ή πρόσβαση στο δικό σου AD
στο περιβάλλον ανάπτυξης: δεν έχει γίνει δοκιμή εκκίνησης containers, πραγματικού
LDAP login ή ACL. Τα βήματα αποδοχής στο SETUP.md πρέπει να ολοκληρωθούν στο VM.
Οι εικόνες είναι pinned σε major/minor σειρές, όχι σε immutable digests.
Κατά την offline προετοιμασία αποθηκεύεται manifest των πραγματικών images.

## Επίσημη τεκμηρίωση

- https://github.com/nextcloud/docker
- https://docs.nextcloud.com/server/stable/admin_manual/configuration_user/user_auth_ldap.html
- https://docs.nextcloud.com/server/stable/user_manual/en/groupware/calendar.html
- https://docs.nextcloud.com/server/stable/admin_manual/maintenance/backup.html
