import React from 'react'
import { Metadata } from 'next'
import { Link, Typography, Box } from '@mui/material'
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip'
import { LegalPage, LegalSection, P } from '../../components/legal/LegalPage'
import {
  LEGAL,
  LEGAL_LAST_UPDATED,
  SITE_DOMAIN_DISPLAY,
} from '../../config/legal'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung - Bäckerei Heusser',
  description:
    'Datenschutzerklärung der Bäckerei Heusser: Informationen zur Verarbeitung personenbezogener Daten auf dieser Website gemäß DSGVO.',
  robots: { index: true, follow: true },
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <Box component="ul" sx={{ pl: 3, mb: 2, '& li': { mb: 0.5 } }}>
      {items.map((item, i) => (
        <Typography component="li" variant="body1" key={i}>
          {item}
        </Typography>
      ))}
    </Box>
  )
}

export default function DatenschutzPage() {
  const { address, supervisoryAuthority: sa } = LEGAL

  return (
    <LegalPage
      title="Datenschutzerklärung"
      icon={<PrivacyTipIcon sx={{ mr: 0.5 }} fontSize="small" />}
    >
      <Typography variant="body2" color="text.secondary">
        Stand: {LEGAL_LAST_UPDATED}
      </Typography>

      {/* 1 */}
      <LegalSection title="1. Datenschutz auf einen Blick">
        <P>
          Der Schutz Ihrer persönlichen Daten ist uns wichtig. Wir behandeln
          Ihre personenbezogenen Daten vertraulich und entsprechend der
          gesetzlichen Datenschutzvorschriften (insbesondere der
          Datenschutz-Grundverordnung – DSGVO – und des
          Bundesdatenschutzgesetzes – BDSG) sowie dieser Datenschutzerklärung.
        </P>
        <P>
          Diese Website ist eine reine Informationsseite. Wir setzen{' '}
          <strong>keine Cookies, keine Analyse- oder Tracking-Tools</strong> und
          keine Werbenetzwerke ein. Personenbezogene Daten werden nur in dem
          Umfang verarbeitet, der für den technischen Betrieb der Website
          erforderlich ist, oder wenn Sie selbst mit uns Kontakt aufnehmen.
        </P>
      </LegalSection>

      {/* 2 */}
      <LegalSection title="2. Verantwortliche Stelle">
        <P>
          Verantwortlich für die Datenverarbeitung auf dieser Website im Sinne
          von Art. 4 Nr. 7 DSGVO ist:
        </P>
        <P>
          {LEGAL.companyName}
          <br />
          Inhaber: {LEGAL.owner}
          <br />
          {address.street}
          <br />
          {address.postalCode} {address.city}
          <br />
          Telefon: <Link href={LEGAL.phoneHref}>{LEGAL.phone}</Link>
          <br />
          E-Mail: <Link href={`mailto:${LEGAL.email}`}>{LEGAL.email}</Link>
        </P>
        <P>
          Ein Datenschutzbeauftragter ist nach Art. 37 DSGVO i. V. m. § 38 BDSG
          nicht zu benennen. Bei Fragen zum Datenschutz wenden Sie sich bitte
          direkt an die oben genannte verantwortliche Stelle.
        </P>
      </LegalSection>

      {/* 3 */}
      <LegalSection title="3. Hosting und Server-Logfiles">
        <LegalSection title="GitHub Pages" level="h3">
          <P>
            Diese Website wird als statische Website bei GitHub Pages gehostet.
            Anbieter ist GitHub, Inc., 88 Colin P. Kelly Jr. Street, San
            Francisco, CA 94107, USA (nachfolgend „GitHub“). Beim Aufruf unserer
            Website erhebt GitHub automatisch Informationen in sogenannten
            Server-Logfiles, die Ihr Browser übermittelt. Dies sind
            insbesondere:
          </P>
          <Ul
            items={[
              'IP-Adresse des anfragenden Geräts',
              'Datum und Uhrzeit der Anfrage',
              'aufgerufene Seite bzw. Datei und übertragene Datenmenge',
              'Referrer-URL (zuvor besuchte Seite)',
              'Browsertyp und -version sowie verwendetes Betriebssystem',
            ]}
          />
          <P>
            Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f
            DSGVO. Unser berechtigtes Interesse liegt in der sicheren, stabilen
            und effizienten Bereitstellung unserer Website sowie in der Abwehr
            von Angriffen. Eine Zusammenführung dieser Daten mit anderen
            Datenquellen findet durch uns nicht statt. GitHub nutzt die Logdaten
            nach eigenen Angaben ausschließlich zu Sicherheitszwecken.
          </P>
          <P>
            GitHub kann personenbezogene Daten in die USA übermitteln. GitHub
            ist unter dem EU-US Data Privacy Framework (DPF) zertifiziert; die
            Übermittlung ist damit auf Grundlage des Angemessenheitsbeschlusses
            der EU-Kommission (Art. 45 DSGVO) zulässig. Ergänzend gelten die
            Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c
            DSGVO). Weitere Informationen finden Sie in der Datenschutzerklärung
            von GitHub:{' '}
            <Link
              href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement
            </Link>{' '}
            sowie speziell zu GitHub Pages:{' '}
            <Link
              href="https://docs.github.com/de/pages/getting-started-with-github-pages/what-is-github-pages#data-collection"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs.github.com/de/pages/…/what-is-github-pages#data-collection
            </Link>
            .
          </P>
        </LegalSection>

        <LegalSection title="SSL-/TLS-Verschlüsselung" level="h3">
          <P>
            Diese Website nutzt aus Sicherheitsgründen und zum Schutz der
            Übertragung vertraulicher Inhalte eine SSL- bzw.
            TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen Sie
            daran, dass die Adresszeile des Browsers von „http://“ auf
            „https://“ wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
          </P>
        </LegalSection>
      </LegalSection>

      {/* 4 */}
      <LegalSection title="4. Kontaktaufnahme">
        <LegalSection title="Telefon und E-Mail" level="h3">
          <P>
            Wenn Sie uns per Telefon oder E-Mail kontaktieren – zum Beispiel um
            eine Bestellung aufzugeben oder eine Anfrage zu stellen –, werden
            die von Ihnen mitgeteilten Daten (z. B. Name, Telefonnummer,
            E-Mail-Adresse, Inhalt der Anfrage bzw. Bestellung) zum Zweck der
            Bearbeitung Ihres Anliegens bei uns gespeichert und verarbeitet.
            Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
          </P>
          <P>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, sofern Ihre Anfrage
            mit der Erfüllung eines Vertrags (z. B. einer Bestellung)
            zusammenhängt oder zur Durchführung vorvertraglicher Maßnahmen
            erforderlich ist. In allen übrigen Fällen beruht die Verarbeitung
            auf unserem berechtigten Interesse an der effektiven Bearbeitung der
            an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO).
          </P>
          <P>
            Die Daten verbleiben bei uns, bis Sie uns zur Löschung auffordern,
            der Zweck der Datenspeicherung entfällt (z. B. nach abgeschlossener
            Bearbeitung Ihrer Bestellung) oder gesetzliche Aufbewahrungsfristen
            (insbesondere handels- und steuerrechtliche Aufbewahrungspflichten)
            ablaufen.
          </P>
        </LegalSection>

        <LegalSection title="WhatsApp" level="h3">
          <P>
            Wir bieten Ihnen die Möglichkeit, Bestellungen und Anfragen per
            WhatsApp an uns zu richten. Wenn Sie auf einen WhatsApp-Link auf
            unserer Website klicken, werden Sie zu WhatsApp weitergeleitet.
            Anbieter ist WhatsApp Ireland Limited, 4 Grand Canal Square, Grand
            Canal Harbour, Dublin 2, Irland (Teil der Meta-Unternehmensgruppe).
          </P>
          <P>
            Bei der Kommunikation über WhatsApp verarbeitet WhatsApp Ihre
            Telefonnummer, Metadaten der Kommunikation (z. B. Zeitpunkt) und –
            Ende-zu-Ende-verschlüsselt – die Inhalte Ihrer Nachrichten. Dabei
            kann es zu einer Übermittlung von Daten an Meta Platforms, Inc. in
            die USA kommen. Meta ist unter dem EU-US Data Privacy Framework
            zertifiziert. Wir haben keinen Einfluss auf die Datenverarbeitung
            durch WhatsApp. Näheres entnehmen Sie bitte der
            Datenschutzrichtlinie von WhatsApp:{' '}
            <Link
              href="https://www.whatsapp.com/legal/privacy-policy-eea"
              target="_blank"
              rel="noopener noreferrer"
            >
              www.whatsapp.com/legal/privacy-policy-eea
            </Link>
            .
          </P>
          <P>
            Die Nutzung von WhatsApp ist freiwillig; Sie können uns jederzeit
            auch telefonisch oder per E-Mail erreichen. Rechtsgrundlage für die
            Verarbeitung der über WhatsApp übermittelten Daten durch uns ist
            Art. 6 Abs. 1 lit. b DSGVO (Bestellungen) bzw. Art. 6 Abs. 1 lit. f
            DSGVO (allgemeine Anfragen). Wir speichern die über WhatsApp
            erhaltenen Bestelldaten nur so lange, wie es für die Abwicklung
            erforderlich ist bzw. gesetzliche Aufbewahrungspflichten bestehen.
          </P>
        </LegalSection>
      </LegalSection>

      {/* 5 */}
      <LegalSection title="5. Kartendienst OpenStreetMap">
        <P>
          Auf unserer Website binden wir zur Anfahrtsbeschreibung eine Karte des
          Kartendienstes OpenStreetMap ein. Anbieter ist die OpenStreetMap
          Foundation (OSMF), St John&apos;s Innovation Centre, Cowley Road,
          Cambridge, CB4 0WS, Vereinigtes Königreich.
        </P>
        <P>
          Die Karte wird{' '}
          <strong>erst nach Ihrer ausdrücklichen Zustimmung</strong> („Karte
          laden“) geladen. Erst dann stellt Ihr Browser eine Verbindung zu den
          Servern der OpenStreetMap Foundation her und übermittelt dabei Ihre
          IP-Adresse sowie technische Verbindungsdaten (Browsertyp, Zeitpunkt,
          angeforderte Kartenausschnitte). Ohne Ihre Zustimmung werden keine
          Daten an OpenStreetMap übertragen.
        </P>
        <P>
          Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO
          und § 25 Abs. 1 TDDDG. Ihre Entscheidung wird lokal in Ihrem Browser
          (Local Storage) gespeichert, damit Sie sie nicht bei jedem Besuch
          erneut treffen müssen. Sie können Ihre Einwilligung jederzeit mit
          Wirkung für die Zukunft widerrufen, indem Sie die Website-Daten dieser
          Seite in Ihrem Browser löschen.
        </P>
        <P>
          Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der
          EU-Kommission (Art. 45 DSGVO). Weitere Informationen finden Sie in der
          Datenschutzerklärung von OpenStreetMap:{' '}
          <Link
            href="https://osmfoundation.org/wiki/Privacy_Policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            osmfoundation.org/wiki/Privacy_Policy
          </Link>
          .
        </P>
      </LegalSection>

      {/* 6 */}
      <LegalSection title="6. Lokale Speicherung im Browser, Schriftarten und Cookies">
        <P>
          Diese Website verwendet <strong>keine Cookies</strong>. Um bestimmte
          Funktionen bereitzustellen, werden folgende Informationen
          ausschließlich lokal in Ihrem Browser (Local Storage) gespeichert und
          nicht an uns oder Dritte übertragen:
        </P>
        <Ul
          items={[
            'Ihre gewählte Darstellungseinstellung (helles/dunkles Design),',
            'Ihre Entscheidung zum Laden der OpenStreetMap-Karte.',
          ]}
        />
        <P>
          Diese Speicherung ist für die Bereitstellung des von Ihnen
          ausdrücklich gewünschten Dienstes unbedingt erforderlich und daher
          nach § 25 Abs. 2 Nr. 2 TDDDG ohne Einwilligung zulässig. Sie können
          diese Daten jederzeit über die Einstellungen Ihres Browsers löschen.
        </P>
        <P>
          Die auf dieser Website verwendeten Schriftarten werden{' '}
          <strong>lokal von unserem eigenen Server</strong> geladen. Eine
          Verbindung zu Servern von Google (Google Fonts) oder anderen
          Schriftanbietern findet nicht statt.
        </P>
      </LegalSection>

      {/* 7 */}
      <LegalSection title="7. Links zu sozialen Netzwerken und externen Seiten">
        <P>
          Unsere Website enthält Links zu unseren Profilen bei Instagram und
          Facebook (Meta Platforms Ireland Ltd.) sowie zu unserem
          Google-Unternehmensprofil (Google Ireland Ltd.). Dabei handelt es sich
          um einfache Verlinkungen – es sind keine Social-Media-Plugins
          eingebunden, sodass beim bloßen Besuch unserer Website keine Daten an
          diese Anbieter übertragen werden. Erst wenn Sie einen solchen Link
          anklicken, verlassen Sie unsere Website; es gelten dann die
          Datenschutzbestimmungen des jeweiligen Anbieters.
        </P>
      </LegalSection>

      {/* 8 */}
      <LegalSection title="8. Ihre Rechte als betroffene Person">
        <P>
          Ihnen stehen hinsichtlich Ihrer personenbezogenen Daten folgende
          Rechte zu:
        </P>
        <Ul
          items={[
            <>
              <strong>Auskunft</strong> (Art. 15 DSGVO) über die von uns
              verarbeiteten Daten,
            </>,
            <>
              <strong>Berichtigung</strong> unrichtiger Daten (Art. 16 DSGVO),
            </>,
            <>
              <strong>Löschung</strong> (Art. 17 DSGVO), soweit keine
              gesetzlichen Aufbewahrungspflichten entgegenstehen,
            </>,
            <>
              <strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO),
            </>,
            <>
              <strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO),
            </>,
            <>
              <strong>Widerruf</strong> einer erteilten Einwilligung jederzeit
              mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO); die
              Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt
              unberührt.
            </>,
          ]}
        />
        <Box
          sx={{
            p: 2,
            mb: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 700 }} gutterBottom>
            Widerspruchsrecht (Art. 21 DSGVO)
          </Typography>
          <Typography variant="body1">
            Soweit wir Ihre Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse) verarbeiten, haben Sie das Recht, aus
            Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit
            Widerspruch gegen diese Verarbeitung einzulegen. Wir verarbeiten die
            Daten dann nicht mehr, es sei denn, wir können zwingende
            schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre
            Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung
            dient der Geltendmachung, Ausübung oder Verteidigung von
            Rechtsansprüchen.
          </Typography>
        </Box>
        <P>
          Zur Ausübung Ihrer Rechte genügt eine formlose Mitteilung an die unter
          Ziffer 2 genannte verantwortliche Stelle.
        </P>

        <LegalSection
          title="Beschwerderecht bei der Aufsichtsbehörde"
          level="h3"
        >
          <P>
            Sie haben gemäß Art. 77 DSGVO das Recht, sich bei einer
            Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem
            Mitgliedstaat Ihres gewöhnlichen Aufenthalts, Ihres Arbeitsplatzes
            oder des Orts des mutmaßlichen Verstoßes. Die für uns zuständige
            Aufsichtsbehörde ist:
          </P>
          <P>
            {sa.name}
            <br />
            {sa.subtitle}
            <br />
            {sa.street}
            <br />
            {sa.postalCode} {sa.city}
            <br />
            <Link href={sa.url} target="_blank" rel="noopener noreferrer">
              {sa.url.replace('https://', '')}
            </Link>
          </P>
        </LegalSection>
      </LegalSection>

      {/* 9 */}
      <LegalSection title="9. Keine automatisierte Entscheidungsfindung">
        <P>
          Wir verwenden keine automatisierte Entscheidungsfindung oder Profiling
          im Sinne von Art. 22 DSGVO.
        </P>
      </LegalSection>

      {/* 10 */}
      <LegalSection title="10. Änderung dieser Datenschutzerklärung">
        <P>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie
          stets den aktuellen rechtlichen Anforderungen entspricht oder um
          Änderungen unserer Leistungen umzusetzen. Für Ihren erneuten Besuch
          gilt dann die jeweils aktuelle Fassung unter{' '}
          <Link href="/datenschutz">{SITE_DOMAIN_DISPLAY}/datenschutz</Link>.
        </P>
      </LegalSection>
    </LegalPage>
  )
}
