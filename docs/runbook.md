# Runbook: Bäckerei-Box

_Betriebshandbuch für den Server in der Bäckerei (roadmap.md D4, O1–O4). Stand 2026-11-08.
Vorläufig läuft der Pilot auf dem Agenten-Pi `robot0` (Pi 5, 4 GB, Debian 13; §3.1), eine eigene
Box folgt (Q1). Bis zum Zertifikat (Q2) im LAN über HTTP (§3.7), hq-Zugang über die GitHub-App
statt eines PAT (§3.6). Alles hier ist, soweit ohne Hardware möglich, getestet
(`deploy/tests/run-tests.sh`)._

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
| `deploy/scripts/hq-token.sh`          | GitHub-App-Token für hq erneuern (root, alle 30 min)                |
| `deploy/scripts/gh-app-token.mjs`     | JWT + Installationstoken, nur Node-Bordmittel                       |
| `deploy/systemd/*.service`, `*.timer` | Dienste und Zeitpläne                                               |
| `deploy/caddy/Caddyfile`              | HTTPS für `intern.<domain>`                                         |
| `deploy/caddy/Caddyfile.lan-http`     | HTTP auf Port 80 im LAN, bis das Zertifikat da ist (Q2)             |
| `deploy/bakery.env.example`           | Umgebung von API und Verwaltung → `/etc/bakery/bakery.env`          |
| `deploy/ops.env.example`              | Telegram, restic, Deploy → `/etc/bakery/ops.env`                    |
| `deploy/caddy/caddy.env.example`      | Domain + DNS-Token → `/etc/caddy/bakery.env`                        |
| `deploy/tests/run-tests.sh`           | lokale Tests der Skripte (macOS/Linux, ohne root)                   |

## 1. Überblick

