# Εγκατάσταση στο VM

## 1. Υποδομή

Χρησιμοποίησε ξεχωριστό Linux VM, όχι τον domain controller.
Εγκατέστησε Docker Engine και το Compose plugin σύμφωνα με
https://docs.docker.com/engine/install/ubuntu/ . Χρειάζονται επίσης git, python3, openssl.
Οι εντολές Docker απαιτούν κατάλληλα δικαιώματα στον host.

Ονόματα παραδειγμάτων (αντικατάστησέ τα παντού):

- DNS domain: `example.internal`
- Calendar: `calendar.example.internal` → IP του νέου VM
- Domain controller: `dc01.example.internal`
- Base DN: `DC=example,DC=internal`
- Ομάδα εισόδου: `CN=Calendar-Users,OU=Groups,DC=example,DC=internal`
- Ομάδα αναγνωστών: `CN=Calendar-Directors,OU=Groups,DC=example,DC=internal`

Δημιούργησε δύο AD security groups. Βάλε αρχηγό και διευθυντές **απευθείας**
στην Calendar-Users και μόνο τους διευθυντές στην Calendar-Directors.
Τα φίλτρα παρακάτω χρησιμοποιούν απευθείας συμμετοχή, όχι nested groups.
Δεν χρειάζεται domain join του Linux VM. Χρειάζεται επικοινωνία με DNS/LDAPS του AD.

Το Docker subnet στο .env (προεπιλογή 172.29.88.0/24) δεν πρέπει να επικαλύπτει
LAN/VPN/άλλα Docker networks. Αν το αλλάξεις, άλλαξε και PROXY_IP μέσα στο νέο subnet.

## 2. HTTPS και αρχική εκκίνηση

Εκτέλεσε τις εντολές του README με το πραγματικό DNS όνομα.
Το `scripts/init.py` δεν ξαναγράφει υπάρχον .env ή TLS αρχεία.
Τα secrets δεν αποθηκεύονται στο Git. Το `secrets/` έχει δικαιώματα 0700 στον host.
Τα επιμέρους secret files είναι readable από τα container processes μέσω mount.

Για κανονική χρήση, αντικατάστησε:

- `certs/calendar.crt`: PEM certificate/full chain για το hostname.
- `certs/calendar.key`: αντίστοιχο private key, χωρίς passphrase, chmod 600.

Κράτησε το certificate readable (chmod 644). Μετά:

```bash
docker compose exec proxy nginx -t
docker compose restart proxy
```

Η CA πρέπει να είναι trusted στους browsers, κατά προτίμηση μέσω GPO.
Μη χρησιμοποιείς παράκαμψη certificate warnings ως κανονική λύση.
Περιόρισε το TCP 443 στα επιτρεπόμενα LAN υποδίκτυα μέσω firewall/δικτύου.
Προσοχή: τα Docker published ports χρειάζονται κανόνες κατάλληλους για Docker,
όχι μόνο έναν απλό κανόνα UFW. Το BIND_IP στο .env μπορεί να περιορίσει το interface.

## 3. Active Directory μέσω LDAPS

Στον DC απαιτείται LDAPS με έγκυρο πιστοποιητικό για το DNS όνομά του.
Αντέγραψε μόνο το δημόσιο CA certificate/chain, σε PEM, στο `certs/ad-ca.crt`
και βάλε `chmod 644 certs/ad-ca.crt`. Μην αντιγράψεις private key της CA.
Το container χρησιμοποιεί LDAPTLS_CACERT και απαιτεί επαλήθευση TLS.
Δεν απενεργοποιούμε τον έλεγχο πιστοποιητικού.

```bash
docker compose restart app cron
```

Ως `calendar-admin`: Administration settings → LDAP / AD integration.
Δημιούργησε **ένα** LDAP configuration:

| Πεδίο | Τιμή παραδείγματος |
|---|---|
| Host | `ldaps://dc01.example.internal` |
| Port | `636` |
| User DN | DN ειδικού service account με read-only αναζήτηση στο AD |
| Password | Κωδικός του service account, καταχώριση μόνο στο UI |
| Base DN | `DC=example,DC=internal` |
| User display name | `displayName` |
| Group display name | `cn` |
| Group member association | `member` |

Δεν απαιτείται Domain Admin. Μην ανεβάσεις πραγματικούς κωδικούς ή AD στοιχεία στο repo.
Χρησιμοποίησε manual LDAP filters με τα δικά σου DNs.

**Users filter:**

```text
(&(objectCategory=person)(objectClass=user)(memberOf=CN=Calendar-Users,OU=Groups,DC=example,DC=internal)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))
```

**Login filter** (Login Attributes → manual filter):

