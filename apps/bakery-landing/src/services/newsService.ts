import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export interface NewsItem {
  id: number
  slug: string
  name: string
  published: string
  category: string
  image: string
  shortDescription: string
  text: string
  content?: string
}

// Try multiple possible paths for the news directory
// This handles both running from workspace root and from app directory
function getNewsDirectory(): string {
  const possiblePaths = [
    path.join(process.cwd(), '../../content/news'), // Running from app directory to workspace root
    path.join(process.cwd(), 'content/news'), // Running from workspace root
    path.join(process.cwd(), '../content/news'), // Alternative path
  ]

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      console.log('Using news directory:', possiblePath)
      return possiblePath
    }
  }

  // Fallback to first option
  console.warn('Could not find news directory, using default path')
  return possiblePaths[0]
}

const newsDirectory = getNewsDirectory()

/**
 * Parse a published date. Content files use the German format 'DD.MM.YYYY';
 * ISO strings are accepted as a fallback.
 */
export function parsePublishedDate(published: string): Date {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(published.trim())
  if (match) {
    const [, day, month, year] = match
    return new Date(Number(year), Number(month) - 1, Number(day))
  }
  return new Date(published)
}

export function getAllNews(): NewsItem[] {
  try {
    // Check if directory exists
    if (!fs.existsSync(newsDirectory)) {
      console.warn('News directory does not exist:', newsDirectory)
      return []
    }

    const filenames = fs.readdirSync(newsDirectory)
    const markdownFiles = filenames.filter((filename) =>
      filename.endsWith('.md')
    )

    if (markdownFiles.length === 0) {
      console.warn('No markdown files found in news directory')
      return []
    }

    const allNews = (
      markdownFiles
        .map((filename) => {
          try {
            const filePath = path.join(newsDirectory, filename)
            const fileContents = fs.readFileSync(filePath, 'utf8')
            const { data, content } = matter(fileContents)

            // Provide default values for required fields
            return {
              id: data.id || Date.now(),
              slug: data.slug || filename.replace('.md', ''),
              name: data.name || 'Untitled',
              published: data.published || new Date().toISOString(),
              category: data.category || 'Allgemein',
              image: data.image || '/images/default-news.jpg',
              shortDescription:
                data.shortDescription || 'Keine Beschreibung verfügbar',
              text: content || '',
              content: content || undefined,
            }
          } catch (fileError) {
            console.error(`Error reading file ${filename}:`, fileError)
            return null
          }
        })
        .filter((item) => item !== null) as NewsItem[]
    ).sort(
      (a, b) =>
        parsePublishedDate(b.published).getTime() -
        parsePublishedDate(a.published).getTime()
    )

    return allNews
  } catch (error) {
    console.error('Error reading news files:', error)
    // Return fallback news items if content directory doesn't work
    return [
      {
        id: 1,
        slug: 'willkommen',
        name: 'Willkommen bei Bäckerei Heusser',
        published: new Date().toISOString(),
        category: 'Allgemein',
        image: '/images/bakery-welcome.jpg',
        shortDescription: 'Entdecken Sie unsere traditionellen Backwaren',
        text: 'Herzlich willkommen bei der Bäckerei Heusser. Wir freuen uns, Sie mit unseren frischen Backwaren zu verwöhnen.',
        content:
          'Herzlich willkommen bei der Bäckerei Heusser. Wir freuen uns, Sie mit unseren frischen Backwaren zu verwöhnen.',
      },
    ]
  }
}

export function getNewsBySlug(slug: string): NewsItem | null {
  try {
    const filePath = path.join(newsDirectory, `${slug}.md`)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      published: data.published,
      category: data.category,
      image: data.image,
      shortDescription: data.shortDescription,
      text: content,
      content,
    }
  } catch (error) {
    console.error(`Error reading news file for slug ${slug}:`, error)
    return null
  }
}

export function getAllSlugs(): string[] {
  try {
    const filenames = fs.readdirSync(newsDirectory)
    return filenames
      .filter((filename) => filename.endsWith('.md'))
      .map((filename) => filename.replace('.md', ''))
  } catch (error) {
    console.error('Error reading news directory:', error)
    return []
  }
}