```
Handy / Laden-Tablet / Backstube-Tablet / Büro-PC
        │  WLAN der Bäckerei, https://intern.<domain>  (bis Q2: http://<IP der Box>)
        ▼
Caddy :443 (bis Q2 :80) ── /api/* ──► bakery-api   127.0.0.1:5000  (node, esbuild-Bundle)
                        └─ sonst ───► bakery-management  127.0.0.1:4201  (next start)
                                │
                                ├─ /var/lib/bakery/bakery.db      SQLite (WAL)
                                ├─ /var/lib/bakery/hq             hq-Lese-Klon (main)
                                ├─ /var/lib/bakery/hq-write       hq-Schreib-Klon, Branch app/edits (B5b)
                                └─ /var/lib/bakery/hq-write-main  zweiter Worktree davon auf main (Z9)
Timer: hq-Sync alle 10 min + 14:50/17:50 · Vorbestellungs-Snapshot 22:15 · Backup 23:30 ·
       Anonymisierung 23:45 · Health alle 5 min · GitHub-App-Token alle 30 min ·
       in der API: Push/PR + Snapshots alle 15 min
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
| `/etc/bakery/github-app.pem`        | privater Schlüssel der GitHub-App (root:root 0600, Q3)         |
| `/etc/bakery/hq-token`              | daraus erzeugtes hq-Token, 1 h gültig (root:bakery 0640)       |
| `/var/lib/bakery/`                  | Daten: DB, hq-Klone, `backup/`, `state/`                       |
| `journalctl -u bakery-*`            | alle Logs                                                      |

Dienste: `bakery-api`, `bakery-management` (laufen dauerhaft, `Restart=always`), dazu
`bakery-hq-sync`, `bakery-backup`, `bakery-health`, `bakery-anonymize`,
`bakery-snapshot-preorders` als Timer. Alles läuft als
Benutzer `bakery` – bis auf `bakery-hq-token` (root, Timer alle 30 min), das als Einziges den
Schlüssel der GitHub-App liest.
Die Zeitpläne stehen ausdrücklich in `Europe/Berlin`.

**Rechte – nicht lockern.** `ops.env` und `restic-password` kann der Benutzer `bakery` nicht
lesen: systemd liest `ops.env` als root und gibt die Werte nur an `bakery-backup` und
`bakery-health` weiter, das restic-Passwort bekommt nur `bakery-backup` (`LoadCredential=`,
systemd ≥ 247). Wer die API übernimmt, kommt so nicht an Telegram-Token und Backup-Zugang.
`/opt/bakery` gehört root; `bakery` darf nur `releases/` und `repo.git` beschreiben, denn dort
laufen `npm ci` und der Build. Was root ausführt (Skripte in `bin/`, Units), kommt aus dem
root-eigenen Klon `src/`, nie aus einem Release. Den Schlüssel der GitHub-App
(`github-app.pem`) liest nur `bakery-hq-token`; `bakery` sieht nur das daraus erzeugte Token,
das eine Stunde gilt und nur für hq taugt (Contents + Pull requests).

### 1.1 Vor einer Änderung an `deploy/`

- **Neue Geheimnisse der Betriebs-Skripte gehören in `ops.env`, nie in `bakery.env`.** `bakery.env`
  kann der Benutzer `bakery` lesen - und damit jeder, der die API oder ein npm-Skript übernimmt.
- **`NEXT_PUBLIC_*` werden beim Build eingebacken.** Eine Änderung in `bakery.env` wirkt erst nach
  `deploy.sh --rebuild` (§4).
- **Braucht der Build eine neue Variable, sie in `DEPLOY_BUILD_ENV_KEYS` freigeben**
  (`deploy/scripts/deploy.sh`, Vorgabe: `NEXT_PUBLIC_*`, `API_URL`, `HQ_*_DIR`, `TZ`) - nicht die
  geleerte Umgebung (`env -i`) des Builds aushebeln. npm-Skripte sind fremder Code.
- **Was root ausführt, nie aus einem Release** (das gehört `bakery`), sondern aus `/opt/bakery/src`.
- **Node 22 LTS** auf der Box (§3.3).
- **Testen:** `deploy/tests/run-tests.sh` (macOS/Linux, ohne root, fünf Ports ab 5120 -
  `TEST_PORT_BASE` -, nur synthetische Daten). Nicht abgedeckt sind `install.sh`, die systemd-Units,
  Caddy, restic gegen ein echtes Repository und `npm ci`/Build im Release - das braucht die Box.

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

**Vorläufig (Entscheidung 2026-11-08): der Agenten-Pi `robot0`** (Pi 5, 4 GB, Debian 13), auf
dem auch die Agenten (OpenClaw) laufen – Schritte 1–3 entfallen. Vor `install.sh` prüfen,
dass die Ports frei sind (`sudo ss -ltnp | grep -E ':(80|443|5000|4201) '`). 4 GB reichen für
den Betrieb, knapp aber für `npm ci` + Build (`DEPLOY_NODE_OPTIONS`, Vorgabe
`--max-old-space-size=4096`): vor dem ersten Deploy Swap auf mindestens 4 GB setzen
(`/etc/dphys-swapfile` bzw. zram) und nicht um 14:30/17:30 deployen (Kassen-Pipeline der
Agenten). Die Agenten und ihre Dateien bleiben, wie sie sind – die Units
der App laufen mit `ProtectHome=yes` und sehen kein Home-Verzeichnis.

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

Für den LAN-HTTP-Betrieb bis Q2 (§3.7) reichen die ersten beiden Zeilen; Plugin und `hold`
kommen erst mit dem Zertifikat.

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
- `/etc/caddy/bakery.env` und `/etc/caddy/Caddyfile` (eine vorhandene Caddyfile wird gesichert):
  `Caddyfile.lan-http`, solange dort `BAKERY_LAN_HTTP=1` steht oder die Domain noch der
  Platzhalter ist, sonst die HTTPS-`Caddyfile` (§3.7)
- GitHub-App (§3.6): Rechte von `github-app.pem` (root:root 0600) und `hq-token`
  (root:bakery 0640) nachziehen; fehlt das Token oder ist es älter als 40 min, gleich eins holen.
  Fehlt der Schlüssel, nur eine WARNUNG.
- Bare-Klon `/opt/bakery/repo.git`, root-eigener Klon `/opt/bakery/src`, hq-Lese-Klon (sobald
  ein Token da ist – App-Token-Datei oder fester `HQ_GITHUB_TOKEN`; es erreicht git nur über
  die Umgebung, nie über die Befehlszeile). Einen **schon vorhandenen** hq-Klon markiert
  `install.sh` nicht selbst als Lese-Klon (das würde die Schutzprüfung von `hq-sync.sh`
  aushebeln), sondern meldet ihn – Markierung dann von Hand, §6.
- hq-Schreib-Klon `HQ_WRITE_DIR` auf Branch `app/edits` (Markierung `bakery.role=write-clone`)
  und daneben der Snapshot-Worktree `HQ_SNAPSHOT_DIR` auf `main` (§6.1) – ebenfalls erst mit
  einem Token, einen vorhandenen Klon fasst `install.sh` nicht an.
- Skripte nach `/opt/bakery/bin`, Units nach `/etc/systemd/system`, Timer aktiviert (auch
  `bakery-hq-token.timer`). Nach dem ersten Deploy genügt `sudo /opt/bakery/bin/install.sh`:
  Vorlagen, Units und Caddyfiles nimmt es dann aus `/opt/bakery/src`, das `deploy.sh` auf dem
  aktiven Commit hält. Davor (dort steht noch `main`) den Klon von oben nehmen.

**Sofort danach:** den Inhalt von `/etc/bakery/restic-password` in den Passwort-Safe des Inhabers.
Ohne dieses Passwort ist jedes Off-site-Backup wertlos.

### 3.6 Konfiguration ausfüllen

```bash
sudoedit /etc/bakery/bakery.env    # CORS_ORIGIN (bis Q2 http://<IP der Box>), HQ_GITHUB_TOKEN_FILE; NEXT_PUBLIC_API_URL leer lassen
sudoedit /etc/bakery/ops.env       # GH_APP_ID (Q3), TELEGRAM_*, RESTIC_REPOSITORY + Zugang (Q4)
sudoedit /etc/caddy/bakery.env     # bis Q2: BAKERY_LAN_HTTP=1; danach BAKERY_DOMAIN, ACME_EMAIL, ACME_DNS_*
sudo ~/website/deploy/scripts/install.sh   # noch einmal: holt das App-Token, legt die hq-Klone an
```

**GitHub-App statt PAT (Q3, Entscheidung 2026-11-08).** Die Box benutzt die vorhandene
GitHub-App der Agenten statt eines langlebigen Tokens. `bakery-hq-token.timer` (root, beim Start
und alle 30 min) erzeugt mit dem privaten Schlüssel ein **Installationstoken**: eine Stunde
gültig, nur für `H-Bakery/hq` (das Repo aus `HQ_REPO_URL`), nur Contents + Pull requests
schreiben (`GH_APP_PERMISSIONS`). Es landet atomar in `/etc/bakery/hq-token`; API (B5b, Z9),
`hq-sync.sh` und `install.sh` lesen die Datei **bei jeder Verwendung** neu. Fehlt sie oder ist
sie leer, verhält sich alles wie ohne Token: Produktänderungen bleiben als Commits auf der Box,
`GET /api/hq-sync/status` nennt den Grund (`token.problem`: `missing`, `empty`, …). Ein fester
`HQ_GITHUB_TOKEN` gewinnt weiterhin, wenn er gesetzt ist.

1. Die App muss auf GitHub für `H-Bakery/hq` installiert sein (Organisation → Settings → GitHub
   Apps) und dort mindestens _Contents_ und _Pull requests_ mit Schreibrecht haben.
2. Schlüssel nach `/etc/bakery/github-app.pem`, **root:root 0600** – nie für `bakery` lesbar,
   nie ins Backup (`backup.sh` lässt ihn aus):
   `sudo install -m 600 -o root -g root <pem-Datei> /etc/bakery/github-app.pem`
3. `ops.env`: `GH_APP_ID=<App-ID>`, `GH_APP_KEY=/etc/bakery/github-app.pem`.
4. `bakery.env`: `HQ_GITHUB_TOKEN_FILE=/etc/bakery/hq-token`, `HQ_GITHUB_TOKEN=` leer.
5. `sudo systemctl start bakery-hq-token.service && journalctl -u bakery-hq-token -n 5`
   („Token für H-Bakery/hq erneuert"), dann `sudo systemctl restart bakery-api`.

Das Token steht nie im Log. `install.sh --check` meldet das Alter der Datei (über 60 min =
abgelaufen), der Health-Check alarmiert ab 70 min (`HQ_TOKEN_MAX_AGE_MIN`).

Format beider Dateien: `KEY=wert`, ohne `export`, ohne Leerzeichen um `=`. Sie werden von
systemd **und** von bash gelesen.

`NEXT_PUBLIC_API_URL` und `NEXT_PUBLIC_PILOT_MODE` werden beim Build in die Web-App eingebacken.
Wer sie ändert, muss neu bauen: `sudo /opt/bakery/bin/deploy.sh --rebuild`. `NEXT_PUBLIC_API_URL`
bleibt im Normalfall **leer** (F4): die Verwaltung fragt `/api` auf der eigenen Origin, Caddy
schickt es an die API. `API_URL` liest die Verwaltung zur Laufzeit (kein Rebuild). Solange
`NEXT_PUBLIC_API_URL` oder `CORS_ORIGIN` noch `example.` aus der Vorlage enthalten, bricht
`deploy.sh` vor dem Build ab, und `install.sh --check` meldet es. Eine Domain braucht es dafür
nicht: im LAN-HTTP-Betrieb ist `CORS_ORIGIN=http://<IP der Box>`.

