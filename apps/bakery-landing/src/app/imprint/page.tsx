import React from 'react'
import { Metadata } from 'next'
import { Link, Typography } from '@mui/material'
import GavelIcon from '@mui/icons-material/Gavel'
import { LegalPage, LegalSection, P } from '../../components/legal/LegalPage'
import { LEGAL } from '../../config/legal'

export const metadata: Metadata = {
  title: 'Impressum - Bäckerei Heusser',
  description:
    'Impressum und Anbieterkennzeichnung der Bäckerei Heusser in Homburg-Kirrberg.',
  robots: { index: true, follow: true },
}

export default function ImprintPage() {
  const { address, editorial, craft } = LEGAL

  return (
    <LegalPage
      title="Impressum"
      icon={<GavelIcon sx={{ mr: 0.5 }} fontSize="small" />}
    >
      <LegalSection title="Angaben gemäß § 5 DDG">
        <P>
          {LEGAL.companyName}
          <br />
          Inhaber: {LEGAL.owner}
          <br />
          {address.street}
          <br />
          {address.postalCode} {address.city}
          <br />
          {address.country}
        </P>
      </LegalSection>

      <LegalSection title="Kontakt">
        <P>
          Telefon: <Link href={LEGAL.phoneHref}>{LEGAL.phone}</Link>
          <br />
          Mobil / WhatsApp: <Link href={LEGAL.mobileHref}>{LEGAL.mobile}</Link>
          <br />
          E-Mail: <Link href={`mailto:${LEGAL.email}`}>{LEGAL.email}</Link>
        </P>
      </LegalSection>

      <LegalSection title="Umsatzsteuer-ID">
        <P>
          Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:
          <br />
          USt-IdNr: {LEGAL.vatId}
        </P>
      </LegalSection>

      <LegalSection title="Berufsbezeichnung und berufsrechtliche Regelungen">
        <P>
          Berufsbezeichnung: {craft.profession}
          <br />
          Verliehen in: {craft.awardedIn}
          <br />
          Zuständige Kammer: {craft.chamber}, {craft.chamberAddress} (
          <Link
            href={craft.chamberUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {craft.chamberUrl.replace('https://', '')}
          </Link>
          )
          <br />
          Es gelten folgende berufsrechtliche Regelungen: {craft.regulation},
          einsehbar unter{' '}
          <Link
            href={craft.regulationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {craft.regulationUrl}
          </Link>
        </P>
      </LegalSection>

      <LegalSection title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <P>
          {editorial.name}
          <br />
          {editorial.street}
          <br />
          {editorial.postalCode} {editorial.city}
        </P>
      </LegalSection>

      <LegalSection title="Verbraucherstreitbeilegung / Universalschlichtungsstelle">
        <P>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).
        </P>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte">
        <P>
          Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach
          den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der
          Nutzung von Informationen nach den allgemeinen Gesetzen bleiben
          hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem
          Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
          Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese
          Inhalte umgehend entfernen.
        </P>
      </LegalSection>

      <LegalSection title="Haftung für Links">
        <P>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
          fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
          verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
          Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
          Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige
          Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine
          permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne
          konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
          Bekanntwerden von Rechtsverletzungen werden wir derartige Links
          umgehend entfernen.
        </P>
      </LegalSection>

      <LegalSection title="Urheberrecht">
        <P>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
          Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
          jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite
          sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
          Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt
          wurden, werden die Urheberrechte Dritter beachtet. Sollten Sie
          trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten
          wir um einen entsprechenden Hinweis. Bei Bekanntwerden von
          Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
        </P>
      </LegalSection>

      <LegalSection title="Datenschutz">
        <Typography variant="body1">
          Informationen zur Verarbeitung personenbezogener Daten finden Sie in
          unserer <Link href="/datenschutz">Datenschutzerklärung</Link>.
        </Typography>
      </LegalSection>
    </LegalPage>
  )
}
