# Runbook: Bäckerei-Box

_Betriebshandbuch für den Server in der Bäckerei (roadmap.md D4, O1–O4). Stand 2026-11-05.
Die Box gibt es noch nicht (Q1); alles hier ist vorbereitet und, soweit ohne Hardware möglich,
getestet (`deploy/tests/run-tests.sh`)._

Die Dateien liegen im Repo unter `deploy/`:

| Pfad                                  | Zweck                                                               |
| ------------------------------------- | ------------------------------------------------------------------- |
| `deploy/scripts/install.sh`           | Box einrichten (idempotent), `--check` prüft nur                    |
| `deploy/scripts/deploy.sh`            | Deploy, Rollback, Status                                            |
| `deploy/scripts/hq-sync.sh`           | hq-Lese-Klon auf `origin/main` halten                               |
| `deploy/scripts/backup.sh`            | nächtliche DB-Kopie + restic off-site                               |
| `deploy/scripts/restore.sh`           | Backup zurückholen, prüfen, optional einspielen                     |
| `deploy/scripts/health.sh`            | Health-Check, Telegram-Meldung bei Zustandswechsel                  |
| `deploy/scripts/sqlite-tool.js`       | SQLite-Kopie/Prüfung ohne `sqlite3`-CLI, Prüfung des nativen Moduls |
| `deploy/systemd/*.service`, `*.timer` | Dienste und Zeitpläne                                               |
| `deploy/caddy/Caddyfile`              | HTTPS für `intern.<domain>`                                         |
| `deploy/bakery.env.example`           | Umgebung von API und Verwaltung → `/etc/bakery/bakery.env`          |
| `deploy/ops.env.example`              | Telegram, restic, Deploy → `/etc/bakery/ops.env`                    |
| `deploy/caddy/caddy.env.example`      | Domain + DNS-Token → `/etc/caddy/bakery.env`                        |
| `deploy/tests/run-tests.sh`           | lokale Tests der Skripte (macOS/Linux, ohne root)                   |

## 1. Überblick

```
Handy / Laden-Tablet / Backstube-Tablet / Büro-PC
        │  WLAN der Bäckerei, https://intern.<domain>
        ▼
Caddy :443  ── /api/* ──► bakery-api         127.0.0.1:5000  (node, esbuild-Bundle)
            └─ sonst ───► bakery-management  127.0.0.1:4201  (next start)
                                │
                                ├─ /var/lib/bakery/bakery.db      SQLite (WAL)
                                ├─ /var/lib/bakery/hq             hq-Lese-Klon (main)
                                └─ /var/lib/bakery/hq-write       hq-Schreib-Klon (B5b, Z9)
Timer: hq-Sync alle 10 min + 14:50/17:50 · Backup 23:30 · Health alle 5 min
```

| Ort                                 | Inhalt                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `/opt/bakery/repo.git`              | Bare-Klon von `H-Bakery/website`                               |
| `/opt/bakery/releases/<sha>-<Zeit>` | ein Build je Deploy (git-Worktree mit `node_modules` + `dist`) |
| `/opt/bakery/current`               | Symlink auf das aktive Release                                 |
| `/opt/bakery/src`                   | root-eigener Klon: Quelle für Units und Skripte                |
| `/opt/bakery/bin`                   | die Skripte aus `deploy/scripts` (aktualisiert jedes Deploy)   |
| `/etc/bakery/bakery.env`            | Konfiguration von API und Verwaltung (root:bakery 0640)        |
| `/etc/bakery/ops.env`               | Telegram, restic, Deploy (root:root 0600)                      |
| `/etc/bakery/restic-password`       | Schlüssel des Off-site-Backups (root:root 0600)                |
| `/var/lib/bakery/`                  | Daten: DB, hq-Klone, `backup/`, `state/`                       |
| `journalctl -u bakery-*`            | alle Logs                                                      |

Dienste: `bakery-api`, `bakery-management` (laufen dauerhaft, `Restart=always`), dazu
`bakery-hq-sync`, `bakery-backup`, `bakery-health` als Timer. Alles läuft als Benutzer `bakery`.
Die Zeitpläne stehen ausdrücklich in `Europe/Berlin`.