`HEALTH_TLS_HOST` in `ops.env` auf `intern.<domain>` setzen, sobald das Zertifikat da ist (§3.7;
im LAN-HTTP-Betrieb leer lassen):
dann prüft der Health-Check HTTPS über Caddy und meldet, wenn das Zertifikat in weniger als 14
Tagen abläuft – eine ausgefallene DNS-01-Erneuerung fällt so Wochen vor dem Ablauf auf.

Telegram: mit @BotFather einen eigenen Bot „Bäckerei Box" anlegen (nicht Annas Bot), dem Bot im
gewünschten Chat schreiben, die Chat-ID über `https://api.telegram.org/bot<TOKEN>/getUpdates`
ablesen.

**Bankverbindung für Rechnungen.** Die Ausgangsrechnungen (`/admin/rechnungen`,
[domains/rechnungen.md](domains/rechnungen.md)) drucken die Bankverbindung der Bäckerei und
schreiben sie in die ZUGFeRD-XML. Sie steht nicht im öffentlichen Repo, sondern in
`/etc/bakery/bakery.env`:

```bash
sudoedit /etc/bakery/bakery.env
#   INVOICE_IBAN="DE.. .... .... .... .... .."     Leerzeichen erlaubt, dann in Anführungszeichen
#   INVOICE_BIC=........
#   INVOICE_ACCOUNT_HOLDER="Vorname Nachname"
#   INVOICE_BANK_NAME="Name der Bank"              optional, nur Fußzeile
sudo systemctl restart bakery-api                  # kein Rebuild nötig
```

Eine Box, deren `bakery.env` älter ist als diese Funktion, hat die Zeilen noch nicht - von Hand
ergänzen (Vorlage: `deploy/bakery.env.example`). Prüfen: als Inhaber `/admin/rechnungen` öffnen und
einen Entwurf anlegen; fehlt etwas oder ist die IBAN falsch (Prüfziffer), steht dort
„Die Bankverbindung der Bäckerei ist auf der Box nicht eingerichtet …“ und „Ausstellen“ wird
abgelehnt. Die Tabellen `invoices` / `invoice_lines` legt die Migration beim ersten Start der API
nach dem Deploy an (wie jede Migration, §4). Die Rechnungen liegen in der SQLite-Datenbank und sind
damit im Backup (§5) - **auch die ausgestellten PDF-Dateien selbst** (Spalte `invoices.pdf` mit
SHA-256, etwa 40 kB je Rechnung): es gibt kein eigenes Verzeichnis, das zusätzlich gesichert werden
müsste. Ausgestellte Rechnungen werden **nicht** nach 90 Tagen anonymisiert (Aufbewahrung § 14b
UStG); liegengebliebene Entwürfe verlieren im nächtlichen Lauf Name und Anschrift.

- **Schriften:** das PDF braucht `apps/bakery-api/assets/fonts/LiberationSans-*.ttf` aus dem
  Release (kommen mit dem Repo, nichts zu installieren). Fehlen sie, steht beim Start der API
  `[WARN] Rechnungs-PDF: Schriften nicht gefunden …` im Journal
  (`journalctl -u bakery-api | grep Rechnungs-PDF`), der Entwurf zeigt einen roten Hinweis und
  „Ausstellen“ antwortet mit 503 `invoice_fonts_missing` - es wird nichts halb ausgestellt.
  Abhilfe: Release prüfen bzw. neu deployen; notfalls `INVOICE_FONTS_DIR` auf ein Verzeichnis mit
  beiden Dateien setzen.
- **Anmeldung:** Rechnungen gibt es nur mit Benutzername und Passwort, nicht mit der PIN am
  Laden-Tablet.
