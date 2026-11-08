# deploy/

Betrieb der Bäckerei-Box (roadmap.md D4, O1–O4): systemd-Units, Caddy, Umgebungsvorlagen und
die Skripte für Einrichtung, Deploy, hq-Sync, Backup/Restore und Health-Check.

Bedienung, Inbetriebnahme und Störungen: [docs/runbook.md](../docs/runbook.md).

Stand 2026-11-08 (Entscheidungen des Inhabers):

- **Vorläufig auf dem Agenten-Pi `robot0`** (Pi 5, 4 GB, Debian 13), eine eigene Box folgt (Q1).
- **GitHub-App statt PAT (Q3):** `scripts/hq-token.sh` (root, `bakery-hq-token.timer`, alle
  30 min) erzeugt mit `scripts/gh-app-token.mjs` (nur Node-Bordmittel) aus App-ID und privatem
  Schlüssel (`/etc/bakery/github-app.pem`, root:root 0600) ein Installationstoken für hq, 1 h
  gültig, nur Contents + Pull requests. Es liegt in `/etc/bakery/hq-token` (root:bakery 0640);
  API, `hq-sync.sh` und `install.sh` lesen `HQ_GITHUB_TOKEN_FILE` bei jeder Verwendung, ein fester
  `HQ_GITHUB_TOKEN` gewinnt. Runbook §3.6, §6.
- **LAN-HTTP bis zum Zertifikat (Q2):** `caddy/Caddyfile.lan-http` (Port 80, gleiche Weiterleitung
  und Header wie `caddy/Caddyfile`, ohne TLS und HSTS) installiert `install.sh`, solange in
  `/etc/caddy/bakery.env` `BAKERY_LAN_HTTP=1` steht oder die Domain der Platzhalter ist. Der
  Wechsel auf HTTPS braucht keinen neuen Build. Runbook §3.7, §3.8.

Lokal testen (macOS/Linux, ohne root, ohne systemd, ohne Netz; Ports 5120–5124; GitHub ist
die Attrappe `tests/fake_github_app.mjs`):

```bash
deploy/tests/run-tests.sh
```

Das ältere Verzeichnis `deployment/` (nginx, PM2, Prometheus) gehört zur abgelösten
Cloud-Planung (docs/deployment.md) und wird für den Pilot nicht benutzt.