```text
(&(objectCategory=person)(objectClass=user)(memberOf=CN=Calendar-Users,OU=Groups,DC=example,DC=internal)(!(userAccountControl:1.2.840.113556.1.4.803:=2))(|(sAMAccountName=%uid)(userPrincipalName=%uid)))
```

Ο περιορισμός πρέπει να υπάρχει **και στο login filter**. Το Users filter μόνο του
δεν αρκεί για αποκλεισμό εισόδου. Τα φίλτρα απορρίπτουν και disabled AD accounts.
Μην επιτρέψεις στον wizard να αντικαταστήσει το manual login filter με γενικό φίλτρο.

**Groups filter:**

```text
(&(objectClass=group)(|(distinguishedName=CN=Calendar-Users,OU=Groups,DC=example,DC=internal)(distinguishedName=CN=Calendar-Directors,OU=Groups,DC=example,DC=internal)))
```

Έλεγξε το configuration και το login name ενός εξουσιοδοτημένου λογαριασμού
με τα εργαλεία του wizard πριν το ενεργοποιήσεις. Κράτησε ανοιχτή την admin συνεδρία.
Οι χρήστες μπαίνουν με `username` ή `username@example.internal`.
Αυτό είναι AD authentication με φόρμα login, όχι αυτόματο Windows SSO.
Ο τοπικός τεχνικός administrator παραμένει σκόπιμα διαθέσιμος για αποκατάσταση.

## 4. Κοινό ημερολόγιο — μόνο ο αρχηγός γράφει

1. Συνδέονται αρχηγός και διευθυντές μία φορά με AD, ώστε να εμφανιστούν οι λογαριασμοί.
2. Ο αρχηγός δημιουργεί το ημερολόγιο **Πρόγραμμα Οργανισμού**.
3. Από Κοινή χρήση προσθέτει την ομάδα **Calendar-Directors**.
4. Αφήνει απενεργοποιημένη την επιλογή **Can edit / Δυνατότητα επεξεργασίας**.
5. Δεν δημιουργεί public link και δεν προσθέτει άλλους χρήστες με write access.
6. Οι διευθυντές ανοίγουν το κοινό ημερολόγιο από τον δικό τους λογαριασμό.

Οι τεχνικοί διαχειριστές του server μπορούν τελικά να επέμβουν στα δεδομένα·
το «μόνο ο αρχηγός γράφει» αφορά τους κανονικούς χρήστες της εφαρμογής.
Η ACL εφαρμόζεται από τον server και ισχύει και για πρόσβαση CalDAV.
Τα προσωπικά ημερολόγια των διευθυντών δεν επηρεάζονται.
Μην ορίζεις συμβάντα private/confidential εάν πρέπει όλοι οι αναγνώστες
να βλέπουν τις λεπτομέρειές τους: έλεγξε αυτή τη συμπεριφορά με δοκιμαστικό συμβάν.

Δεν ρυθμίζεται SMTP. Οι δουλειές είναι συμβάντα ημερολογίου,
όχι workflow ανάθεσης/ολοκλήρωσης. Το bootstrap απενεργοποιεί email invitations
και event reminder αποστολές. Δεν υπόσχεται push/browser ειδοποιήσεις όταν
η εφαρμογή είναι κλειστή. Οι αναγνώστες βλέπουν ενημερώσεις με ανανέωση της προβολής.

## 5. Υποχρεωτικός έλεγχος πριν τη χρήση

- `docker compose ps`: όλες οι υπηρεσίες τρέχουν, app/db/redis healthy.
- Άνοιγμα HTTPS χωρίς certificate warning.
- Επιτυχές login αρχηγού και διευθυντή μέσω AD.
- Απόρριψη άλλου AD χρήστη εκτός Calendar-Users και disabled λογαριασμού.
- Ο αρχηγός δημιουργεί, αλλάζει, διαγράφει ένα δοκιμαστικό συμβάν.
- Ο διευθυντής βλέπει το συμβάν και τις αλλαγές μετά από refresh.
- Ο διευθυντής δεν μπορεί να δημιουργήσει/μετακινήσει/διαγράψει συμβάν στο κοινό ημερολόγιο.
- Δοκιμή επαναλαμβανόμενου και ολοήμερου συμβάντος, περιγραφής και σωστής ώρας Europe/Athens.
- Restart containers και επιβεβαίωση ότι συμβάντα και κοινή χρήση παραμένουν.
- Δοκιμαστικό backup και restore σε απομονωμένο VM.

Η αφαίρεση από το AD group δεν σημαίνει αυτόματη άμεση ακύρωση όλων των υφιστάμενων
sessions λόγω cache/session lifecycle. Για άμεση ανάκληση απενεργοποίησε και τον
Nextcloud λογαριασμό, ανακάλεσε sessions/app passwords και επαλήθευσε τον αποκλεισμό.