- **Rollback:** die Migration der Rechnungstabellen lässt sich nicht zurückrollen, solange es
  ausgestellte oder stornierte Rechnungen gibt (`down` bricht ab). Das ist Absicht. Nur mit
  gesicherter Datenbank und `INVOICES_ALLOW_DROP=1` wird trotzdem gelöscht. Ein Rollback des
  Releases (§4.1) braucht das nicht: ältere Releases lassen die Tabellen einfach unbenutzt.

### 3.7 Zertifikat (DNS-01, Q2)

**LAN-HTTP bis Q2 (Entscheidung 2026-11-08).** Bis das Zertifikat da ist, läuft Caddy mit
`Caddyfile.lan-http`: Port 80, jeder Hostname, dieselbe Weiterleitung (`/api/*` → 5000, sonst
→ 4201) und dieselben Sicherheits-Header, nur ohne TLS und ohne HSTS. Dafür in
`/etc/caddy/bakery.env` `BAKERY_LAN_HTTP=1` (Vorgabe der Vorlage), in `bakery.env`
`CORS_ORIGIN=http://<IP der Box>`, `HEALTH_TLS_HOST` leer. Die Geräte öffnen
`http://<IP der Box>` (feste IP, §3.2). Was dabei anders ist:

- Passwörter, PINs und Daten gehen unverschlüsselt durchs WLAN – geschützt nur durch das
  WLAN-Passwort. Port 80 deshalb nur aus dem LAN (§3.8), nie im Router freigeben.
- Die Verwaltung ist **keine installierbare App** (der Service Worker braucht HTTPS) und hat
  keine Offline-Seite; ein Lesezeichen auf dem Startbildschirm tut es.
- Das Sitzungs-Cookie geht ohne `Secure` raus (die App entscheidet das zur Laufzeit am Protokoll).

**Umstieg auf HTTPS** braucht keinen neuen Build und kein Deploy: Schritte unten ausführen,
in `/etc/caddy/bakery.env` `BAKERY_LAN_HTTP=0` setzen, dann

```bash
sudo /opt/bakery/bin/install.sh                  # installiert die HTTPS-Caddyfile (die alte wird gesichert)
sudo systemctl restart caddy
sudoedit /etc/bakery/bakery.env                  # CORS_ORIGIN=https://intern.<domain>
sudo systemctl restart bakery-api                # liest CORS_ORIGIN neu
sudoedit /etc/bakery/ops.env                     # HEALTH_TLS_HOST=intern.<domain>
```

Danach die Geräte auf `https://intern.<domain>` umstellen; dort wird die Verwaltung wieder
installierbar.

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
bis zur B0-Folgeaufgabe noch auf allen Schnittstellen, siehe §10). Die Verwaltung bindet über
den Namen `localhost` mit `node --dns-result-order=ipv4first` - nicht über `--hostname 127.0.0.1`,
sonst antwortet jede Seite, die die Sitzung prüfen muss, mit „Internal Server Error“ (Next hält die
Rewrites des Proxys dann für externe URLs). `ss -ltnp | grep 4201` muss `127.0.0.1:4201` zeigen.

```bash
sudo ufw default deny incoming
sudo ufw allow from 192.168.178.0/24 to any port 22,80,443 proto tcp   # LAN-Netz anpassen
sudo ufw allow in on tailscale0 to any port 22 proto tcp                # erst nach §7
sudo ufw enable
```

Im LAN-HTTP-Betrieb ist Port 80 der einzige Weg zur App: nur aus dem LAN-Netz freigeben (wie
oben), im Router **keine** Portweiterleitung. Caddy trennt Anfragen von außerhalb privater
Netze zusätzlich selbst (`@outside`). Auf `robot0` vorhandene Regeln der Agenten nicht
überschreiben – mit `sudo ufw status numbered` ansehen und nur ergänzen.

### 3.9 Erstes Deploy und Abnahme

```bash
sudo /opt/bakery/bin/deploy.sh main      # npm ci + Build dauern auf dem Pi ~10–15 min
sudo /opt/bakery/bin/install.sh --check  # prüft u. a. node -e "require('sqlite3')" im Release
```

Konten anlegen (B3; Liste der Mitarbeitenden: Q5). Die CLI läuft als `bakery` mit der Umgebung
der API, also gegen dieselbe `DB_PATH`; sie migriert bei Bedarf und braucht kein `JWT_SECRET`.
Das Passwort wird am Terminal zweimal verdeckt abgefragt, die PIN (4–6 Ziffern, optional) kommt
aus `CREATE_USER_PIN`:

```bash
sudo -u bakery bash -c 'set -a; . /etc/bakery/bakery.env; set +a; cd /opt/bakery/current &&
  node dist/apps/bakery-api/bundle/cli.js create-user \
    --username anna --display-name "Anna" --role verkauf'
# mit Stations-PIN:  ... set +a; export CREATE_USER_PIN=1234; cd ...
```

- Rollen: `inhaber`, `verkauf`, `backstube`, `backstubenleiter` (Backstubenleitung: wie
  `backstube`, dazu Rezepte anlegen und ändern), `fahrer`. Zuerst das Inhaber-Konto.
- Derselbe Befehl für ein vorhandenes Konto setzt Name, Rolle und Passwort neu, aktiviert es
  wieder und beendet alle seine Sitzungen (vergessenes Passwort, gesperrtes Konto). Es gibt kein
  Standardkonto; `BOOTSTRAP_ADMIN_*` wird in Produktion ignoriert.
- Danach in der App: Inhaber registriert Laden- und Backstube-Tablet als Station
  (`POST /api/auth/stations`, Oberfläche kommt mit F1) und setzt die PINs unter Benutzer.

