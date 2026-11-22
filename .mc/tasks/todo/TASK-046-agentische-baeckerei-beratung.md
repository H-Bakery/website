---
id: TASK-046
title: Agentische Bäckerei-Beratung - ein Agenten-Team analysiert die echten Daten und berät den Inhaber
slug: agentische-baeckerei-beratung
status: backlog
priority: 3
owner: ''
projects: []
customers: []
tags:
  - agenten
  - beratung
  - openclaw
  - kennzahlen
  - prognose
  - epic
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-22
updated: 2026-11-22
---

# Agentische Bäckerei-Beratung - ein Agenten-Team analysiert die echten Daten und berät den Inhaber

## Kontext

Die Bäckerei hat seit dem Pilot mehr eigene Daten als je zuvor: Tagesabschlüsse der Kasse (seit
Frühjahr 2025, täglich automatisch), Bankumsätze nach Kategorien, freigegebene Backzettel,
Vorbestellungen, Rest am Abend, Abgleich Produktion ↔ Kasse, Verkaufspartner (CAP), Dienstplan.
Ausgewertet wird das bisher **von Hand und anlassbezogen** - zuletzt am 22.11.2026 die Frage, warum
am Wochenende bei Kuchen und Brot eine große Lücke zwischen Produktion und Kasse bleibt
(→ [TASK-043](TASK-043-abgleich-soll-umsatz-euro.md)). Dabei fielen auch Grenzen der Daten auf:
Sammel-Kassennummern („…, sonstige“) verwischen die Auswertung je Artikel.

Auf dem Agenten-Pi `robot0` (Pi 5, 4 GB) laufen über OpenClaw schon zwei Agenten: **Anna**
(Inhalt, `hq`, Modell `gpt-5.6-luna`) und **Robin** (Code, `website`, `gpt-5.6-sol`). Anna stellt
täglich den Kassenbericht per Telegram zu - nach der Hausregel **„nie eine Zahl erfinden“**: ein
deterministisches Skript (`make_summary.py`) rechnet, der Agent überbringt nur
(`agent/CLAUDE.md` §9, kein Repo). Dieses Muster ist die Grundlage für alles Weitere.

Was fehlt, ist die Stufe darüber: **jemand, der regelmäßig quer über alle Daten schaut, Muster
findet, sie an den Jahreszielen misst (`hq/projects/PROJ-002-bakery-2026/goals/`) und dem Inhaber
wenige, prüfbare Vorschläge macht** - wie eine Unternehmensberatung, nur wöchentlich und günstig.

## Vorstudie 22.11.2026: Erst die Daten, dann die Agenten

Vor der Umsetzung lief eine Tiefenrecherche: Datenbestand, Branchen-Benchmarks, KPI-Katalog,
Produktbewertung, Hebel mit Evidenz. Der vollständige Bericht enthält Angaben aus dem privaten
Datenbestand und liegt deshalb **nur in hq** (`hq/projects/PROJ-002-bakery-2026/specs/kennzahlen-vorstudie.md`),
nicht hier. Ergebnisse ohne echte Zahlen:

- **Die Kasse trägt sofort.** Mit Bon-Daten samt Uhrzeit sind Umsatz je Stunde und Wochentag, Bonzahl,
  Bon-Durchschnitt, Artikel je Bon und das Tagesziel belastbar.
- **Kosten und Produkte sind noch nicht auswertbar.**
  - Ein großer und wachsender Teil des Umsatzes läuft über die Sammeltasten („…, sonstige“).
  - Der Kassenbericht-Konverter mischt 7 % und 0 % USt; Netto-Umsätze sind nur aus den Rohdaten korrekt.
  - Es fehlen echte Einkaufspreise und bestätigte Rezepte, also gibt es keinen Deckungsbeitrag je Produkt.
  - Die Bankdaten sind eine Zahlungssicht ohne Miete und ohne BWA.
  - Die App-Daten (Rest, Dienstplan, Vorbestellungen) gibt es erst seit dem Pilotstart.
