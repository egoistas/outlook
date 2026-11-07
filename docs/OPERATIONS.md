# Backup, μεταφορά και συντήρηση

## Καθημερινές εντολές

```bash
docker compose ps
docker compose logs --tail=100 app
docker compose exec -u www-data app php occ status
docker compose stop
docker compose start
```

Μη χρησιμοποιήσεις `docker compose down -v`: διαγράφει τα μόνιμα δεδομένα.
Το σταθερό Compose project name `org-calendar` διατηρεί σταθερά volume names.
Μην τρέχεις δεύτερη ανεξάρτητη εγκατάσταση με αυτό το όνομα στον ίδιο host.

## Backup

```bash
bash scripts/backup.sh
```

Υπάρχει μικρή διακοπή λειτουργίας: σταματούν proxy/app/cron, γίνεται SQL dump και
archive του Nextcloud volume, και οι υπηρεσίες επανεκκινούν μέσω trap.
Το backup συμπεριλαμβάνει config, installed Calendar app, αρχεία και deployment secrets.
Η επιτυχία επιβεβαιώνεται μόνο όταν η εντολή ολοκληρωθεί με exit code 0.
Ατελές directory από αποτυχημένη εκτέλεση δεν είναι έγκυρο backup.
Αντέγραψε το backup εκτός VM και προστάτεψέ το: περιέχει προσωπικά δεδομένα,
passwords και TLS private keys. VM snapshots δεν αντικαθιστούν αυτά τα backups.
Το script προορίζεται για stack που ήδη λειτουργεί και το ξαναξεκινά στο τέλος.

## Μεταφορά σε offline VM

Κάνε την αρχική προετοιμασία σε Linux VM με Internet και ίδια CPU architecture:

1. Εκκίνηση stack και `bash scripts/bootstrap.sh` όσο υπάρχει Internet.
2. `bash scripts/backup.sh` για Calendar app, configuration και δεδομένα.
3. `bash scripts/export-images.sh` για images και image-manifest.json.
4. Μετέφερε checkout, backup και images.tar με ασφαλές μέσο στο offline VM.
5. Εγκατέστησε Docker Engine/Compose στο target VM πριν την απομόνωσή του,
   ή μετέφερε και τα κατάλληλα OS packages και dependencies.
6. Κάνε restore όπως παρακάτω. Μην εκτελέσεις ξανά init.py πάνω σε restored secrets.

Το `docker save` μόνο του **δεν** περιλαμβάνει volumes ούτε την εγκατεστημένη
Calendar εφαρμογή. Το image archive μαζί με το backup είναι απαραίτητα.
Εναλλακτικά, αφού κάνεις graceful shutdown, μετακίνησε ολόκληρο το έτοιμο VM.
Χρειάζεται ενημέρωση IP/DNS στο τελικό LAN. Το AD/LDAPS ρυθμίζεται εκεί.

## Restore σε ΝΕΟ/ΑΔΕΙΟ VM

Χρησιμοποίησε ίδια images με το backup. Οι παρακάτω εντολές προορίζονται
αποκλειστικά για άδειο target χωρίς προϋπάρχοντα `org-calendar` volumes.
Μην τις εκτελέσεις πάνω σε ενεργή εγκατάσταση.
Από το directory του checkout, βάλε το επιλεγμένο backup στο `restore/`:

```bash
docker load -i /path/to/images.tar
# Εξάγει μόνο δικό σου, έμπιστο backup:
tar -xzf restore/deployment.tar.gz
# Πριν συνεχίσεις, οι δύο παρακάτω έλεγχοι ΠΡΕΠΕΙ να αποτύχουν με 'no such volume':
docker volume inspect org-calendar_nextcloud
docker volume inspect org-calendar_postgres
```

Αν κάποιο volume υπάρχει, σταμάτα και χρησιμοποίησε πραγματικά άδειο target.
Μετά:

```bash
docker compose up -d --wait db redis
docker compose exec -T db pg_restore -U calendar -d calendar --no-owner --exit-on-error < restore/database.dump
docker compose run --rm --no-deps -T --entrypoint tar app -C /var/www/html -xzf - < restore/nextcloud.tar.gz
docker compose up -d --wait --wait-timeout 900
```

Το tar διατηρεί UID/GID των αρχείων του volume. Το DB dump περιλαμβάνει ημερολόγια,
ACLs και ρυθμίσεις εφαρμογών. Δοκίμασε login/δικαιώματα/συμβάντα μετά την επαναφορά.
Αν αλλάξει hostname, χρειάζονται αλλαγές .env, DNS, TLS certificate και
`trusted_domains` μέσω occ· προτίμησε το ίδιο DNS όνομα με νέα IP.
Μην έχεις δύο ενεργά production VM στην ίδια IP/διεύθυνση.

## Offline ρυθμίσεις

Αφού εγκατασταθεί η Calendar και ολοκληρωθούν οι έλεγχοι:

```bash
docker compose exec -u www-data app php occ config:system:set appstoreenabled --type=boolean --value=false
docker compose exec -u www-data app php occ config:system:set updatechecker --type=boolean --value=false
docker compose exec -u www-data app php occ config:system:set has_internet_connection --type=boolean --value=false
```

Η καθημερινή χρήση ημερολογίου/AD γίνεται στο LAN. Updates και νέα apps χρειάζονται
ξεχωριστή online προετοιμασία και ελεγχόμενη μεταφορά. Δεν ρυθμίζονται εξωτερικά
ημερολόγια, federated sharing ή εξωτερικές προσκλήσεις.

## Αναβαθμίσεις

Πρώτα backup και δοκιμή σε απομονωμένο clone του VM. Το Compose αποφεύγει το `latest`
και pin-άρει major/minor σειρές. Μην αλλάζεις PostgreSQL major απλώς αλλάζοντας tag:
απαιτείται διαδικασία migration. Το Nextcloud αναβαθμίζεται ένα major κάθε φορά,
με έλεγχο συμβατότητας Calendar. Για αναπαραγωγή production έκδοσης χρησιμοποίησε
image digests στο .env ή τα εξαγμένα images και φύλαξε το manifest.
