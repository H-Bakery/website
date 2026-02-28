# Kassenverwaltung - Benutzerhandbuch

## Übersicht

Die Kassenverwaltung ermöglicht es Ihnen, tägliche Kassenbestände zu erfassen, zu verwalten und auszuwerten. Das System bietet umfassende Funktionen zur Verwaltung Ihrer Tageseinnahmen mit detaillierten Übersichten und Exportmöglichkeiten.

## Zugriff auf die Kassenverwaltung

1. Melden Sie sich in Ihrem Admin-Bereich an
2. Navigieren Sie zu **Admin** → **Kassenverwaltung**
3. Sie sehen eine Übersicht mit drei Hauptbereichen:
   - **Heute**: Aktueller Tagesstand
   - **Dieser Monat**: Monatssumme
   - **Einträge**: Gesamtanzahl erfasster Einträge

## Funktionen im Überblick

### 1. Kassenstand eingeben

So erfassen Sie einen neuen Kassenstand:

1. Klicken Sie auf den Tab **"Kassenstand eingeben"**
2. Geben Sie den Gesamtbetrag der Tageseinnahmen ein
3. Das aktuelle Datum wird automatisch verwendet
4. Klicken Sie auf **"Kassenstand speichern"**

**Hinweise:**

- Der Betrag muss größer als 0 sein
- Verwenden Sie Punkt als Dezimaltrennzeichen (z.B. 425.75)
- Das System zeigt eine Bestätigung nach dem Speichern

**Eingabevalidierung:**

- ✅ Gültig: 425.75, 1000.00, 50.5
- ❌ Ungültig: -100, abc, 0

### 2. Kassenverlauf anzeigen

Der Kassenverlauf zeigt alle Ihre erfassten Einträge:

**Hauptfunktionen:**

- **Sortierung**: Klicken Sie auf Spaltenüberschriften zum Sortieren
- **Suche**: Verwenden Sie das Suchfeld für Beträge oder Daten
- **Datumsfilter**: Filtern Sie nach Zeiträumen
- **Trend-Anzeige**: Pfeile zeigen Veränderungen zum Vortag

**Suchfunktionen:**

- Suche nach Betrag: "425" findet alle Einträge mit 425€
- Suche nach Datum: "2024-06-10" findet Einträge vom 10.06.2024
- Datumsbereich: Verwenden Sie "Von Datum" und "Bis Datum" Filter

**Statistiken:**

- **Gesamtsumme**: Summe aller gefilterten Einträge
- **Durchschnitt pro Tag**: Durchschnittlicher Tagesumsatz
- **Einträge gefiltert**: Anzahl der angezeigten Einträge

### 3. Einträge bearbeiten

So bearbeiten Sie einen bestehenden Eintrag:

1. Finden Sie den gewünschten Eintrag im Kassenverlauf
2. Klicken Sie auf das **Bearbeiten-Symbol** (Stift)
3. Ändern Sie Betrag und/oder Datum nach Bedarf
4. Klicken Sie auf **"Änderungen speichern"**

**Bearbeitungsregeln:**

- Nur Ihre eigenen Einträge können bearbeitet werden
- Das Datum darf nicht in der Zukunft liegen
- Der Betrag muss positiv sein
- Änderungen werden sofort gespeichert

**Validierung beim Bearbeiten:**

- Das System prüft automatisch die Eingaben
- Fehlermeldungen werden in deutscher Sprache angezeigt
- Der Speichern-Button ist nur aktiv, wenn Änderungen vorgenommen wurden

### 4. Einträge löschen

So löschen Sie einen Eintrag:

1. Finden Sie den gewünschten Eintrag im Kassenverlauf
2. Klicken Sie auf das **Löschen-Symbol** (Papierkorb)
3. Bestätigen Sie die Löschung im Dialogfenster
4. Klicken Sie auf **"Endgültig löschen"**

**⚠️ Wichtige Hinweise zum Löschen:**

- **Unwiderruflich**: Gelöschte Einträge können nicht wiederhergestellt werden
- **Nur eigene Einträge**: Sie können nur Ihre eigenen Einträge löschen
- **Bestätigung erforderlich**: Sicherheitsabfrage verhindert versehentliches Löschen
- **Alternative**: Bearbeiten Sie den Eintrag statt ihn zu löschen

### 5. Daten exportieren

So exportieren Sie Ihre Kassendaten:

1. Filtern Sie die gewünschten Daten (optional)
2. Klicken Sie auf das **Export-Symbol** (Download)
3. Die CSV-Datei wird automatisch heruntergeladen

**Export-Details:**

- **Dateiformat**: CSV (Excel-kompatibel)
- **Dateiname**: kassenstand_JJJJ-MM-TT.csv
- **Inhalt**: Datum, Betrag, Erfassungszeit
- **Sprache**: Deutsche Spaltenüberschriften

**CSV-Spalten:**