**Rechte – nicht lockern.** `ops.env` und `restic-password` kann der Benutzer `bakery` nicht
lesen: systemd liest `ops.env` als root und gibt die Werte nur an `bakery-backup` und
`bakery-health` weiter, das restic-Passwort bekommt nur `bakery-backup` (`LoadCredential=`,
systemd ≥ 247). Wer die API übernimmt, kommt so nicht an Telegram-Token und Backup-Zugang.
`/opt/bakery` gehört root; `bakery` darf nur `releases/` und `repo.git` beschreiben, denn dort
laufen `npm ci` und der Build. Was root ausführt (Skripte in `bin/`, Units), kommt aus dem
root-eigenen Klon `src/`, nie aus einem Release.

## 2. Wer macht was

| Aufgabe                                           | Wer                          | Wann                            |
| ------------------------------------------------- | ---------------------------- | ------------------------------- |
| Box kaufen, Router: feste IP, DNS-Zugang (Q1, Q2) | Inhaber                      | vor Inbetriebnahme              |
| GitHub-Token für hq (Q3), Backup-Ziel (Q4)        | Inhaber                      | vor Inbetriebnahme              |
| Box einrichten, Deploy, Updates                   | Entwickler                   | nach Bedarf, nie 02–13 Uhr      |
| Telegram-Alarm lesen und reagieren                | Entwickler (+ Inhaber)       | sofort                          |
| Tägliche 5-Minuten-Prüfung (M3)                   | Entwickler                   | täglich bis 24.12.              |
| Restore-Übung                                     | Entwickler mit Inhaber       | vor M0 (14.11.), dann monatlich |
| Entscheidung „auf Papier umstellen"               | wer im Laden/Backstube steht | wenn die App > 10 min blockiert |
| restic-Passwort im Passwort-Safe                  | Inhaber                      | bei Inbetriebnahme              |

**Deploy-Fenster:** nachmittags nach Ladenschluss, Montag (Ruhetag) bevorzugt. Nie zwischen
02:00 und 13:00 (Backstube und Laden arbeiten), nie Freitag nach 14:00 (Samstags-Backzettel).

## 3. Inbetriebnahme der Box

### 3.1 Hardware und Betriebssystem

1. Raspberry Pi 5 (8 GB) mit NVMe-SSD **oder** ein Mini-PC (x86_64). Notlösung: der Büro-PC mit
   demselben Debian-Setup (roadmap §8).
2. Betriebssystem: Raspberry Pi OS Lite 64-bit (Debian 12) bzw. Debian 12 ohne Desktop. Vom
   SSD booten, nicht von der SD-Karte.
3. Beim Flashen: Hostname `bakery-box`, ein Admin-Benutzer mit SSH-Schlüssel, **kein**
   Passwort-Login.
4. Erste Anmeldung, dann:

   ```bash
   sudo apt update && sudo apt full-upgrade -y
   sudo apt install -y unattended-upgrades git curl sqlite3 restic openssl ufw
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

### 3.2 Netzwerk

1. Box per **Kabel** an den Router (WLAN nur für die Geräte).
2. Im Router eine **feste IP** für die Box vergeben (DHCP-Reservierung), z. B. `192.168.178.20` (Q2).
3. **WLAN in der Backstube testen** (Tablet an den Arbeitsplatz, Seite laden). Schwach → Access
   Point oder ausgedruckter Backzettel (roadmap §8).
4. FRITZ!Box und andere Router mit **DNS-Rebind-Schutz** blockieren öffentliche Namen, die auf
   eine LAN-IP zeigen. Ausnahme eintragen: FRITZ!Box → Heimnetz → Netzwerk →
   Netzwerkeinstellungen → DNS-Rebind-Schutz → `intern.<domain>`. Ohne diese Ausnahme lädt
   `https://intern.<domain>` auf keinem Gerät.

### 3.3 Node.js