- **Benchmarks:**
  - Belastbar für kleine Betriebe ist im Kern die BMF-Richtsatzsammlung (Rohgewinn/Wareneinsatz je
    Größenklasse).
  - Personalkosten- und Retourenquoten schwanken stark mit der Definition. Für Bon-Durchschnitt, Miete
    und Abschreibung gibt es keinen belastbaren Vergleichswert.
  - Eigene Vorjahreswerte stehen deshalb vor Branchenwerten.
- **Gute Produkte** erkennt man am Deckungsbeitrag nach Retoure (je Stück und je Backstubenminute),
  dazu an der Nachfragestabilität (XYZ) und der Rolle im Warenkorb, nicht am Umsatz. Etwas Rest ist
  wirtschaftlich richtig (Newsvendor).
- **Hebel:** Prognosesoftware senkt Retouren laut der einzigen unabhängigen Messung (Thünen) nur um
  etwa 1 Prozentpunkt. Mehr versprechen die Auslage in der letzten Ladenstunde, eigene Preistests
  und die Besetzung entlang der Stundenkurve.
  - Jede Empfehlung wird als Experiment geführt: Halbsortiment oder ABAB-Wochen, 6–8 Wochen.
- **Rolle des Agenten:** Er protokolliert, er ist kein Orakel. Ein Skript rechnet das Faktenblatt, der
  Agent formuliert. Mengenvorschläge sind nur begrenzt verstellbar (etwa ±10 %).

**Konsequenz für die Phasen:** Vor Phase 0 kommen Datenreparatur und eine Seite ohne Agent:

1. USt-Zuordnung im Konverter korrigieren und Korrekturpaare saldieren.
2. Eine PLU ↔ Produkt ↔ Gruppe-Tabelle anlegen.
3. Eigene PLUs für die häufigsten Sammelartikel.
4. Den Steuerberater nach monatlicher BWA/SuSa und einem namenlosen Lohnjournal je Bereich fragen.
5. Backzettel-Freigabe und Rest-Zählung zur täglichen Routine machen.
6. Danach eine Seite **„Kennzahlen & Handlungsempfehlungen“** in der Verwaltung:
   - ganz oben der Datenstand;
   - 6 Kacheln mit Trend und Zielband;
   - die Treiber;
   - höchstens 3 Empfehlungen mit Evidenzlabel und Testplan;
   - ein Experiment-Log.

**Startbedingung für das Agenten-Team** (Vorschlag, kein Literaturwert):

- Sammelanteil in den A-Gruppen unter 10 %;
- vollständig erfasste Produktionstage ≥ 90 % über 6 Wochen;
- mindestens 3 Monate BWA;
- ein abgeschlossenes Experiment.

## Ziel / Nicht-Ziel

**Ziel:** Ein kleines Team von KI-Agenten („Beratung“), das

1. aus den echten Daten in `hq` mit **deterministischen Werkzeugen** Kennzahlen erzeugt,
2. daraus **Hypothesen mit Experiment und Messgröße** ableitet (Umsatz, Kosten, Rest/Abschriften,
   Preise, Sortiment, Marketing, Personaleinsatz),
3. dem Inhaber **einmal pro Woche einen kurzen Bericht mit genau drei Empfehlungen** schickt,
4. nachhält, was aus den Empfehlungen wurde (angenommen, ausprobiert, Wirkung gemessen).

**Nicht-Ziel:**

- Kein Agent ändert Backzettel, Preise, Produkte, Dienstplan oder Bestellungen - er **schlägt vor**.
- Keine Auswertung je Mitarbeitendem; kein Ersatz für Steuerberater oder HACCP.
- Keine neue Agenten-Plattform (OpenClaw wird erweitert); nichts an der App im Freeze (M3, 27.11.–24.12.).

## Recherche-Ergebnis

**1. Agenten-Muster (Stand Nov. 2026)**

- Anthropic empfiehlt, mit dem **einfachsten Muster** anzufangen und nur bei nachweisbarem Nutzen
  zu erweitern; die passenden Bausteine hier: _Orchestrator-Worker_ (ein Leiter verteilt an
  Spezialisten) und _Evaluator-Optimizer_ (ein Prüfer bewertet und schickt zurück)
  ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)).
