# Fernzugriff für die Fahrer-App (B8, Frage Q8)

Stand: 06.11.2026. Entwurf zur Entscheidung durch den Inhaber - **nichts davon ist umgesetzt**.

## Worum es geht

Seit B8 läuft die Fahrer-App (`apps/bakery-delivery`) gegen die echte API auf der Bäckerei-Box,
mit persönlicher Anmeldung (Rolle `fahrer`, Passwort, Refresh-Token mit Rotation). Die Box steht
im LAN der Bäckerei und ist nur dort erreichbar (Caddy, LAN-HTTPS über DNS-01, siehe
`docs/runbook.md`). Der Fahrer ist samstags aber **unterwegs**: im Mobilfunknetz, nicht im WLAN
der Bäckerei. Ohne Fernzugriff sieht er seine Tour nur, solange die Offline-Kopie reicht, und
sein Abhaken landet in der Warteschlange, bis er zurück ist - die Backstube sieht den
Fortschritt dann erst nachmittags.

Zwei Wege, die Box von außen erreichbar zu machen:

## Weg A: Tailscale auf den Diensthandys

Die Box und die Handys der Fahrer kommen in ein gemeinsames privates Netz (Tailscale, WireGuard
darunter). Die App ruft die Box unter ihrem Tailnet-Namen auf; ins Internet wird nichts geöffnet.

- **Angriffsfläche:** keine öffentliche. Wer kein Gerät im Tailnet hat, sieht die Box nicht.
  Anmeldung und Rollen der API gelten zusätzlich.
- **Einrichtung:** Tailscale-App auf jedem Fahrerhandy, einmal mit dem Bäckerei-Konto anmelden;
  auf der Box ein `tailscaled`. ACL: Fahrergeräte dürfen nur Port 443 der Box.
- **Alltag:** Die Tailscale-App muss auf dem Handy laufen (VPN-Symbol). Vergisst ein Fahrer sie,
  fühlt es sich an wie ein Funkloch - die App arbeitet weiter mit Offline-Kopie und Warteschlange.
- **Private Handys:** heikel. Ein VPN-Profil auf dem Privathandy einer Aushilfe ist mehr verlangt
  als ein Lesezeichen; beim Ausscheiden muss das Gerät aus dem Tailnet entfernt werden.
- **Kosten:** Der kostenlose Tarif reicht für eine Handvoll Geräte; Konto bei einem US-Anbieter
  (nur Koordination - die Nutzdaten laufen Ende-zu-Ende verschlüsselt direkt oder über Relais).
- **HTTPS:** Das vorhandene Zertifikat der Box (DNS-01) gilt für ihren LAN-Namen; für den
  Tailnet-Namen braucht es entweder einen DNS-Eintrag auf die Tailnet-Adresse oder
  `tailscale cert`.

## Weg B: ein schmaler öffentlicher Endpunkt

Ein Teil der API wird über einen Tunnel (z. B. Cloudflare Tunnel, kein offener Router-Port) oder
einen kleinen Reverse-Proxy im Netz erreichbar gemacht - **nur** das, was die Fahrer-App braucht:

- `POST /api/auth/login`, `/refresh`, `/logout`, `GET /api/auth/me`
- `/api/deliveries/*` (Touren, Stopps, Position, Übergabe an der Sammelstelle)
- die statische Fahrer-App selbst

Alles andere (Finanzen, Berichte, Benutzerverwaltung, Backzettel, hq-Schreibwege) bleibt im LAN;
Caddy bzw. der Tunnel lässt es gar nicht erst durch.

- **Angriffsfläche:** öffentlich, aber klein. Gegen Passwort-Raten gibt es das Login-Limit der
  API (5 Fehlversuche je IP + Konto, 30 je IP in 5 min, B3). Dazu käme ein Limit am Proxy und
  ein Monitoring der `login_failed`-Zeilen im `audit_log`.
- **Einrichtung:** Tunnel-Dienst auf der Box, eine öffentliche Subdomain, Pfad-Whitelist in Caddy.
  Kein VPN auf den Handys - ein Lesezeichen bzw. die installierte App genügt.
- **Alltag:** funktioniert auf jedem Handy ohne Zusatz-App; auch für eine kurzfristige Aushilfe.
- **Risiko:** Ein Fehler in der Pfad-Whitelist oder ein Bug in einer freigegebenen Route ist
  vom Internet aus erreichbar. Die Tourdaten enthalten Namen, Adressen und Telefonnummern der
  Kundschaft (Art. 32 DSGVO: Stand der Technik). Ein abgefangenes Passwort genügt für den Zugriff
  auf die eigenen Touren dieses Fahrers (die API zeigt einem Fahrer nur seine).
- **Abhängigkeit:** Tunnelanbieter (bei Cloudflare ebenfalls ein US-Anbieter, der TLS terminiert -
  er sieht die Daten im Klartext). Ein eigener Proxy auf einem gemieteten Server vermeidet das,
  ist aber ein weiteres System zum Pflegen.

## Vergleich

|                               | A: Tailscale                | B: schmaler Endpunkt                |
| ----------------------------- | --------------------------- | ----------------------------------- |
| Öffentlich erreichbar         | nein                        | ja, nur Login + Liefer-Routen       |
| Auf dem Handy nötig           | Tailscale-App, angemeldet   | nichts                              |
| Neue Aushilfe                 | Gerät ins Tailnet aufnehmen | Konto anlegen genügt                |
| Wer sieht die Daten unterwegs | niemand (Ende-zu-Ende)      | Tunnelanbieter (TLS-Terminierung)   |
| Pflege                        | Geräteliste                 | Pfad-Whitelist, Limits, Beobachtung |
| Ausfallbild                   | VPN aus = wie Funkloch      | Tunnel weg = wie Funkloch           |

## Empfehlung

**Weg A, Tailscale**, solange die Fahrer feste Diensthandys (oder einwilligende eigene Geräte)
haben - das sind heute ein bis zwei Personen am Samstag. Es öffnet nichts ins Internet, die
Kundendaten verlassen die verschlüsselte Verbindung nirgends, und der Mehraufwand ist einmalig.
Die App ist für den Fall „VPN aus" schon gebaut: Offline-Kopie und Warteschlange (siehe
`apps/bakery-delivery/CLAUDE.md`, „Offline").

Weg B lohnt sich erst, wenn wechselnde Aushilfen fahren oder Kundschaft selbst etwas sehen soll
(Sendungsverfolgung). Dann vorher: eigene Subdomain, Pfad-Whitelist mit Test, Proxy-Limit, und
eine Benachrichtigung bei gehäuften `login_failed`.

## Was der Inhaber entscheiden muss (Q8)

1. Tailscale (A) oder öffentlicher Endpunkt (B)?
2. Diensthandys oder private Geräte der Fahrer?
3. Bei B: welcher Tunnel bzw. Proxy, und wer beobachtet die Fehlversuche?

Bis zur Entscheidung bleibt die Fahrer-App LAN-only; unterwegs arbeitet sie mit der
Offline-Kopie und sendet nach.