Vorbestellungen aus dem Mock-Server übernehmen (B7, einmal vor dem Go-live 17.11.): die Datei
`apps/bakery-api/data/delivery-store.json` vom Entwicklungsrechner auf die Box kopieren, erst
einen Probelauf, dann den echten Lauf. Idempotent – ein zweiter Lauf überspringt alles schon
Importierte; Touren und Fahrer bleiben liegen (D11).

```bash
sudo -u bakery bash -c 'set -a; . /etc/bakery/bakery.env; set +a; cd /opt/bakery/current &&
  node dist/apps/bakery-api/bundle/cli.js import-preorders --file /tmp/delivery-store.json --dry-run'
# Bericht prüfen (imported / alreadyImported / skipped), dann ohne --dry-run; Datei danach löschen
```

Abnahme M0 (roadmap §6):

- [ ] `https://intern.<domain>` lädt auf Handy, Laden-Tablet, Backstube-Tablet und Büro-PC,
      Schloss-Symbol ohne Warnung (bis Q2: `http://<IP der Box>`, ohne Schloss)
- [ ] jede Person kann sich anmelden; das Laden-Tablet wechselt per PIN
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://intern.<domain>/api/preorders` → `401`
      (bis Q2 `http://<IP der Box>/api/preorders`)
- [ ] `install.sh --check`: GitHub-Token-Datei jünger als 60 min, `/api/hq-sync/status` ohne
      `reason`
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

Von wo aus man `deploy.sh` (oder ein anderes Skript aus `/opt/bakery/bin`) startet, ist egal: jedes
Skript wechselt beim Start nach `/`. Bis 12.11. brach ein Deploy aus `/home/<admin>` mit „DB-Kopie
vor dem Deploy fehlgeschlagen“ ab, weil `bakery` dieses Verzeichnis nicht betreten darf (`find:
Failed to restore initial working directory`) – die Kopie war da, nur das Aufräumen scheiterte.
Relative Pfade (`restore.sh --from-file`, `--target`) gelten weiter ab dem eigenen Verzeichnis.

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
   und restic-Passwort – sie öffnen das Backup selbst und gehören in den Passwort-Safe –, und
   ohne Schlüssel und Token der GitHub-App: das Token entsteht nach einem Restore neu),
   `BACKUP_EXTRA_PATHS` (Vorgabe: hq-Schreib-Klon mit evtl. noch nicht gepushten Commits)
4. `restic forget --keep-daily 14 --keep-weekly 8 --prune` (nicht bei `RESTIC_FORGET=0`),
   sonntags zusätzlich `restic check`
5. `backup/last-success` – der Health-Check meldet, wenn es älter als 36 h ist

**Solange das Off-site-Ziel fehlt (Q4, `RESTIC_REPOSITORY` in `ops.env` leer):** die Schritte 1–2
laufen jede Nacht, dann endet `bakery-backup.service` mit Exit 11 und steht in `systemctl
--failed` – das ist gewollt, das Log nennt Q4 und die lokale Kopie. Der Health-Check prüft
währenddessen `backup/current/bakery.db` (jünger als 36 h) und führt das Backup als „OFFEN“ (§8.1).
Die Daten liegen dann nur auf der Box selbst.

Nicht gesichert, weil reproduzierbar: Code (`/opt/bakery`), hq-Lese-Klon (liegt auf GitHub).

**Anonymisierung (P4, DSGVO).** Jede Nacht um 23:45 (`bakery-anonymize.timer`) setzt
`cli.js anonymize-preorders` bei **jeder** Vorbestellung, deren Abholtag mehr als 90 Tage
zurückliegt – egal in welchem Status –, den Namen auf `anonymisiert` und löscht Telefon und
Anmerkung; Positionen und Summen bleiben. Im selben Lauf (seit B8) verlieren Lieferstopps, deren
Tourtag mehr als 90 Tage zurückliegt, Name, Telefon, Hinweis, Straße und Koordinaten (Bericht
`deliveryStops`). Der Bericht zählt unter `unfinished`, wie viele davon nie
abgeschlossen waren (offen/bereit) – wächst die Zahl, werden Übergaben nicht abgehakt. Der Lauf
**migriert nie**: stehen nach einem Deploy Migrationen aus (API-Neustart fehlgeschlagen), bricht er
mit Exit 1 ab und nennt sie – dann zuerst die API in Ordnung bringen (§4). Von Hand:
`sudo systemctl start bakery-anonymize && journalctl -u bakery-anonymize -n 50` (Probelauf:
`cli.js anonymize-preorders --dry-run`). Die Backups enthalten die Namen noch bis zu ihrem Ablauf
(`--keep-weekly 8`, also höchstens etwa 8 Wochen länger).

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
| 3    | `fetch` fehlgeschlagen                                                  | Internet? Token abgelaufen (App-Token: `journalctl -u bakery-hq-token`, sonst `HQ_GITHUB_TOKEN`, Q3)? App läuft mit altem Stand weiter                                                          |
| 4    | lokale Commits im Lese-Klon                                             | Jemand hat hineingeschrieben. Commits ansehen (`git -C … log origin/main..HEAD`), nötigenfalls im Schreib-Klon nachziehen, dann `sudo -u bakery env HQ_SYNC_FORCE=1 /opt/bakery/bin/hq-sync.sh` |
| 5    | reset/clean fehlgeschlagen                                              | Platte voll? Rechte (`chown -R bakery: /var/lib/bakery/hq`)?                                                                                                                                    |

Der Health-Check meldet, wenn der letzte erfolgreiche Sync älter als 90 Minuten ist.

**GitHub-Token (Q3).** `hq-sync.sh` liest das Token bei jedem Lauf frisch aus
`HQ_GITHUB_TOKEN_FILE` (fehlt die Datei: WARNUNG, Versuch ohne Token). Erneuert wird es von
`bakery-hq-token.timer` (§3.6):