Die Units erwarten Node unter `/usr/bin/node`. Node 20 hat seit 30.04.2026 keine
Sicherheitsupdates mehr; **Node 22 LTS** nehmen (die API wird für `node20` gebaut und läuft
darauf unverändert):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
less /tmp/nodesource_setup.sh          # lesen, dann:
sudo bash /tmp/nodesource_setup.sh && sudo apt install -y nodejs
node -v                                # v22.x
```

### 3.4 Caddy mit DNS-Plugin

```bash
# Caddy-Paketquelle laut https://caddyserver.com/docs/install#debian-ubuntu-raspbian, dann:
sudo apt install -y caddy
sudo caddy add-package github.com/caddy-dns/desec   # Plugin je nach Antwort auf Q2, siehe 3.7
sudo apt-mark hold caddy                             # sonst überschreibt apt das Plugin-Binary
caddy list-modules | grep dns.providers              # muss den Anbieter zeigen
```

### 3.5 install.sh

```bash
git clone https://github.com/H-Bakery/website.git ~/website
sudo ~/website/deploy/scripts/install.sh --apt
```

Das Skript legt an bzw. prüft (jeder Schritt ist wiederholbar):

- Zeitzone `Europe/Berlin`, Benutzer `bakery` (System-Benutzer, Home `/var/lib/bakery`)
- `/etc/bakery/bakery.env` und `ops.env` aus den Vorlagen, `JWT_SECRET` und
  `/etc/bakery/restic-password` zufällig erzeugt. Vorhandene Dateien bleiben unangetastet (nur
  die Rechte von `ops.env`/`restic-password` werden auf root:root 0600 nachgezogen); neue
  Schlüssel aus den Vorlagen werden als WARNUNG gemeldet.
- `/etc/caddy/bakery.env` und `/etc/caddy/Caddyfile` (eine vorhandene Caddyfile wird gesichert)
- Bare-Klon `/opt/bakery/repo.git`, root-eigener Klon `/opt/bakery/src`, hq-Lese-Klon (sobald
  `HQ_GITHUB_TOKEN` gesetzt ist). Einen **schon vorhandenen** hq-Klon markiert `install.sh` nicht
  selbst als Lese-Klon (das würde die Schutzprüfung von `hq-sync.sh` aushebeln), sondern meldet
  ihn – Markierung dann von Hand, §6.
- Skripte nach `/opt/bakery/bin`, Units nach `/etc/systemd/system`, Timer aktiviert

**Sofort danach:** den Inhalt von `/etc/bakery/restic-password` in den Passwort-Safe des Inhabers.
Ohne dieses Passwort ist jedes Off-site-Backup wertlos.

### 3.6 Konfiguration ausfüllen

```bash
sudoedit /etc/bakery/bakery.env    # Domain in CORS_ORIGIN / NEXT_PUBLIC_API_URL, HQ_GITHUB_TOKEN (Q3)
sudoedit /etc/bakery/ops.env       # TELEGRAM_*, RESTIC_REPOSITORY + Zugang (Q4)
sudoedit /etc/caddy/bakery.env     # BAKERY_DOMAIN, ACME_EMAIL, ACME_DNS_* (Q2)
sudo /opt/bakery/bin/install.sh    # noch einmal: legt jetzt den hq-Lese-Klon an
```

Format beider Dateien: `KEY=wert`, ohne `export`, ohne Leerzeichen um `=`. Sie werden von
systemd **und** von bash gelesen.

`NEXT_PUBLIC_API_URL` und `NEXT_PUBLIC_PILOT_MODE` werden beim Build in die Web-App eingebacken.
Wer sie ändert, muss neu bauen: `sudo /opt/bakery/bin/deploy.sh --rebuild`. Solange
`NEXT_PUBLIC_API_URL` oder `CORS_ORIGIN` noch `example.` aus der Vorlage enthalten, bricht
`deploy.sh` vor dem Build ab, und `install.sh --check` meldet es.

`HEALTH_TLS_HOST` in `ops.env` auf `intern.<domain>` setzen, sobald das Zertifikat da ist (§3.7):
dann prüft der Health-Check HTTPS über Caddy und meldet, wenn das Zertifikat in weniger als 14
Tagen abläuft – eine ausgefallene DNS-01-Erneuerung fällt so Wochen vor dem Ablauf auf.

Telegram: mit @BotFather einen eigenen Bot „Bäckerei Box" anlegen (nicht Annas Bot), dem Bot im
gewünschten Chat schreiben, die Chat-ID über `https://api.telegram.org/bot<TOKEN>/getUpdates`
ablesen.

### 3.7 Zertifikat (DNS-01, Q2)

`intern.<domain>` braucht zwei Dinge im öffentlichen DNS:

1. einen **A-Eintrag** `intern` → feste LAN-IP der Box (z. B. `192.168.178.20`). Von außen ist
   die Adresse nutzlos, im WLAN der Bäckerei führt sie zur Box.
2. einen Weg, den TXT-Eintrag `_acme-challenge.intern.<domain>` **per API** zu setzen. Damit
   holt Caddy das Let's-Encrypt-Zertifikat, ohne dass die Box aus dem Internet erreichbar ist.