- Mehr-Agenten-Systeme verbrauchen laut Anthropic rund **15× so viele Tokens wie ein Chat**
  (ein Einzelagent ca. 4×) und lohnen sich nur, wenn die Aufgabe parallelisierbar und wertvoll genug
  ist ([Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)).
  → Für eine kleine Bäckerei: **erst ein Agent mit mehreren Rollen (Skills) + Prüfer**, echte
  Spezialisten-Agenten erst, wenn der Wochenbericht trägt.
- Analyse-Agenten **erfinden Zahlen, Spalten und sogar Arbeitsschritte**, wenn sie nicht gezwungen
  sind, Code auszuführen und nur aus dessen Ergebnis zu antworten
  ([IDA-Bench, arXiv 2505.18223](https://arxiv.org/abs/2505.18223);
  [Survey Data-Science-Agenten, arXiv 2508.02744](https://arxiv.org/abs/2508.02744)).
  Gegenmittel: schmale Werkzeuge mit festem Ergebnisformat, Schema und Geschäftsregeln in Skills,
  Antwort nur aus Werkzeug-Ausgaben - genau die Hausregel von Anna.
- **OpenClaw** kann das schon: mehrere isolierte Agenten mit eigenem Workspace, Skills und Modell,
  Agent-zu-Agent-Nachrichten (`tools.agentToAgent`), Unteragenten (`sessions_spawn`,
  `subagents.allowAgents`), Cron je Agent, Routing über `bindings`
  ([docs.openclaw.ai – Multi-Agent](https://docs.openclaw.ai/concepts/multi-agent)).
- Vergleich (nur zur Einordnung): [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/overview)
  (Agentenschleife von Claude Code, an Anthropic-Modelle gebunden),
  [LangGraph](https://langchain-ai.github.io/langgraph/) (Graph mit Zustand, wiederholbare Läufe),
  [CrewAI](https://docs.crewai.com/) (Rollen-Teams, schnell, aber tokenhungrig). Keines bringt hier
  etwas, das OpenClaw + deterministische Skripte nicht schon leisten; ein Wechsel kostet nur.

**2. Hebel und Kennzahlen im Bäckerhandwerk** (Richtwerte sind unsicher - der eigene Verlauf zählt mehr)

| Kennzahl            | Richtwert / Befund                                                                                                                                                                                                                                                                                                                                                              | Belastbarkeit              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Branche gesamt      | 2024: Umsatz +2 % auf 17,92 Mrd. €, Betriebe −3,6 % ([Lebensmittel Praxis / ZV](https://lebensmittelpraxis.de/handel-aktuell/43997-handwerk-unter-druck-baeckereien-steigern-umsatz-trotz-sinkender-betriebszahlen.html))                                                                                                                                                       | gut                        |
| Retourenquote       | Spanne 1,5–19 %, kleine Betriebe deutlich weniger als große ([WWF „Unser täglich Brot“ 2018](https://www.wwf.de/fileadmin/fm-wwf/Publikationen-PDF/WWF-Studie-Unser-taeglich-Brot_Von-ueberschuessigen-Brotkanten-und-wachsenden-Brotbergen_Kurzfassung_102018.pdf); [FH Münster, BrotBack](https://www.hb.fh-muenster.de/opus4/files/826/150917_Endbericht_BrotBack_PDFA.pdf)) | mittel, kleine Stichproben |
| Personalkostenquote | „30–40 % vom Umsatz“ ([Branchenblog](https://skill-sprinters.de/blog/branchen/ki-fuer-baeckerei-konditorei/))                                                                                                                                                                                                                                                                   | **unsicher**               |
| Wareneinsatzquote   | häufig genannt 25–30 %, **keine belastbare Bäcker-Quelle gefunden**; DSGV-Branchenreport Bäckereien (WZ 10.71) oder Innungs-Betriebsvergleich beschaffen                                                                                                                                                                                                                        | **unbelegt**               |
| Too Good To Go      | Provision ca. 1,15 € je Tüte + 39 €/Jahr, Tüte meist 2–5 € (Stand 12/2024, [Verbraucherzentrale](https://www.verbraucherzentrale.de/wissen/umwelt-haushalt/nachhaltigkeit/apptest-too-good-to-go-wir-retten-lebensmittel-93411))                                                                                                                                                | mittel                     |

Weitere Hebel aus den eigenen Daten: Umsatz je Wochentag/Stunde, Bon-Durchschnitt, ABC-Analyse,
Restquote je Abschnitt, Tagesziel je Wochentag, CAP-Retouren (Ziel 1), Preisänderungen als
natürliches Experiment (Preiselastizität nur grob - wenige Datenpunkte).

**3. Absatzprognose**

- Bäckerei-Studien zeigen: **Kalender (Wochentag, Feiertag, Brückentag, Ferien) ist der stärkste
  Faktor**; ML schlägt einfache Verfahren bei großen Ketten
  ([Huber & Stuckenschmidt 2020, IJF](https://ideas.repec.org/a/eee/intfor/v36y2020i4p1420-1438.html)).
- Für eine **kleine** Bäckerei brachten Wetter- und Feiertagsvariablen in Prophet keinen messbaren
  Gewinn ([Masterarbeit JKU Linz](https://www.dke.uni-linz.ac.at/rest/dke_web_res/publications/theses/MT2604/MT2604_copy.pdf)).
  Anbieterzahlen (z. B. −30 % Retouren mit Foodforecast) stammen aus Firmendaten
  ([Hübner et al. 2024](https://ideas.repec.org/a/bla/inecol/v28y2024i5p1117-1131.html)).
- **Folgerung:** Basisprognose = Median der letzten 4–8 gleichen Wochentage × Saisonfaktor ×
  Kalenderkorrektur aus `hq/config/kalender.yaml`; Wetter (DWD über [Bright Sky](https://brightsky.dev/))
  erst als Experiment, das sich gegen die Basis beweisen muss. Aus der Prognose wird über das
  [Newsvendor-Prinzip](https://en.wikipedia.org/wiki/Newsvendor_model) eine Backmenge je
  Abschnitt mit gewollter Ausverkaufswahrscheinlichkeit - als **Vorschlag neben** dem Backzettel.

## Agenten-Team

Ein Leiter, Spezialisten als Rollen, ein Prüfer. Im MVP ist das **ein** OpenClaw-Agent mit
mehreren Skills; eigene Agenten erst ab Phase 3 (siehe Recherche, Token-Kosten).

| Rolle                      | Eingaben (nur über Werkzeuge)                                            | Ausgabe                                                                | Takt               |
| -------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------ |
| **Leitung** (Orchestrator) | Faktenblatt der Woche, Jahresziele, Empfehlungsregister                  | Wochenbericht, Auswahl der 3 Empfehlungen                              | wöchentlich        |
| **Verkauf**                | Kassenberichte: Umsatz, Bons, Wochentag/Stunde, Top/Flop, Sammel-Anteil  | Auffälligkeiten ggü. Vorwoche/Vorjahr                                  | wöchentlich        |
| **Produktion & Rest**      | Backzettel, Rest am Abend, Abgleich (ab TASK-043 in €), Prognose         | Über-/Unterproduktion je Abschnitt und Wochentag, Backmengen-Vorschlag | wöchentlich        |
| **Kosten & Finanzen**      | Bankumsätze nach Kategorie, Tagesziel                                    | Wareneinsatz-, Personal-, Energiequote (Monat), Break-even-Abstand     | monatlich          |
| **Sortiment & Preise**     | Kasse (ABC), Produkte, Rezeptkosten (wo vorhanden, Ziel 2)               | ABC-Liste, Kandidaten für Streichung/Preisprüfung, Preis-Experimente   | monatlich          |
| **Markt & Marketing**      | Kalender, Vorbestellungen, Shop (Ziel 6), CAP (Ziel 1), Rest             | Aktionsideen (z. B. Abendangebot, TGTG), Textentwürfe **an Anna**      | monatlich / Anlass |
| **Team & Abläufe**         | Dienstplan **nur aggregiert** (Stunden je Bereich/Tag), Umsatz je Stunde | Besetzung vs. Kundenaufkommen, keine Personen                          | monatlich          |
| **Prüfer** (Kritiker)      | Berichtsentwurf + Faktenblatt                                            | Freigabe oder Rückgabe mit Gründen                                     | jeder Bericht      |

Der Prüfer ist zweistufig: (1) **deterministischer Zahlenprüfer** - jede Zahl im Text muss im
Faktenblatt stehen, jede Empfehlung hat Messgröße und Zeitraum, keine Personennamen; (2) ein
LLM-Durchgang auf Plausibilität und Ton („Hinweis, kein Beweis“, wie im Abgleich).

## Datenquellen

Nur Pfade, keine Inhalte. Alles liegt im privaten `hq`; gelesen wird aus einem eigenen,
**nur lesenden Klon** auf dem Pi (Lehre aus H4: nicht in Annas Chat-Workspace).

- Kasse: `hq/data/reports/converted/*.json` (je Tag und Kasse), `daily-reports/`, `weekly-reports/`,
  `monthly-reports/`; Regeln [`docs/domains/kassenberichte.md`](../../../docs/domains/kassenberichte.md).
- Finanzen: `hq/data/finance/finance-summary.json`, `transactions/JJJJ-MM.json`,
  `config/categories.json` (u. a. `wareneinsatz`, `personal`, `energie`); Bankbasis = Zahlungs-,
  nicht Periodensicht → Quoten nur als Monats-/Quartalstrend.
  [`docs/domains/finanzen.md`](../../../docs/domains/finanzen.md) (Tagesziel).
- Produktion: `hq/data/production/backzettel/*.json`, `vorbestellungen/*.json` (Summen, ohne Namen),
  `hq/config/backzettel.yaml`, `hq/config/kalender.yaml`.
- Produkte & Rezepte: `hq/products/*.md`, `hq/data/recipes/`, `hq/data/inventory/`.
- App-Daten (DB auf dem Pi, heute nicht in `hq`): Rest am Abend, Abgleich, Verkaufspartner,
  Dienstplan - [`rest-am-abend.md`](../../../docs/domains/rest-am-abend.md),
  [`abgleich.md`](../../../docs/domains/abgleich.md),
  [`verkaufspartner.md`](../../../docs/domains/verkaufspartner.md),
  [`dienstplan.md`](../../../docs/domains/dienstplan.md). Zugang ist eine Inhaber-Entscheidung.
- Ziele: `hq/projects/PROJ-002-bakery-2026/goals/01…06-*.md`.
- Extern (optional): DWD-Wetter über Bright Sky (nur Ortskoordinaten verlassen das Haus).

**Bekannte Datenlücken** (gehören in jeden Bericht als „Belastbarkeit“): Anteil der
Sammel-Kassennummern am Umsatz, fehlende Rest-Zählungen, Tage ohne freigegebenen Backzettel,
Handelsware ohne Produktion, Bankbuchungen „unkategorisiert“.

## Leitplanken

1. **Zahlen nur aus Werkzeugen.** Der Agent rechnet nicht im Kopf; er ruft ein Skript, das JSON mit
   Wert, Einheit, Zeitraum und **Quelldatei(en)** liefert. Jede Zahl im Bericht trägt ihre Quelle.
2. **Eine Rechnung, eine Stelle.** Werkzeuge nutzen die vorhandenen dependency-freien Cores
   (`reports.core.js`, `abgleich.core.js`, `rest-am-abend.core.js`, `targets.core.js`,
   `partner-stats.core.js`, `finance.core.js`) statt einer zweiten Implementierung.
3. **Empfehlung = Hypothese.** Format: Beobachtung (mit Quelle) → Vermutung → kleines Experiment
   (was, wo, wie lange) → Messgröße und Erfolgsschwelle → Aufwand/Risiko. Nie „Sie müssen“.
4. **Menschen entscheiden.** Kein Schreiben außerhalb des eigenen Berichtspfads; alles andere als
   Vorschlag an den Inhaber, Texte über Anna, Code über Robin - jeweils Branch → PR.
5. **Datenschutz.** Keine Auswertung je Mitarbeitendem (Kasse hat Bediener, Dienstplan Personen):
   Werkzeuge aggregieren vor dem Agenten, Personenfelder kommen gar nicht erst ins Faktenblatt.
   Keine Kundennamen. Nichts davon in `website`, Prompts an Dritte nur mit Aggregaten.
6. **Kosten im Griff.** Faktenblatt ohne LLM; Routine mit `gpt-5.6-luna`, das größere Modell nur für
   die Wochen-Synthese oder gar nicht; Token-Budget je Lauf und Monat, Abbruch bei Überschreitung,
   Verbrauch steht im Bericht.
7. **Ehrlich über Unsicherheit.** Richtwerte aus der Branche nur mit Quelle und Belastbarkeit; zu
   wenige Datenpunkte → „noch nicht aussagekräftig“ statt Scheingenauigkeit.
8. **Kurz.** Telegram-Fassung ≤ 15 Zeilen; Lesezeit des Inhabers ≤ 5 Minuten.

## Architektur-Vorschlag

```
Cron (OpenClaw, Pi robot0)
  └─ 1. Faktenblatt  (deterministisch, kein LLM)
       kennzahlen <woche> → hq/data/analysis/faktenblatt/JJJJ-Www.json
         Module: verkauf · produktion/rest · finanzen · sortiment(ABC) · prognose · datenqualitaet
         jedes Feld: { wert, einheit, zeitraum, quellen[] }
  └─ 2. Berater-Agent (OpenClaw, eigener Workspace, Skills je Rolle)
       liest Faktenblatt + Ziele + Empfehlungsregister → Entwurf Wochenbericht (Markdown)
  └─ 3. Prüfer: zahlenpruefer.py (deterministisch) → LLM-Prüfdurchgang → ggf. 1 Überarbeitung
  └─ 4. Ablage + Zustellung
       hq/data/analysis/wochenberichte/JJJJ-Www.md, Empfehlungsregister empfehlungen.yaml
       Telegram an den Inhaber (Kurzfassung + Verweis), über den vorhandenen Bot
```

- **Agent:** neuer OpenClaw-Agent `berater` (Arbeitsname; Persona/Skills unter `agent/fleet/`,
  Deploy wie Anna/Robin über `deploy-on-pi.sh`), Workspace `~/.openclaw/workspaces/berater`,
  Lese-Token für `hq`, Schreibrecht nur für `data/analysis/` (Pfad-Eigentum nach D13 / §4a).
- **Werkzeuge:** Node-CLI auf Basis der Cores (Code im `website`-Repo, Tests nur mit synthetischen
  Daten) oder Python neben der Pipeline in `hq` - siehe Entscheidungen. Leichtgewichtig für 4 GB RAM:
  keine großen ML-Bibliotheken; Prognose als Median/Saisonfaktor in reinem Code.
- **Empfehlungsregister** (`empfehlungen.yaml`): id, Datum, Rolle, Hypothese, Experiment, Messgröße,
  Schwelle, Status (`vorgeschlagen → angenommen | abgelehnt → läuft → ausgewertet`), Ergebnis. Der
  Inhaber antwortet in Telegram „ja / nein / später“; der Agent trägt es ein und misst nach.

## Phasen

**Phase 0 - Grundlagen (Dezember 2026, nur lesend, kein Eingriff in die App)**

- Datenqualitäts-Modul (Sammel-Anteil, Lücken, unkategorisierte Buchungen); Faktenblatt v0 für zwei
  vergangene Wochen mit dem Inhaber durchsprechen; Entscheidungen unten einholen.

**Phase 1 - MVP „Wochenbericht“ (Januar 2027, parallel zu M4)**

- Faktenblatt-Module Verkauf + Produktion/Rest + Datenqualität, Zahlenprüfer, Berater-Agent mit
  Rollen Leitung/Verkauf/Produktion, Telegram-Zustellung, Empfehlungsregister.
- Jeden Montag nach dem Kassen-Nachlauf: **Wochenbericht mit Lage in 5 Zeilen, 3 Empfehlungen,
  Status der laufenden Experimente, Belastbarkeit**.
- Erster Inhalt naheliegend: Wochenend-Überproduktion (Kuchen/Brot), Weihnachtsrückblick 2026.
- Vier Wochen Probelauf, dann Review mit dem Inhaber.

**Phase 2 - Produktion & Prognose**

- Prognose-Werkzeug (Wochentag × Saison × Kalender), rückwirkend gegen Backzettel und Kasse
  getestet; Backmengen-Vorschlag je Abschnitt im Bericht. Euro-Sicht sobald TASK-043 steht.
- Wetter als Experiment gegen die Basis; Too Good To Go / Abendangebot als Rest-Experiment.

**Phase 3 - Kosten, Sortiment, Preise (Monatsbericht)**

- Quoten aus den Bankdaten (Trend), ABC-Analyse, Deckungsbeitrag wo Rezeptkosten vorliegen
  (Ziel 2), Preis-Experimente mit Vorher/Nachher. Rollen werden ggf. eigene Unteragenten.

**Phase 4 - Wachstum & Marketing (Quartalsbericht)**

- Bilanz gegen die Jahresziele 1–6, CAP-Retouren und -Deckungsbeitrag (Ziel 1), Shop-Anteil der
  Vorbestellungen (Ziel 6), Investitionsfragen (Ziele 4, 5) mit Zahlen; Aktionsentwürfe über Anna.

## Erfolgsmessung

- **Qualität / Nutzen:** 0 Zahlen ohne Quelle; Anteil angenommener Empfehlungen; ausgewertete
  Experimente je Quartal.
- **Wirkung (je Experiment, gegen eigenen Vorjahres-/Vorwochenwert):** Restquote je Abschnitt,
  „Ungeklärt“ im Abgleich, Tagesziel-Erreichung, Bon-Durchschnitt, Wareneinsatzquote (Trend).
- **Aufwand:** Lesezeit Inhaber ≤ 5 min/Woche; Token-Kosten je Monat unter dem vereinbarten Budget.
- **Abbruchkriterium:** nach drei Monaten keine angenommene Empfehlung → Format überdenken.

## Entscheidungen für den Inhaber

1. Eigener Agent `berater` (Name/Persona?) oder zusätzliche Skills für Anna?
2. Termin und Kanal: Montagabend per Telegram? Zusätzlich Markdown in `hq`?
3. Ablage der Berichte: eigener Pfad `hq/data/analysis/` mit Direkt-Commit (wie die Pipeline) oder
   jeder Bericht als PR?
4. Welche Daten darf die Beratung sehen: Finanzen ja? Dienstplan/Lohnkosten nur aggregiert ja?
   Lesezugriff auf die App-Daten (Rest, Abgleich, CAP) über einen Export nach `hq` oder gar nicht?
5. Monatliches Budget für Modellkosten und ob das größere Modell überhaupt nötig ist.
6. Externe Wetterdaten (Bright Sky/DWD) ja/nein.
7. Branchen-Benchmarks beschaffen (DSGV-Branchenreport, Betriebsvergleich der Innung)?
8. Schwerpunkt der ersten drei Monate (Vorschlag: Rest/Überproduktion + CAP, Ziel 1).
9. Werkzeug-Code im öffentlichen `website` (Cores wiederverwenden, nur synthetische Tests) oder im
   privaten `hq` neben der Pipeline?

## Abnahme MVP

- An vier aufeinanderfolgenden Montagen kommt ein Wochenbericht pünktlich per Telegram an.
- Jeder Bericht hat genau drei Empfehlungen im Format Hypothese → Experiment → Messgröße → Schwelle.
- Der Zahlenprüfer findet in allen vier Berichten **keine Zahl ohne Quelle**; Stichprobe des
  Inhabers: drei Zahlen je Bericht stimmen mit der genannten Datei überein.
- Kein Bericht nennt Personen; im Faktenblatt stehen keine Personenfelder.
- Das Empfehlungsregister führt Status und Antworten des Inhabers nach.
- Token-Verbrauch je Lauf steht im Bericht und liegt im Budget.
- Der Inhaber bewertet nach vier Wochen: mindestens eine Empfehlung war neu und umsetzbar.
- In `website` landen nur Code, Doku und synthetische Testdaten - keine echten Zahlen.