```bash
sudo systemctl start bakery-hq-token.service && journalctl -u bakery-hq-token -n 10
sudo ls -l --time-style=+%H:%M /etc/bakery/hq-token   # root bakery, 0640, höchstens 30 min alt
```

| Exit (`hq-token.sh`) | Bedeutung                                                         | Abhilfe                                                                            |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 0                    | erneuert (oder `GH_APP_ID` leer: nichts zu tun)                   | –                                                                                  |
| 2                    | Schlüssel fehlt oder zu offen, App-ID passt nicht, Uhr falsch     | §3.6; `chown root:root` + `chmod 600`; `timedatectl` (JWT ist nur 10 min gültig)   |
| 3                    | GitHub nicht erreichbar / Fehler – die alte Datei bleibt (60 min) | Internet? Wiederholt sich alle 30 min                                              |
| 4                    | App für hq nicht installiert oder Rechte fehlen                   | GitHub → Organisation → GitHub Apps: hq freigeben, Contents + Pull requests: write |
| 5                    | `/etc/bakery/hq-token` nicht schreibbar                           | Platte voll? Rechte von `/etc/bakery`?                                             |

### 6.1 Schreiben nach hq (B5b, Z9)

Die API schreibt an zwei Stellen, beide im **Schreib-Klon**, nie im Lese-Klon (roadmap §4a):

| Was                                             | Worktree                                            | Branch      | Wie es in hq landet                                                                                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Produktänderungen (Verwaltung → Produkte)       | `HQ_WRITE_DIR` (`/var/lib/bakery/hq-write`)         | `app/edits` | Commit als „Verwaltung (App)“ + `Co-authored-by`, Rebase auf `origin/main`, `push --force-with-lease`, **eine** offene PR „Stammdaten aus der Verwaltung“; H2 mergt sie bei grüner Prüfung |
| Freigegebener Backzettel, Vorbestellungs-Summen | `HQ_SNAPSHOT_DIR` (`/var/lib/bakery/hq-write-main`) | `main`      | Commit nur von `data/production/**`, Push direkt nach `main`; abgelehnt → `pull --rebase` + ein zweiter Versuch                                                                            |

- Push und PR laufen nach jedem Speichern und **alle 15 Minuten** (`HQ_SYNC_RETRY_MS`); ohne
  Internet bleiben die Commits auf der Box und gehen beim nächsten Versuch raus. Nichts geht
  verloren, solange niemand die Klone löscht.
- Snapshots: beim Freigeben des Backzettels `data/production/backzettel/<Tag>.json` + `.md`
  (Mengen, Hefeteig-Wiegeliste, Füllungen, Vorbereitung; „Freigegeben (Backstube)“ – **nie ein
  Name**), jede Nacht 22:15 `data/production/vorbestellungen/<Tag>.json` (Summen je Produkt/Sorte,
  Zahl je Kanal und Sammelstelle – keine Kundendaten).
- Ohne Token (fehlende oder leere `HQ_GITHUB_TOKEN_FILE`, kein `HQ_GITHUB_TOKEN`) ist die
  PR-Übertragung aus (Produktänderungen bleiben lokale Commits); ohne `HQ_SNAPSHOT_DIR` gibt es
  keine Snapshots. Der Status sagt beides – `token` nennt Quelle, Datei, Stand und Problem, nie
  das Token. Kommt das Token später (Timer), geht es beim nächsten Versuch von selbst weiter.

Status (als Inhaber angemeldet; in der Oberfläche folgt er mit F4):

```bash
curl -s -H "Authorization: Bearer <token>" https://intern.<domain>/api/hq-sync/status
# pendingCommits  noch nicht auf GitHub   unmergedCommits  wartet auf Freigabe (PR offen)
# lastError.code  network | push_rejected | rebase_conflict | github_failed | wrong_branch | …
# snapshots.*     dasselbe für data/production/**
curl -s -X POST -H "Authorization: Bearer <token>" https://intern.<domain>/api/hq-sync/retry   # sofort statt in 15 min
```

Von Hand:

```bash
sudo systemctl start bakery-snapshot-preorders.service && journalctl -u bakery-snapshot-preorders -n 20
# einen verpassten Tag nachholen (Box war um 22:15 und bis Mitternacht aus):
sudo -u bakery bash -c 'set -a; . /etc/bakery/bakery.env; set +a; cd /opt/bakery/current &&
  node dist/apps/bakery-api/bundle/cli.js snapshot-preorders --date 2026-11-28'
sudo -u bakery git -C /var/lib/bakery/hq-write log --oneline origin/main..app/edits   # wartet auf Freigabe
sudo -u bakery git -C /var/lib/bakery/hq-write-main log --oneline origin/main..main   # Snapshots noch nicht oben
```

| `lastError.code`                 | Bedeutung                                                                                                     | Abhilfe                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `network`                        | GitHub nicht erreichbar oder Token ungültig                                                                   | Internet? Token (Q3, `journalctl -u bakery-hq-token`)? Wiederholt sich selbst                                                                                                                 |
| `push_rejected`                  | jemand hat parallel geschrieben, auch der zweite Versuch scheiterte                                           | wiederholt sich selbst; bleibt es, Log ansehen                                                                                                                                                |
| `rebase_conflict` (`files`)      | dieselbe Datei wurde in hq anders geändert                                                                    | Commits bleiben auf der Box. In `files` nachsehen, Konflikt im Schreib-Klon von Hand auflösen (`git rebase origin/main`, Dateien richten, `git rebase --continue`), dann `/api/hq-sync/retry` |
| `github_failed`                  | Push ok, PR ließ sich nicht anlegen                                                                           | wiederholt sich selbst; Token braucht „Pull requests: write“                                                                                                                                  |
| `wrong_branch`, `worktree_dirty` | jemand hat im Schreib-Klon gearbeitet                                                                         | `git status` im betroffenen Worktree, auf `app/edits` bzw. `main` zurück, nichts verwerfen ohne Rücksprache                                                                                   |
| `foreign_conflict` (`files`)     | auf `app/edits` liegt ein Commit von Hand (nicht aus der App), der sich nicht mit den App-Änderungen verträgt | Nichts wird überschrieben, nichts gepusht. Im Schreib-Klon `git cherry-pick <commit>` von Hand auflösen oder den fremden Commit in die PR auf GitHub übernehmen, dann `/api/hq-sync/retry`    |
| `repo_locked`                    | ein anderer Vorgang (Server/CLI) hielt das Verzeichnis zu lange                                               | wiederholt sich selbst; ein Snapshot ist dann schon lokal committet                                                                                                                           |

