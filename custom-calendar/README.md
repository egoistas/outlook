# Custom ημερολόγιο — πρώτη λειτουργική έκδοση

Ανεξάρτητη εφαρμογή με περιβάλλον εμπνευσμένο από Outlook Calendar.
Δεν χρησιμοποιεί Nextcloud ή υπηρεσίες Microsoft. Πρώτη έκδοση, **όχι πλήρης
αντιγραφή λειτουργιών του Outlook και όχι ακόμη εγκεκριμένη για παραγωγική χρήση**.

## Δοκιμή στο υπάρχον Ubuntu VM

Από το checkout του repository:

```bash
git fetch origin
git switch feature/outlook-style-calendar
cd custom-calendar
python3 init.py
sudo docker compose up -d --build --wait
```

Το Windows hosts entry `192.168.1.192 calendar.test` παραμένει ίδιο.
Άνοιξε **https://calendar.test:9443**. Το προσωρινό TLS certificate είναι self-signed.
Χρησιμοποίησε εταιρικό CA certificate πριν συνδεθούν πραγματικοί AD λογαριασμοί.
Η δοκιμαστική εγκατάσταση Nextcloud παραμένει στο 443, χωρίς αλλαγές στα volumes της.

```bash
# Δες τοπικά τους κωδικούς, μην τους δημοσιεύσεις:
grep -E '^(CHIEF_PASSWORD|DIRECTOR_PASSWORD)=' .env
```

- `chief`: δημιουργία, επεξεργασία, διαγραφή και μεταφορά συμβάντων.
- `director`: προβολή και αναζήτηση, χωρίς write δικαιώματα στο API.
- Οι κωδικοί δημιουργούνται τυχαία κατά την αρχικοποίηση, αποθηκεύονται hashed στη βάση.
- Αλλαγή password στο .env μετά την αρχική δημιουργία **δεν** αλλάζει υπάρχον password στη βάση.
- Τα συμβάντα αποθηκεύονται στο ανεξάρτητο volume `custom-org-calendar_data`.
- Δεν μεταφέρονται αυτόματα δεδομένα από Nextcloud.

## Τι υλοποιήθηκε

- Μπλε επάνω μπάρα, αριστερή στήλη, πλοήγηση ημερομηνιών και φόρμα συμβάντος.
- Μήνας, εβδομάδα, εργάσιμη εβδομάδα, ημέρα, ατζέντα.
- Τίτλος, περιγραφή, τοποθεσία, έναρξη/λήξη, ολοήμερα, πέντε κατηγορίες.
- Καθημερινή/εβδομαδιαία/μηνιαία/ετήσια επανάληψη, προαιρετική τελική ημερομηνία.
- Οι επαναλήψεις υπολογίζονται στην Europe/Athens, με αλλαγές θερινής ώρας.
- Ο browser εμφανίζει ώρες στη δική του ζώνη: για την ελληνική εγκατάσταση βάλε Europe/Athens στα PCs.
- Read-only διευθυντής, προστασία CSRF, 8ωρες sessions, TLS, περιορισμός προσπαθειών login.
- Προστασία από χαμένες ενημερώσεις με version checks (409 σε stale αλλαγή).
- Drag-and-drop απλών, μη επαναλαμβανόμενων συμβάντων σε ημέρα/ώρα.
- Αναζήτηση μόνο μέσα στη φορτωμένη περίοδο. Ανανέωση κάθε 60s όταν η καρτέλα είναι ενεργή.
- Τα κείμενα συμβάντων εμφανίζονται ως textContent, όχι ως εκτελέσιμο HTML.

Οι προβολές ημέρας/εβδομάδας έχουν κοινό άξονα ωρών, αρχική κύλιση στις 08:00,
blocks αναλογικά με τη διάρκεια και ξεχωριστές στήλες για επικαλύψεις.
Συμβάντα που περνούν τα μεσάνυχτα κόβονται στα αντίστοιχα ημερήσια όρια.
Η αυτόματη ανανέωση διατηρεί τη θέση κύλισης. Η φθινοπωρινή επανάληψη της ίδιας
ώρας λόγω DST εμφανίζεται στον ίδιο 24ωρο άξονα, όχι ως ξεχωριστή 25η ώρα.
Οι επεξεργασίες επαναλαμβανόμενων συμβάντων αφορούν **ολόκληρη τη σειρά**.

## Δεν έχουν υλοποιηθεί ακόμη