**Befund 2026-11-05:** die Domain der Bäckerei (`bäckerei-heusser.de`) liegt bei **STRATO**
(Nameserver `*.rzone.de`). STRATO hat keine DNS-API, also gibt es kein Caddy-Plugin dafür.
Drei Wege, Entscheidung beim Inhaber (Q2):

| Weg                                                         | Aufwand                                                                                           | Caddyfile                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **A. CNAME-Delegation zu deSEC** (Vorschlag)                | kostenloses Konto bei desec.io, Zone z. B. `baeckerei-box.dedyn.io`; bei STRATO nur zwei Einträge | aktiver Block (`dns desec` + `dns_challenge_override_domain`) |
| B. ganze Domain zu Cloudflare oder Hetzner DNS              | Umzug aller Einträge (Website auf GitHub Pages, **E-Mail/MX**) – riskant                          | Alternative einkommentieren, Override streichen               |
| C. eigene Domain nur für die Box bei einem Anbieter mit API | neue Domain (wenige Euro/Jahr)                                                                    | wie B                                                         |

Weg A Schritt für Schritt:

1. Bei deSEC registrieren, Domain `baeckerei-box.dedyn.io` (Beispielname) anlegen, einen
   API-Token erzeugen.
2. Bei STRATO (DNS-Verwaltung der Domain): A-Eintrag `intern` → LAN-IP, und
   CNAME `_acme-challenge.intern` → `_acme-challenge.intern.baeckerei-box.dedyn.io`.
   Vorher prüfen, ob STRATO einen CNAME mit Unterstrich für eine Subdomain zulässt; wenn nicht,
   Weg C.
3. `/etc/caddy/bakery.env`: `ACME_DNS_API_TOKEN=<deSEC-Token>`,
   `ACME_DNS_OVERRIDE=_acme-challenge.intern.baeckerei-box.dedyn.io`.
4. `sudo bash -c 'set -a; . /etc/caddy/bakery.env; caddy validate --config /etc/caddy/Caddyfile'`,
   dann `sudo systemctl daemon-reload && sudo systemctl restart caddy && journalctl -u caddy -f` –
   nach ein bis zwei Minuten „certificate obtained successfully".

Caddy erneuert das Zertifikat selbst (alle ~60 Tage). Läuft es trotzdem ab, siehe §8.

### 3.8 Firewall

API und Verwaltung lauschen auf `127.0.0.1`; die Firewall ist die zweite Linie (die API lauscht
bis zur B0-Folgeaufgabe noch auf allen Schnittstellen, siehe §10):

```bash
sudo ufw default deny incoming
sudo ufw allow from 192.168.178.0/24 to any port 22,80,443 proto tcp   # LAN-Netz anpassen
sudo ufw allow in on tailscale0 to any port 22 proto tcp                # erst nach §7
sudo ufw enable
```

### 3.9 Erstes Deploy und Abnahme

```bash
sudo /opt/bakery/bin/deploy.sh main      # npm ci + Build dauern auf dem Pi ~10–15 min
sudo /opt/bakery/bin/install.sh --check  # prüft u. a. node -e "require('sqlite3')" im Release
```

Konten anlegen: mit der `create-user`-CLI aus B3 (Befehl steht nach B3 hier). Liste der
Mitarbeitenden: Q5.

Abnahme M0 (roadmap §6):

- [ ] `https://intern.<domain>` lädt auf Handy, Laden-Tablet, Backstube-Tablet und Büro-PC,
      Schloss-Symbol ohne Warnung
- [ ] jede Person kann sich anmelden; das Laden-Tablet wechselt per PIN
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://intern.<domain>/api/preorders` → `401`
- [ ] `sudo reboot` → nach 2 Minuten alles wieder da, keine Daten verloren
- [ ] Restore-Übung auf einem anderen Rechner bestanden (§5.3)
- [ ] Testalarm per Telegram angekommen (§8.1)

## 4. Deploy

Pull-basiert: die Box holt sich den Code, es gibt keinen Runner und keinen Zugang von GitHub zur
Box. Jedes Deploy baut in ein **neues** Verzeichnis, während die alte Version weiterläuft; erst
danach wird umgeschaltet. Ausfallzeit: die Sekunden des Neustarts.

```bash
sudo /opt/bakery/bin/deploy.sh                # DEPLOY_REF aus ops.env (Vorgabe main)
sudo /opt/bakery/bin/deploy.sh pilot          # Branch, Tag oder Commit
sudo /opt/bakery/bin/deploy.sh --status       # aktives, vorheriges und alle gebauten Releases
sudo /opt/bakery/bin/deploy.sh --rebuild      # gleichen Commit neu bauen (nach NEXT_PUBLIC_*-Änderung)
sudo /opt/bakery/bin/deploy.sh --no-restart X # nur bauen (z. B. morgens vorbereiten, abends umschalten)
```