Eine PR, die jemand **ohne Merge schließt**, öffnet die App beim nächsten Speichern neu – die
Commits liegen ja weiter auf `app/edits`. Änderungen wirklich verwerfen: im Schreib-Klon
`git reset --hard origin/main` auf `app/edits` (vorher `git log origin/main..` ansehen), dann
`git push --force-with-lease origin app/edits`.

Ein **Squash-Merge** der PR wird am Inhalt erkannt (die Dateien der App stehen gleich auf `main`),
auch wenn `main` inzwischen weitergelaufen ist; spätere Änderungen werden neu aufgesetzt. Trotzdem
lieber mit Merge-Commit mergen (H2). Wer auf `app/edits` von Hand einen Commit pusht (z. B. um die
Prüfung grün zu machen), dem überschreibt die App ihn nicht: sie übernimmt ihn per Cherry-Pick
(Merge-Commits aus der GitHub-Oberfläche nicht – Konfliktlösungen dort gehen verloren).

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

**Drei Zustände je Prüfung.** `ok`, `GESTÖRT` (Telegram „STÖRUNG“, der Lauf endet mit Exit 1, die
Unit steht in `systemctl --failed`) und `OFFEN`: die Box läuft, aber etwas ist noch nicht
eingerichtet – das Off-site-Ziel des Backups (Q4) oder der Alarmkanal selbst (`TELEGRAM_BOT_TOKEN`
/ `TELEGRAM_CHAT_ID` in `ops.env` leer; Prüfung „Alarmkanal“, läuft immer mit). `OFFEN` wird einmal
gemeldet („NICHT EINGERICHTET“, ohne Telegram nur im Journal), steht bei jedem Lauf als eine Zeile
im Log und macht die Unit nicht rot. Eine rote `bakery-health.service` heißt damit immer: jetzt
ist etwas gestört. Bis 12.11. war sie wegen des fehlenden Off-site-Ziels bei jedem Lauf rot.
Sobald Telegram eingetragen ist, kommt beim nächsten Lauf „WIEDER OK … Alarmkanal (jetzt
eingerichtet)“ – das ist zugleich der Test des Kanals.

Testalarm: `sudo systemctl stop bakery-management`, bis zu 5 Minuten warten → Telegram „STÖRUNG",
`sudo systemctl start bakery-management` → „WIEDER OK". Gemeldet wird nur der Wechsel, nicht jede
Minute der Störung.

### 8.2 Was tun bei …

| Symptom                                               | Prüfen                                                                         | Abhilfe                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Alarm „API": Seiten laden, aber Daten fehlen / Fehler | `journalctl -u bakery-api -n 100`                                              | Absturzschleife nach Deploy → `deploy.sh --rollback`; DB gesperrt/kaputt → §5.4         |
| Alarm „Verwaltung": Seite lädt nicht                  | `journalctl -u bakery-management -n 100`                                       | `systemctl restart bakery-management`; nach Deploy → `--rollback`                       |
| Seite lädt auf keinem Gerät, Box läuft                | `systemctl status caddy`, vom Handy `https://intern.<domain>`                  | Zertifikat (`journalctl -u caddy`), DNS-Rebind-Ausnahme (§3.2), feste IP geändert?      |
| LAN-HTTP: `http://<IP der Box>` lädt nicht            | `sudo ss -ltnp \| grep ':80 '`, `sudo ufw status`                              | Caddyfile passend? `install.sh --check` nennt den Modus; Port 80 belegt oder gesperrt   |
| Alarm „GitHub-Token (hq)"                             | `journalctl -u bakery-hq-token -n 20`                                          | Exit-Codes §6; die App läuft weiter, nur hq-Abgleich und PRs warten                     |
| Browser warnt vor dem Zertifikat / Alarm „HTTPS"      | `journalctl -u caddy -g acme`                                                  | DNS-Token abgelaufen/geändert (Q2) → `/etc/caddy/bakery.env`, `systemctl restart caddy` |
| Box antwortet gar nicht (kein Ping, kein SSH)         | Strom, Kabel, LED                                                              | Stromstecker ziehen und wieder einstecken; Papier-Fallback; Entwickler anrufen          |
| Alarm „Backup"                                        | `journalctl -u bakery-backup -n 50`                                            | Exit 10–13 siehe `backup.sh`; Ziel/Netz prüfen; `systemctl start bakery-backup`         |
| Alarm „hq-Sync"                                       | `journalctl -u bakery-hq-sync -n 20`                                           | §6; die App läuft mit dem letzten Stand weiter, kein Notfall                            |
| Anonymisierung lief nicht / `unfinished` wächst       | `journalctl -u bakery-anonymize -n 50`                                         | ausstehende Migration → API neu starten; dann `systemctl start bakery-anonymize`        |
| Produkt „wartet auf Freigabe“ seit Stunden            | `/api/hq-sync/status` (§6.1)                                                   | `lastError`? PR offen, aber H2-Prüfung rot → PR auf GitHub ansehen                      |
| Backzettel/Vorbestellungen fehlen in hq               | `/api/hq-sync/status` → `snapshots`, `journalctl -u bakery-snapshot-preorders` | §6.1; offline wird alle 15 min nachgeschoben                                            |
| Alarm „Speicherplatz"                                 | `df -h /var/lib/bakery`, `du -sh /opt/bakery/releases/*`                       | `KEEP_RELEASES` senken, `journalctl --vacuum-time=14d`, alte `backup/snapshots` löschen |
| Produkte/Preise geändert, App zeigt alten Stand       | `cat /var/lib/bakery/state/hq-sync.ok`                                         | Änderung schon in hq `main` gemerged? Sonst „wartet auf Freigabe" (D6); Sync von Hand   |
| Health-Log „OFFEN“ / Meldung „NICHT EINGERICHTET“     | `journalctl -u bakery-health -n 20`                                            | kein Ausfall: Q4 bzw. Telegram in `ops.env` eintragen (§8.1); die Unit bleibt grün      |
| Kein Telegram trotz Störung                           | `journalctl -u bakery-health -n 20`                                            | Token/Chat-ID in `ops.env`; Telegram-Fehler werden beim nächsten Lauf erneut gesendet   |