- Exceptions επαναλήψεων («μόνο αυτό», «αυτό και τα επόμενα»), σύνθετα recurrence patterns.
- Resize διάρκειας με drag, επιλογή χρονικού διαστήματος με σύρσιμο.
- Reminders/ειδοποιήσεις, προσκλήσεις/RSVP, free-busy, αίθουσες/πόροι.
- Πολλαπλά/προσωπικά ημερολόγια, configurable sharing/delegation, ICS import/export και CalDAV.
- Οθόνη διαχείρισης χρηστών, audit log και άμεση ανάκληση session μέσω AD.
- Mobile/accessibility και browser QA πριν από production χρήση.

## AD σύνδεση (υλοποιημένος adapter, δεν δοκιμάστηκε σε πραγματικό DC)

Σε απομονωμένο test deployment, πρόσθεσε στο .env:

```dotenv
AUTH_MODE=ad
AD_HOST=dc01.example.internal
AD_CA_FILE=/certs/ad-ca.crt
AD_BASE_DN=DC=example,DC=internal
AD_BIND_DN=CN=svc-calendar,OU=ServiceAccounts,DC=example,DC=internal
AD_BIND_PASSWORD='replace-locally'
AD_ALLOWED_GROUP_DN=CN=Calendar-Users,OU=Groups,DC=example,DC=internal
AD_WRITER_GROUP_DN=CN=Calendar-Chief,OU=Groups,DC=example,DC=internal
```

Αντιγράφεις τη δημόσια CA αλυσίδα PEM στο certs/ad-ca.crt (chmod 644).
LDAPS 636 με έλεγχο πιστοποιητικού, read-only service account, χωρίς domain join.
Όλοι οι επιτρεπόμενοι χρήστες πρέπει να είναι **άμεσα** μέλη Calendar-Users,
και μόνο ο αρχηγός άμεσο μέλος Calendar-Chief. Nested groups δεν υποστηρίζονται.
Disabled AD accounts αποκλείονται από το login filter. Επανεκκίνηση με:

```bash
sudo docker compose up -d --force-recreate app
```

Σε AD mode τα local logins δεν γίνονται δεκτά. Άλλαξε SESSION_SECRET κατά τη μετάβαση
για να ακυρωθούν παλιές local sessions. Ο έλεγχος group γίνεται στο login,
όχι σε κάθε αίτημα: ανάκληση AD πρόσβασης δεν ακυρώνει αμέσως 8ωρη συνεδρία.
Για έκτακτη ανάκληση όλων των sessions άλλαξε SESSION_SECRET και αναδημιούργησε app.
Μην το χρησιμοποιήσεις σε παραγωγή πριν ελέγξεις login/nonmember/disabled user,
σωστή χαρτογράφηση ρόλων και την πολιτική ανάκλησης.

## Backup και offline μεταφορά

Διαφορετική εφαρμογή/βάση από Nextcloud — τα scripts του root δεν την καλύπτουν.
Από το custom-calendar directory, με το app σταματημένο:

```bash
sudo docker compose stop app
sudo docker compose run --rm --no-deps -T --entrypoint tar app -C /data -czf - . > calendar-data.tar.gz
sudo docker compose start app
sudo docker save -o calendar-images.tar org-calendar-custom:0.1 nginx:1.28-alpine
```

Μετέφερε images, πηγαίο κώδικα, .env, certs και data backup με ασφαλές μέσο.
Σε νέο target με Docker/Compose, ίδια CPU architecture και άδειο data volume:

```bash
sudo docker load -i calendar-images.tar
sudo docker compose run --rm --no-deps -T --entrypoint tar app -C /data -xzf - < calendar-data.tar.gz
sudo docker compose up -d --no-build --wait
```

Το init.py δεν τρέχει πάνω στο restored .env. Τα archives περιέχουν ευαίσθητα δεδομένα.
Μην τρέχεις `down -v` αν θέλεις να διατηρήσεις τη βάση.

## Έλεγχοι

```bash
python3 -m pip install -r requirements.txt pytest
python3 -m pytest -q
node --check static/app.js
TZ=Europe/Athens node --test tests/calendar-layout.test.cjs
```

Ελέγχθηκαν API permissions reader/writer, CSRF, CRUD, concurrent update conflicts,
recurrence με DST, validation και rate limiting. Δεν υπήρχε Docker daemon ή AD
στο περιβάλλον ανάπτυξης. Η νέα διάταξη ελέγχθηκε σε browser με δοκιμαστικά API
fixtures (όχι πραγματική σύνδεση backend/AD): ημέρα/εβδομάδα, διάρκεια,
επικαλύψεις, αρχική κύλιση και άνοιγμα συμβάντος. Έξι επιπλέον Node tests ελέγχουν
διάρκεια, επικαλύψεις, όρια μεσονυχτίου, ολοήμερα και DST.
