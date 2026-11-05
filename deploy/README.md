# deploy/

Betrieb der Bäckerei-Box (roadmap.md D4, O1–O4): systemd-Units, Caddy, Umgebungsvorlagen und
die Skripte für Einrichtung, Deploy, hq-Sync, Backup/Restore und Health-Check.

Bedienung, Inbetriebnahme und Störungen: [docs/runbook.md](../docs/runbook.md).

Lokal testen (macOS/Linux, ohne root, ohne systemd; Ports 5120–5124):

```bash
deploy/tests/run-tests.sh
```

Das ältere Verzeichnis `deployment/` (nginx, PM2, Prometheus) gehört zur abgelösten
Cloud-Planung (docs/deployment.md) und wird für den Pilot nicht benutzt.
