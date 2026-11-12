/**
 * Spickzettel je Rolle für `/admin/hilfe` (P6, roadmap §6 M1).
 *
 * Hier steht NUR Text - zum Ändern reicht diese Datei. Geschrieben nach den
 * echten Bildschirmen (Station, Vorbestellung, Abholliste, Backstube,
 * Backzettel, Rezepte, Benutzer); wer dort eine Beschriftung ändert, zieht sie
 * hier nach.
 *
 * Schreibregeln: kurze Sätze, Anweisungen im Infinitiv („Namen antippen.“),
 * Beschriftungen der App in `**…**` (werden fett gedruckt). Jeder Zettel muss
 * gedruckt auf EINE A4-Seite passen - `spickzettel.spec.ts` begrenzt die
 * Länge grob, der Smoke prüft es mit einem echten PDF.
 */

import type { PilotRole } from '../../lib/roles'

export interface HilfeBlock {
  /** Überschrift des Abschnitts, z. B. „Vorbestellung erfassen“. */
  title: string
  /** Schritte in Reihenfolge; `**Knopf**` wird fett. */
  steps: readonly string[]
  /** Hervorgehobener Kasten (Störung, Warnung). */
  tone?: 'warning'
}

export interface Spickzettel {
  role: PilotRole
  /** Überschrift des Blatts. */
  title: string
  /** Ein Satz unter der Überschrift: für wen, welches Gerät. */
  intro: string
  blocks: readonly HilfeBlock[]
}

/** Gilt für jede Rolle: die Regel aus dem Runbook (§8, §9). */
const KEINE_VERBINDUNG: HilfeBlock = {
  title: 'Keine Verbindung?',
  tone: 'warning',
  steps: [
    'Die App zeigt „Keine Verbindung zum Server – bitte WLAN prüfen“.',
    'WLAN am Gerät prüfen, dann die Seite neu laden.',
    'Geht es nach **10 Minuten** noch nicht: auf **Papier** umstellen (Hilfe › Papierbetrieb). Erst arbeiten, dann reparieren.',
    'Dem Inhaber Bescheid geben.',
  ],
}