Was passiert:

1. `git fetch`, Commit auflösen, Worktree `releases/<sha>-<Zeit>` anlegen
2. `npm ci` – oder `node_modules` des laufenden Releases kopieren, wenn `package-lock.json`
   gleich ist (`--force-install` erzwingt `npm ci`)
3. Prüfung, ob das native `sqlite3` lädt (D12)
4. Build: `npx nx run bakery-api:bundle` und `npx nx build bakery-management` mit
   `NX_ISOLATE_PLUGINS=false NODE_ENV=production`
5. lokale DB-Kopie `backup/snapshots/bakery-pre-deploy-*.db` (die API migriert beim Start);
   der Pfad steht in `state/deploy-pre-db`
6. Skripte und Units übernehmen: root holt denselben Commit in `/opt/bakery/src` selbst von
   origin und ruft von dort `install.sh --units-only`. Gibt es den Commit auf origin nicht, wird
   nicht umgeschaltet (Exit 3).
7. `current` umschalten, Dienste neu starten, bis zu 120 s auf `/health` und die Startseite warten
8. Telegram-Nachricht mit dem Ergebnis; alte Releases über `KEEP_RELEASES` (3) hinaus löschen

Während des Neustarts liegt `state/maintenance`, damit der Health-Check nicht Alarm schlägt.

`npm ci` und der Build laufen als `bakery` mit **geleerter Umgebung** (`env -i`): sie sehen nur
`PATH`, `HOME`, Locale, die Nx-/Node-Schalter und die Build-Schlüssel aus `bakery.env`
(`NEXT_PUBLIC_*`, `API_URL`, `HQ_*_DIR`, `TZ`; einstellbar über `DEPLOY_BUILD_ENV_KEYS`) – kein
`JWT_SECRET`, kein `HQ_GITHUB_TOKEN`, keine Telegram-, restic- oder AWS-Zugänge. npm-Skripte sind
fremder Code. Aus `ops.env` übernimmt `deploy.sh` selbst nur `TELEGRAM_*`, `DEPLOY_*`,
`KEEP_RELEASES` und `HEALTH_*`.

### 4.1 Rollback

Schlägt der Health-Check nach dem Deploy fehl, schaltet das Skript **nicht** selbst zurück und
nennt die Befehle – in dieser Reihenfolge:

```bash
sudo /opt/bakery/bin/deploy.sh --rollback     # zurück auf das vorherige Release, Sekunden
```

**Rollback mit Migration:** hat die neue Version das Datenbankschema geändert, versteht die alte
Version die DB womöglich nicht mehr. Dann zusätzlich die Kopie von vor dem Deploy einspielen –
alles, was seit dem Deploy erfasst wurde, ist dabei verloren und muss nachgetragen werden:

```bash
cat /var/lib/bakery/state/deploy-pre-db       # Kopie dieses Deploys (oder: ls -t …/bakery-pre-deploy-*.db)
sudo /opt/bakery/bin/restore.sh --from-file <diese Datei> --apply
```

**Erst `--rollback`, dann `restore.sh`.** Andersherum würde die noch aktive neue Version die
eingespielte Kopie beim Start sofort wieder migrieren. `restore.sh --apply` verweigert sich
deshalb, solange das fehlgeschlagene Release aktiv ist (`state/deploy-failed`; `--force` übergeht
das).

## 5. Backup und Restore

### 5.1 Was gesichert wird

Jede Nacht um 23:30 (`bakery-backup.timer`; Backbeginn ist 02:00):

1. konsistente Kopie der laufenden DB – `sqlite3 .backup`, ohne CLI über `VACUUM INTO` mit dem
   npm-Modul – und `integrity_check`
2. lokal: `backup/snapshots/bakery-nightly-<Zeit>.db` (7 Stück), `backup/current/bakery.db`
3. off-site mit restic: `backup/current/bakery.db`, `/etc/bakery/bakery.env` (ohne `ops.env`
   und restic-Passwort – sie öffnen das Backup selbst und gehören in den Passwort-Safe),
   `BACKUP_EXTRA_PATHS` (Vorgabe: hq-Schreib-Klon mit evtl. noch nicht gepushten Commits)