- Datum: Datum des Kassenstands
- Betrag (EUR): Betrag in Euro
- Erfasst am: Zeitpunkt der Erfassung

### 6. Monatsübersicht

Die Monatsübersicht bietet detaillierte Auswertungen:

**Verfügbare Ansichten:**

- **Kalenderview**: Visuelle Darstellung der Tagesumsätze
- **Diagramme**: Grafische Auswertung der Entwicklung
- **Zusammenfassung**: Statistische Kennzahlen

**Auswertungen:**

- Höchster/Niedrigster Tagesumsatz
- Durchschnittsumsatz pro Tag
- Gesamtumsatz des Monats
- Anzahl Verkaufstage

## Tipps für die tägliche Nutzung

### Arbeitsroutine

1. **Tagesabschluss**: Erfassen Sie den Kassenstand jeden Abend
2. **Kontrolle**: Überprüfen Sie die Einträge regelmäßig auf Vollständigkeit
3. **Export**: Erstellen Sie monatliche Backups Ihrer Daten
4. **Analyse**: Nutzen Sie die Übersichten zur Umsatzanalyse

### Fehlerbehandlung

- **Bei Eingabefehlern**: Bearbeiten Sie den Eintrag statt ihn zu löschen
- **Bei Verbindungsproblemen**: Das System speichert Ihre Daten automatisch
- **Bei Fehlermeldungen**: Kontaktieren Sie den Administrator

### Datensicherheit

- **Automatische Speicherung**: Alle Daten werden sofort gespeichert
- **Benutzertrennung**: Jeder Benutzer sieht nur seine eigenen Daten
- **Backup**: Nutzen Sie die Export-Funktion für regelmäßige Sicherungen

## Fehlerbehebung

### Häufige Probleme und Lösungen

**Problem: "Authentifizierung fehlgeschlagen"**

- **Lösung**: Melden Sie sich erneut an
- **Ursache**: Sitzung ist abgelaufen

**Problem: "Betrag ungültig"**

- **Lösung**: Verwenden Sie nur Zahlen und Punkt als Dezimaltrennzeichen
- **Beispiel**: 425.75 statt 425,75

**Problem: "Datum in der Zukunft"**

- **Lösung**: Wählen Sie ein heutiges oder vergangenes Datum
- **Ursache**: Zukünftige Daten sind nicht erlaubt

**Problem: "Eintrag nicht gefunden"**

- **Lösung**: Aktualisieren Sie die Seite
- **Ursache**: Daten wurden zwischenzeitlich geändert

**Problem: Export funktioniert nicht**

- **Lösung**: Überprüfen Sie Ihren Browser-Download-Ordner
- **Alternative**: Versuchen Sie es mit einem anderen Browser

### Technische Anforderungen

**Unterstützte Browser:**

- Google Chrome (empfohlen)
- Mozilla Firefox
- Safari
- Microsoft Edge

**Internetverbindung:**

- Stabile Verbindung erforderlich
- Automatische Speicherung bei Verbindungsfehlern

## Datenschutz und Sicherheit

### Datenschutz

- **Personenbezogene Daten**: Nur Ihre Benutzerdaten werden gespeichert
- **Kassendaten**: Werden verschlüsselt übertragen und gespeichert
- **Zugriff**: Nur Sie können Ihre Kassendaten einsehen

### Sicherheit

- **Passwort**: Verwenden Sie ein starkes Passwort
- **Abmeldung**: Melden Sie sich nach der Nutzung ab
- **Bildschirmsperre**: Sperren Sie Ihren Computer bei Abwesenheit

## Support und Kontakt

Bei Fragen oder Problemen wenden Sie sich an:

**Administrator**: [admin@bakery.local]
**Support-Zeiten**: Montag bis Freitag, 9:00 - 17:00 Uhr

**Bei Notfällen** (Datenverlust, Systemausfall):

- Kontaktieren Sie umgehend den Administrator
- Dokumentieren Sie das Problem mit Screenshots
- Notieren Sie Fehlermeldungen wörtlich

## Changelog

### Version 2.0 (Juni 2024)

- ✨ Neu: Vollständige CRUD-Funktionalität (Erstellen, Lesen, Bearbeiten, Löschen)
- ✨ Neu: Erweiterte Suchfunktionen und Filter
- ✨ Neu: CSV-Export mit deutschen Spaltenüberschriften
- ✨ Neu: Trend-Anzeige im Kassenverlauf
- ✨ Neu: Verbesserte Monatsübersicht
- 🔧 Verbessert: Benutzerfreundlichere Fehlermeldungen
- 🔧 Verbessert: Optimierte Performance
- 🔧 Verbessert: Mobile Responsiveness

### Version 1.0 (Mai 2024)

- 🎉 Initiale Version der Kassenverwaltung
- ✅ Grundfunktionen: Kassenstände erfassen und anzeigen
- ✅ Benutzerauthentifizierung
- ✅ Grundlegende Übersichten