export const SPICKZETTEL: Record<PilotRole, Spickzettel> = {
  verkauf: {
    role: 'verkauf',
    title: 'Verkauf',
    intro: 'Vorbestellungen und Abholung – am Laden-Tablet (Station).',
    blocks: [
      {
        title: 'Anmelden',
        steps: [
          'Am Laden-Tablet den eigenen **Namen** antippen.',
          '**PIN** eintippen, **Anmelden** tippen.',
          'Die App öffnet die **Vorbestellungen**.',
          'Falscher Name? **Andere Person** tippen.',
        ],
      },
      {
        title: 'Vorbestellung erfassen (unter 30 Sekunden)',
        steps: [
          '**Neue Vorbestellung** tippen.',
          '**Name** eintragen. Telefon nur bei Bedarf.',
          '**Bestellweg**: Laden, Telefon oder WhatsApp.',
          '**Abholung**: **Im Laden** oder die Sammelstelle. Dann den Tag antippen. Uhrzeit ist freiwillig.',
          '**Produkt suchen**: zwei, drei Buchstaben tippen, Treffer antippen.',
          'Gefüllte Ware: **Sorte** wählen (Pflicht).',
          '**Menge** im Ziffernblock tippen, dann **Hinzufügen**. Für jedes Produkt wiederholen.',
          'Schon bezahlt? Schalter auf **Bezahlt** stellen.',
          '**Vorbestellung speichern** tippen.',
        ],
      },
      {
        title: 'Code auf den Zettel',
        steps: [
          'Nach dem Speichern steht groß der **Code**, z. B. LA-2026-11-28-03.',
          'Den Code auf den Zettel für die Kundschaft schreiben.',
          'LA = Laden. Jede Sammelstelle hat ihr eigenes Kürzel (z. B. MO = Mörsbach) - es steht vor jedem Code auf ihrer Abholliste.',
          '**Nächste Bestellung** tippen für die nächste Kundin.',
        ],
      },
      {
        title: 'Abholliste und Übergabe',
        steps: [
          'Menü › **Abholliste**. Tag und **Abholort** prüfen.',
          'Name oder Code ins Suchfeld tippen.',
          '**Übergeben** tippen. Noch nicht bezahlt: kassieren, dann **Bezahlt und übergeben**.',
          'Bezahlt, aber seitdem geändert: teurer – Rest kassieren, **Rest kassiert und übergeben**; billiger – Differenz zurückgeben, **Erstattet und übergeben**. Storniert: Geld zurückgeben, dann **Erstattet**.',
          'Vertippt? **⋮** › **Übergabe zurücknehmen** – die Zahlung steht dann wieder wie vorher.',
          'Nachmittags die Liste für morgen **drucken** – falls morgen die Technik streikt.',
        ],
      },
      {
        title: 'Nicht abgeholt',
        steps: [
          'Kommt jemand nicht: **⋮** › **Nicht abgeholt**.',
          'Bei Ladenschluss: **Tagesabschluss: Rest „nicht abgeholt“**.',
          'Kommt die Person doch noch: **⋮** › **Kommt doch noch**, dann übergeben.',
        ],
      },
      {
        title: 'Stornieren',
        steps: [
          'Bestellung öffnen: in **Vorbestellungen** antippen oder **⋮** › **Bestellung öffnen**.',
          '**Stornieren** tippen und bestätigen. Gelöscht wird nichts.',
          'Schon abgeholt? Erst **Auf „Offen“ zurück**, dann stornieren.',
        ],
      },
      {
        title: 'Abmelden',
        steps: [
          'Fertig? Oben rechts **Abmelden**. Das Tablet zeigt wieder die Namen.',
          'Nach 10 Minuten ohne Bedienung meldet die Station von selbst ab.',
        ],
      },
      KEINE_VERBINDUNG,
    ],
  },

  backstube: {
    role: 'backstube',
    title: 'Backstube',
    intro: 'Der Backzettel auf dem Backstuben-Tablet (Station).',
    blocks: [
      {
        title: 'Anmelden',
        steps: [
          'Am Backstuben-Tablet den eigenen **Namen** antippen, **PIN** eintippen.',
          'Die App öffnet die **Backstube**: den Backzettel in großer Schrift.',
        ],
      },
      {
        title: 'Heute oder Morgen',
        steps: [
          'Oben **Heute** oder **Morgen** tippen. Das Datum steht groß links oben.',
          'Reiter **Zettel**: was heute in die Maschine kommt (Teige, Brot, Brötchen je Backtag). Reiter **Backen**: die Backliste – was heute in den Ofen kommt, auch aus dem Teig vom Vortag.',
          'Die Seite lädt jede Minute neu. Der Kreispfeil lädt sofort.',
          'Samstag: die Karte **Hefeteig & Füllungen** steht zuerst – Teigstücke, Chargen, Abwiegen, Füllungen.',
        ],
      },
      {
        title: 'Abhaken',
        steps: [
          'Ist ein Posten fertig: das Kästchen rechts in der Zeile antippen.',
          'Noch einmal tippen nimmt den Haken weg.',
          'Oben steht, wie viele Zeilen erledigt sind.',
          'Reiter **Backen**: eigenes Kästchen **gebacken** je Zeile – auch für Teig vom Vortag. Nachträge haben unten ein eigenes Kästchen.',
        ],
      },
      {
        title: 'Nachträge quittieren',
        steps: [
          'Gelber Kasten **Nachträge seit der Freigabe**: Vorbestellungen, die nach der Freigabe kamen.',
          'Sie sind NICHT in den Mengen enthalten. +5 heißt: 5 mehr backen. −2 heißt: 2 weniger.',
          'Erledigt? **Gesehen** tippen. Die Zeile trägt bis dahin „Nachtrag“.',
        ],
      },
      {
        title: 'Vorbereitung',
        steps: [
          'Reiter **Vorbereitung heute**: was heute ab 14 Uhr für morgen vorbereitet wird.',
        ],
      },
      {
        title: 'Drucken',
        steps: [
          'Unten **Planung & Druck**, dann **Drucken**: der Zettel des Teigtags auf einer Seite, unten Platz für Notizen.',
          'Abwiegen, Füllungen und Vorbereitung nur mit Haken bei **Abwiegeliste & Rezepte mitdrucken** (eigene Blätter).',
          'Die Backliste: in **Planung & Druck** auf **Backliste**, dann **Drucken**.',
          'Den Ausdruck des freigegebenen Zettels aufheben – er ist der Ersatz bei einem Ausfall.',
        ],
      },
      {
        title: 'Noch nicht freigegeben',
        steps: [
          'Steht oben **Noch nicht freigegeben**, sind die Mengen ein Entwurf und können sich ändern.',
          'Abhaken geht erst nach der Freigabe.',
          'Freigeben: **Planung & Druck** › **Freigeben** › **Jetzt freigeben** (Backstube oder Inhaber).',
          '„An diesem Tag wird nicht gebacken“ heißt Ruhetag.',
        ],
      },
      {
        title: 'Rezepte',
        steps: [
          'Menü › **Rezepte**: Name oder Zutat suchen, Rezept antippen. **Drucken** druckt es.',
          'Ändern können Rezepte die Backstubenleitung und der Inhaber.',
        ],
      },
      {
        title: 'Keine Verbindung?',
        tone: 'warning',
        steps: [
          'WLAN am Tablet prüfen, Seite neu laden.',
          'Nach **10 Minuten**: mit dem letzten freigegebenen Ausdruck backen.',
          'Kein Ausdruck da? Das **Backzettel-Notfallblatt** von Hand ausfüllen (Hilfe › Papierbetrieb).',
          'Dem Inhaber Bescheid geben.',
        ],
      },
      {
        title: 'Abmelden',
        steps: ['Oben rechts **Abmelden**.'],
      },
    ],
  },

  backstubenleiter: {
    role: 'backstubenleiter',
    title: 'Backstubenleitung',
    intro:
      'Wie die Backstube – dazu Rezepte anlegen und ändern. Am Tablet (Station) oder am eigenen Gerät.',
    blocks: [
      {
        title: 'Backzettel und Backstube',
        steps: [
          'Alles wie in der Kurzanleitung **Backstube**: Zettel, Abhaken, Nachträge, Drucken, Freigeben.',
          'Dazu Menü › **Backzettel** › **Grundmengen** und die Rezepte.',
        ],
      },
      {
        title: 'Rezept nachschlagen',
        steps: [
          'Menü › **Rezepte**.',
          'Im Suchfeld Name oder Zutat tippen – oder eine Kategorie antippen.',
          'Rezept antippen. **Drucken** druckt es auf Papier.',
        ],
      },
      {
        title: 'Neues Rezept',
        steps: [
          '**Neues Rezept** tippen. **Name** und **Kategorie** eintragen.',
          '**Ergibt**: z. B. „3 Laibe à 700 g“. Leer heißt offen.',
          'Je Zutat **Menge**, **Einheit** und **Zutat**. Menge unbekannt? Leer lassen – dann steht dort „offen“, nie 0.',
          '**Zutat hinzufügen** für die nächste Zeile. Die Pfeile ändern die Reihenfolge, der Papierkorb entfernt.',
          '**Gruppe hinzufügen** für Vorteig, Hauptteig, Füllung.',
          'Arbeitsschritte eintragen, dann **Rezept anlegen**.',
        ],
      },
      {
        title: 'Rezept ändern',
        steps: [
          'Rezept öffnen › **Bearbeiten** › ändern › **Speichern**.',
          'Hat inzwischen jemand anderes gespeichert, meldet die App das: **Aktuellen Stand laden** und die Änderung noch einmal eintragen.',
          'Teig-Rezepte (Rechengrundlage des Backzettels) sind nur zum Ansehen.',
        ],
      },
      {
        title: 'Wartet auf Freigabe',
        steps: [
          'Nach dem Speichern steht **wartet auf Freigabe** am Rezept: es ist gespeichert, der Inhaber übernimmt es noch.',
          'Steht **Backzettel** am Rezept, rechnet der Backzettel damit – mit dem neuen Stand erst nach der Freigabe.',
          'So ein Rezept lässt sich ändern, aber nicht löschen.',
          '**Löschen** gibt es nur, wenn es freigeschaltet ist. Sonst dem Inhaber Bescheid geben.',
        ],
      },
      {
        title: 'Keine Verbindung?',
        tone: 'warning',
        steps: [
          'WLAN am Tablet prüfen, Seite neu laden.',
          'Nach **10 Minuten**: mit dem letzten freigegebenen Ausdruck backen (Hilfe › Papierbetrieb).',
          'Rezeptänderungen auf Papier notieren und später eintragen.',
        ],
      },
      {
        title: 'Abmelden',
        steps: [
          'Am Tablet nach der Arbeit **Abmelden** – sonst kann jeder dort Rezepte ändern.',
        ],
      },
    ],
  },

  fahrer: {
    role: 'fahrer',
    title: 'Fahrer',
    intro:
      'Sammelstelle und Abholliste – auf dem Handy. Die App geht nur im WLAN der Bäckerei.',
    blocks: [
      {
        title: 'Anmelden',
        steps: [
          'Im WLAN der Bäckerei die Verwaltung auf dem Handy öffnen.',
          '**Benutzername** und **Passwort** eingeben, **Anmelden** tippen.',
          'Die App öffnet die **Abholliste** der Sammelstelle.',
        ],
      },
      {
        title: 'Vor der Fahrt',
        steps: [
          'Tag mit den Pfeilen wählen, Abholort **Kindergarten Mörsbach** prüfen.',
          '**Drucken** tippen (oder im Laden drucken lassen) und die Liste mitnehmen.',
          'Unterwegs gibt es kein Bäckerei-WLAN: dort gilt die gedruckte Liste.',
        ],
      },
      {
        title: 'Übergeben und bezahlt',
        steps: [
          'In der App: **Übergeben** tippen.',
          'Noch nicht bezahlt: Geld nehmen, dann **Bezahlt und übergeben**.',
          'Schon bezahlt, aber teurer geworden: den Rest nehmen, **Rest kassiert und übergeben**. Billiger geworden: den Betrag aus dem Hinweis zurückgeben, **Erstattet und übergeben**.',
          '**Ohne Zahlung übergeben** nur, wenn das so abgesprochen ist.',
          'Auf Papier: Haken bei „übergeben“, „bezahlt“ ankreuzen.',
        ],
      },
      {
        title: 'Nicht abgeholt',
        steps: [
          'In der App: **⋮** › **Nicht abgeholt**.',
          'Auf Papier: Zeile mit „nicht abgeholt“ markieren.',
          'Die Ware zurück in den Laden bringen.',
        ],
      },
      {
        title: 'Zurück in der Bäckerei',
        steps: [
          'Die Haken vom Papier in die App übertragen (im WLAN).',
          'Vertippt? Zurücknehmen kann nur der Verkauf – dort Bescheid geben.',
          'Liste beim Verkauf abgeben.',
          'Oben rechts **Abmelden**.',
        ],
      },
      KEINE_VERBINDUNG,
    ],
  },

  inhaber: {
    role: 'inhaber',
    title: 'Inhaber',
    intro:
      'Konten, Stationen, Backzettel und Stammdaten – am eigenen Gerät mit Passwort.',
    blocks: [
      {
        title: 'Benutzer und PIN',
        steps: [
          'Mit Benutzername und Passwort anmelden (nicht an einer Station).',
          'Menü › **Benutzer** › **Neuer Benutzer**: Benutzername, Anzeigename, Rolle, Passwort, PIN (4–6 Ziffern) › **Anlegen**.',
          'PIN ändern: in der Zeile **PIN setzen**. Laufende Stationssitzungen enden dann.',
        ],
      },
      {
        title: 'Station einrichten',
        steps: [
          'Am Tablet die Seite **/station** öffnen, **Als Inhaber anmelden**.',
          '**Name der Station** eintragen, z. B. „Laden-Tablet“ › **Gerät als Station einrichten**.',
          'Danach zeigt das Tablet die Namen. Widerrufen: **Benutzer** › **Stationen**.',
        ],
      },
      {
        title: 'Backzettel planen und freigeben',
        steps: [
          'Menü › **Backzettel**, den Tag öffnen.',
          'Spalten: Basis, Saison, Vorbestellt, CAP, Korrektur, Gesamt.',
          'Korrektur: Stift in der Zeile, Zahl und Grund eintragen. Saisonfaktor 1,0 = normal.',
          '**Freigeben** › **Jetzt freigeben**. Danach ist der Zettel fest; neue Vorbestellungen kommen als Nachträge.',
          '**Wieder öffnen**: der Zettel wird wieder Entwurf. Geänderte Zeilen verlieren ihren Haken.',
        ],
      },
      {
        title: 'Grundmengen',
        steps: [
          'Backzettel › **Grundmengen**: Menge je Posten und Wochentag.',
          '„offen“ = noch nicht festgelegt, 0 = wird nicht gebacken.',
          'Die Verkaufszahlen daneben sind nur zur Information.',
        ],
      },
      {
        title: 'Produkte',
        steps: [
          'Menü › **Produkte**: bearbeiten oder neu anlegen.',
          'Bis die Änderung in hq übernommen ist, steht **Wartet auf Freigabe** daran.',
          'Bis dahin rechnen Vorbestellungen mit dem alten Stand.',
        ],
      },
      {
        title: 'Rezepte',
        steps: [
          'Menü › **Rezepte**: nachschlagen, **Neues Rezept**, **Bearbeiten**. Das darf auch die Rolle **Backstubenleitung** (Benutzer › Rolle); die Backstube liest nur.',
          'Auch hier: **wartet auf Freigabe**, bis es in hq übernommen ist.',
        ],
      },
      {
        title: 'Berichte und Finanzen',
        steps: [
          'Kassenberichte und Analysen: nur Inhaber.',
          'Finanzen und Tagesziel nur mit Passwort-Anmeldung, nie mit PIN an einer Station.',
        ],
      },
      {
        title: 'Papierbetrieb auslösen',
        tone: 'warning',
        steps: [
          'Blockiert die App die Arbeit länger als **10 Minuten**: auf Papier umstellen.',
          'Entscheiden darf, wer gerade im Laden bzw. in der Backstube steht.',
          'Vorbestellscheine und Notfallblatt vorrätig halten (Hilfe › Papierbetrieb).',
          'Danach: Zettel in der App nachtragen lassen, Code auf den Zettel. Technik anrufen.',
        ],
      },
    ],
  },
}

/** Reihenfolge der Reiter: die eigene Rolle zuerst, dann diese Reihenfolge. */
export const SPICKZETTEL_ORDER: readonly PilotRole[] = [
  'verkauf',
  'backstube',
  'backstubenleiter',
  'fahrer',
  'inhaber',
]

/** Reiter-Reihenfolge für eine Rolle (eigene Rolle vorn). */
export function spickzettelOrderFor(
  role: PilotRole | null | undefined
): PilotRole[] {
  if (!role) return [...SPICKZETTEL_ORDER]
  return [role, ...SPICKZETTEL_ORDER.filter((r) => r !== role)]
}