4. `restic forget --keep-daily 14 --keep-weekly 8 --prune` (nicht bei `RESTIC_FORGET=0`),
   sonntags zusätzlich `restic check`
5. `backup/last-success` – der Health-Check meldet, wenn es älter als 36 h ist

Nicht gesichert, weil reproduzierbar: Code (`/opt/bakery`), hq-Lese-Klon (liegt auf GitHub).

### 5.2 Erstes Einrichten des Off-site-Ziels (Q4)

```bash
sudo bash -c 'set -a; . /etc/bakery/ops.env; restic init'
sudo systemctl start bakery-backup.service && journalctl -u bakery-backup -n 30
sudo bash -c 'set -a; . /etc/bakery/ops.env; restic snapshots'
```

**Empfohlen: Zugang der Box nur zum Anhängen.** Wer die Box übernimmt, soll das Off-site-Backup
nicht löschen können. Je nach Ziel (Q4):

- `rest-server --append-only` (eigener Server): die Box darf nur hinzufügen.
- S3-kompatibel (RustFS, MinIO, B2): Schlüssel der Box ohne `DeleteObject` – außer auf dem Präfix
  `locks/`, den restic für seine Sperren braucht.

Dann in `ops.env` `RESTIC_FORGET=0` setzen; `forget --prune` läuft ab dann monatlich vom
Entwickler-Rechner mit einem eigenen, vollen Zugang (nicht auf der Box):
`restic forget --host bakery-box --tag bakery --keep-daily 14 --keep-weekly 8 --prune`.

### 5.3 Restore-Übung (vor M0, dann monatlich)

Ziel: beweisen, dass sich die Daten **auf einem anderen Rechner** zurückholen lassen.

1. Auf dem Entwickler-Rechner restic installieren; Repository-Adresse und Zugangsdaten aus
   `ops.env`, das Passwort aus dem **Passwort-Safe** (nicht von der Box kopieren – genau das wird
   geübt).
2. Website-Repo auschecken (für `restore.sh` und `sqlite-tool.js`), dann:

   ```bash
   export RESTIC_REPOSITORY=... RESTIC_PASSWORD_FILE=~/restic-pw AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...
   restic snapshots --tag bakery
   BACKUP_DIR=/var/lib/bakery/backup deploy/scripts/restore.sh --snapshot latest --target ~/restore-test
   ```

   Das Skript prüft `integrity_check` und zeigt die Zeilen je Tabelle. Plausibel? (Anzahl
   Benutzer, Vorbestellungen der letzten Tage.)

3. Ergebnis mit Datum im Log von roadmap.md §11 vermerken. Restore-Kopie danach löschen
   (enthält Kundendaten).

### 5.4 Ernstfall: DB auf der Box zurückholen

```bash
sudo /opt/bakery/bin/restore.sh --snapshot latest                 # erst nur holen und prüfen
sudo /opt/bakery/bin/restore.sh --snapshot latest --apply         # dann einspielen
# oder aus einer lokalen Kopie:
sudo /opt/bakery/bin/restore.sh --from-file /var/lib/bakery/backup/snapshots/<datei>.db --apply
```

`--apply` stoppt die API, verschiebt die alte DB **samt `-wal` und `-shm`** nach
`bakery.db.vor-restore-<Zeit>`, setzt die Kopie ein und startet die API. Währenddessen liegt
`state/maintenance` (kein Fehlalarm), und das nächtliche Backup wartet (gemeinsame Sperre). Die `-wal`-Datei der
alten DB darf nie neben der eingespielten liegen bleiben – SQLite würde sie anwenden und die DB
beschädigen.

### 5.5 Box komplett verloren

Neue Box nach §3 aufsetzen, dann `bakery.env` aus dem Backup holen
(`restic restore latest --target /tmp/r --include /etc/bakery`), `ops.env` und das
restic-Passwort aus dem Passwort-Safe, `install.sh`, `deploy.sh`,
`restore.sh --snapshot latest --apply`.

## 6. hq-Sync

Der **Lese-Klon** `/var/lib/bakery/hq` steht immer auf `origin/main` (roadmap §4a). Produkte,
Kassenberichte, Finanzen und Tagesziel liest die App von dort.

- `bakery-hq-sync.timer`: alle 10 Minuten, dazu 14:50 und 17:50 (20 Minuten nach den
  Pipeline-Läufen auf `robot0`). War die Box um 14:50 aus, läuft der Sync beim Start nach.