## 9. Papierbetrieb (Papier-Fallback)

**Regel:** blockiert die App die Arbeit länger als **10 Minuten**, wird auf Papier umgestellt.
Das entscheidet, wer gerade im Laden bzw. in der Backstube steht (§2), ohne Rückfrage; danach
den Inhaber anrufen, der die Technik anruft.

Alle Vordrucke kommen aus der App: **Menü › Hilfe › Papierbetrieb** (`/admin/hilfe`, jede
Rolle, je Blatt eine A4-Seite). Einweisung und Go-live-Checkliste fürs Personal:
[onboarding.md](onboarding.md).

Liegt ausgedruckt im Laden und in der Backstube (P6):

- **Aushang „Papierbetrieb – wann und wie"** in Laden und Backstube, Name und Telefon von
  Inhaber und Technik von Hand eingetragen (nicht in der App, das Repo ist öffentlich).
- **Vorbestellungen:** Vorbestellschein (2 oder 4 pro Seite) an der Theke. Ausgefüllte Scheine
  in einem Fach sammeln. Nachtragen, sobald die App wieder läuft: neue Vorbestellung mit den
  Angaben vom Schein, in der Notiz „Papier, angenommen am …" (tatsächliches Annahmedatum), den
  neuen Code auf den Schein schreiben und „in App übertragen" ankreuzen. Schon übergeben/bezahlt
  → in der Abholliste mit abhaken. Scheine tragen Namen und Telefonnummern: vernichten, sobald
  übertragen und abgeholt; nie fotografieren, nie nach `hq`.
- **Backzettel:** der zuletzt freigegebene Backzettel ist als A4 ausgedruckt (Z7). Für den
  nächsten Tag: den Ausdruck vom gleichen Wochentag mit Hand korrigieren. Ist keiner da: das
  **Backzettel-Notfallblatt** (Posten aus den Stammdaten, Basis / Vorbestellt / Gesamt leer).
  Wenn die App wieder geht: den Tag in der App prüfen und freigeben.
- **Abholliste:** jeden Nachmittag die Abholliste des nächsten Tages ausdrucken (P2), damit sie
  bei einem Ausfall am Morgen vorliegt.

Vordrucke nachdrucken, wenn der Stapel unter zehn Scheine fällt. Nach einer Änderung an
Stammdaten (neue Posten) das Notfallblatt neu drucken.

## 10. Offene Punkte

- **Q1** Hardware (vorläufig `robot0`, §3.1), **Q2** feste IP + DNS-Weg (§3.7; bis dahin
  LAN-HTTP), **Q4** Backup-Ziel, **Q8** Tailscale – ohne sie bleibt O1/O2/O4 Vorbereitung.
  **Q3** ist entschieden (2026-11-08): GitHub-App statt PAT (§3.6).
- **B0 (erledigt, `pilot` 2026-11-05):** `bakery-api:bundle` schreibt
  `dist/apps/bakery-api/bundle/main.js`, `DB_PATH` ist in Produktion Pflicht, `HOST` geht an
  `listen()`, das Bundle loggt nur nach stdout. `deploy/bakery.env.example` ist mit
  `apps/bakery-api/src/config/env.ts` abgeglichen.
- **B3 (erledigt, `feat/B3-auth`):** `create-user`-CLI-Befehl steht in §3.9; `TRUST_PROXY`
  (Vorgabe `loopback`) in `deploy/bakery.env.example` dokumentiert.
- **B5b/Z9 (`feat/B5b-Z9-hq-writeback`):** `install.sh` legt jetzt auch Schreib-Klon und
  Snapshot-Worktree an (§3.5, §6.1) – auf der Box noch nicht ausprobiert. Vor dem ersten Push:
  H1 muss gemergt sein (die Pipeline committet sonst ohne Pfadangabe und scheitert an unseren
  Pushes nach `main`), und H2 für das Automerge der PR.
- Die Caddyfiles sind ohne Caddy-Binary geschrieben und nicht maschinell geprüft (die Tests
  vergleichen nur den gemeinsamen Block); auf der Box nach dem Ausfüllen von
  `/etc/caddy/bakery.env` prüfen:
  `sudo bash -c 'set -a; . /etc/caddy/bakery.env; caddy validate --config /etc/caddy/Caddyfile'`.
- Die systemd-Units sind ohne systemd geschrieben; auf der Box
  `systemd-analyze verify /etc/systemd/system/bakery-*` und
  `systemd-analyze security bakery-api` laufen lassen.
