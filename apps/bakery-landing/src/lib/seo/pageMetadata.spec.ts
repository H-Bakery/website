import { SITE_URL } from '../../config/legal'
import { DEFAULT_OG_IMAGE, pageOpenGraph } from './pageMetadata'

describe('pageOpenGraph', () => {
  it('ergänzt Vorschaubild, Seitenname, Sprache und Typ', () => {
    expect(pageOpenGraph({ url: `${SITE_URL}/beispiel` })).toEqual({
      url: `${SITE_URL}/beispiel`,
      siteName: 'Bäckerei Heusser',
      locale: 'de_DE',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: DEFAULT_OG_IMAGE.alt,
        },
      ],
    })
  })

  it('übernimmt Titel, Beschreibung und ein eigenes Bild der Seite', () => {
    const image = {
      url: `${SITE_URL}/beispiel.jpg`,
      width: 1200,
      height: 630,
      alt: 'Beispiel',
    }
    expect(
      pageOpenGraph({
        url: `${SITE_URL}/beispiel`,
        title: 'Beispiel',
        description: 'Nur für Tests.',
        images: [image],
      })
    ).toMatchObject({
      title: 'Beispiel',
      description: 'Nur für Tests.',
      images: [image],
      siteName: 'Bäckerei Heusser',
    })
  })
})