- `hq-sync.sh` macht `git fetch` + `checkout -B main` + `reset --hard origin/main` + `clean -ffd`.
  Es committet und pusht **nie**.
- Schreiben (Stammdaten-PR `app/edits`, Snapshots nach `data/production/**`) passiert nur im
  separaten **Schreib-Klon** `HQ_WRITE_DIR` (B5b, Z9).

Von Hand:

```bash
sudo systemctl start bakery-hq-sync.service && journalctl -u bakery-hq-sync -n 20
cat /var/lib/bakery/state/hq-sync.ok      # Zeitpunkt + Commit des letzten Erfolgs
```

| Exit | Bedeutung                                                               | Abhilfe                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | aktuell                                                                 | –                                                                                                                                                                                               |
| 2    | kein Klon, nicht als Lese-Klon markiert, oder `HQ_DIR` = `HQ_WRITE_DIR` | `install.sh` erneut; Markierung **nur, wenn es wirklich der Lese-Klon ist** (der Sync setzt ihn hart zurück): `sudo -u bakery git -C /var/lib/bakery/hq config bakery.role read-clone`          |
| 3    | `fetch` fehlgeschlagen                                                  | Internet? Token abgelaufen (`HQ_GITHUB_TOKEN`, Q3)? App läuft mit altem Stand weiter                                                                                                            |
| 4    | lokale Commits im Lese-Klon                                             | Jemand hat hineingeschrieben. Commits ansehen (`git -C … log origin/main..HEAD`), nötigenfalls im Schreib-Klon nachziehen, dann `sudo -u bakery env HQ_SYNC_FORCE=1 /opt/bakery/bin/hq-sync.sh` |
| 5    | reset/clean fehlgeschlagen                                              | Platte voll? Rechte (`chown -R bakery: /var/lib/bakery/hq`)?                                                                                                                                    |

Der Health-Check meldet, wenn der letzte erfolgreiche Sync älter als 90 Minuten ist.

## 7. Fernwartung (O4, wartet auf Q8)

Vorschlag: **Tailscale nur auf der Box** – keine Portfreigabe im Router, kein Subnet-Routing,
also kein Zugriff auf andere Geräte der Bäckerei.

```bash
curl -fsSL https://tailscale.com/install.sh -o /tmp/tailscale-install.sh
less /tmp/tailscale-install.sh && sudo sh /tmp/tailscale-install.sh
sudo tailscale up --hostname bakery-box        # Link im Browser mit dem Tailnet-Konto bestätigen
```

Danach in der Tailscale-Admin-Konsole:

1. für `bakery-box` **Key expiry deaktivieren** (sonst ist die Box nach 180 Tagen weg)
2. ACL: nur die Geräte des Entwicklers dürfen `bakery-box:22`; die Box selbst darf nichts im
   Tailnet ansprechen
3. **keine** Subnet-Routes und kein Exit-Node für die Box freigeben

Zugriff: `ssh <admin>@bakery-box` (MagicDNS). Die Web-App aus der Ferne:
`ssh -L 8443:127.0.0.1:443 <admin>@bakery-box`, dann im Browser
`https://intern.<domain>:8443` mit einem `hosts`-Eintrag `127.0.0.1 intern.<domain>`.

Ohne Tailscale (Q8 = nein): Fernwartung nur vor Ort oder per Bildschirmfreigabe vom Büro-PC.

## 8. Störungen

**Regel (M3):** blockiert die App die Arbeit länger als **10 Minuten**, wird auf Papier
umgestellt (§9). Erst arbeiten, dann reparieren.

### 8.1 Alarm prüfen

```bash
sudo systemctl start bakery-health.service; journalctl -u bakery-health -n 20   # jede Prüfung im Log
systemctl list-timers 'bakery-*'
systemctl --failed
```

Nicht `sudo -u bakery health.sh` von Hand: als `bakery` ist `ops.env` nicht lesbar, das Skript
hätte keinen Telegram-Zugang, würde eine Störung aber trotzdem als „gemeldet" vermerken.

Testalarm: `sudo systemctl stop bakery-management`, bis zu 5 Minuten warten → Telegram „STÖRUNG",
`sudo systemctl start bakery-management` → „WIEDER OK". Gemeldet wird nur der Wechsel, nicht jede
Minute der Störung.

### 8.2 Was tun bei …

| Symptom                                               | Prüfen                                                        | Abhilfe                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Alarm „API": Seiten laden, aber Daten fehlen / Fehler | `journalctl -u bakery-api -n 100`                             | Absturzschleife nach Deploy → `deploy.sh --rollback`; DB gesperrt/kaputt → §5.4         |
| Alarm „Verwaltung": Seite lädt nicht                  | `journalctl -u bakery-management -n 100`                      | `systemctl restart bakery-management`; nach Deploy → `--rollback`                       |
| Seite lädt auf keinem Gerät, Box läuft                | `systemctl status caddy`, vom Handy `https://intern.<domain>` | Zertifikat (`journalctl -u caddy`), DNS-Rebind-Ausnahme (§3.2), feste IP geändert?      |
| Browser warnt vor dem Zertifikat / Alarm „HTTPS"      | `journalctl -u caddy -g acme`                                 | DNS-Token abgelaufen/geändert (Q2) → `/etc/caddy/bakery.env`, `systemctl restart caddy` |
| Box antwortet gar nicht (kein Ping, kein SSH)         | Strom, Kabel, LED                                             | Stromstecker ziehen und wieder einstecken; Papier-Fallback; Entwickler anrufen          |
| Alarm „Backup"                                        | `journalctl -u bakery-backup -n 50`                           | Exit 10–13 siehe `backup.sh`; Ziel/Netz prüfen; `systemctl start bakery-backup`         |
| Alarm „hq-Sync"                                       | `journalctl -u bakery-hq-sync -n 20`                          | §6; die App läuft mit dem letzten Stand weiter, kein Notfall                            |
| Alarm „Speicherplatz"                                 | `df -h /var/lib/bakery`, `du -sh /opt/bakery/releases/*`      | `KEEP_RELEASES` senken, `journalctl --vacuum-time=14d`, alte `backup/snapshots` löschen |
| Produkte/Preise geändert, App zeigt alten Stand       | `cat /var/lib/bakery/state/hq-sync.ok`                        | Änderung schon in hq `main` gemerged? Sonst „wartet auf Freigabe" (D6); Sync von Hand   |
| Kein Telegram trotz Störung                           | `journalctl -u bakery-health -n 20`                           | Token/Chat-ID in `ops.env`; Telegram-Fehler werden beim nächsten Lauf erneut gesendet   |

## 9. Papier-Fallback

Liegt ausgedruckt im Laden und in der Backstube (P6):

- **Vorbestellungen:** Papierformular (P6). Zettel sammeln und nachtragen, sobald die App wieder
  läuft – mit dem tatsächlichen Annahmedatum in der Notiz.
- **Backzettel:** der zuletzt freigegebene Backzettel ist als A4 ausgedruckt (Z7). Für den
  nächsten Tag: den gestrigen Ausdruck mit Hand korrigieren.
- **Abholliste:** jeden Nachmittag die Abholliste des nächsten Tages ausdrucken (P2), damit sie
  bei einem Ausfall am Morgen vorliegt.

## 10. Offene Punkte

- **Q1** Hardware, **Q2** feste IP + DNS-Weg (§3.7), **Q3** hq-Token, **Q4** Backup-Ziel,
  **Q8** Tailscale – ohne sie bleibt O1/O2/O4 Vorbereitung.
- **B0:** `deploy.sh` erwartet `npx nx run bakery-api:bundle` → `dist/apps/bakery-api/bundle/main.js`
  und `DB_PATH`. Bitte zusätzlich `HOST` beim `listen()` beachten (Vorgabe `127.0.0.1`) und nur
  nach stdout loggen: die Unit erlaubt Schreiben nur unter `/var/lib/bakery`. Nach dem Merge
  `deploy/bakery.env.example` mit `apps/bakery-api/src/config/env.ts` abgleichen.
- **B3:** `create-user`-CLI-Befehl in §3.9 eintragen.
- **B5b/Z9:** Anlage des Schreib-Klons `HQ_WRITE_DIR` (und des `main`-Worktrees für Snapshots)
  gehört zu diesen Aufgaben; `install.sh` legt nur den Lese-Klon an.
- Die Caddyfile ist ohne Caddy-Binary geschrieben und nicht maschinell geprüft; auf der Box
  nach dem Ausfüllen von `/etc/caddy/bakery.env` prüfen:
  `sudo bash -c 'set -a; . /etc/caddy/bakery.env; caddy validate --config /etc/caddy/Caddyfile'`.
- Die systemd-Units sind ohne systemd geschrieben; auf der Box
  `systemd-analyze verify /etc/systemd/system/bakery-*` und
  `systemd-analyze security bakery-api` laufen lassen.
