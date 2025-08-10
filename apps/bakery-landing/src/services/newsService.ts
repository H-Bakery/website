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

const newsDirectory = path.join(process.cwd(), '../../content/news')

export function getAllNews(): NewsItem[] {
  try {
    const filenames = fs.readdirSync(newsDirectory)
    const allNews = filenames
      .filter((filename) => filename.endsWith('.md'))
      .map((filename) => {
        const filePath = path.join(newsDirectory, filename)
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
      })
      .sort(
        (a, b) =>
          new Date(b.published).getTime() - new Date(a.published).getTime()
      )

    return allNews
  } catch (error) {
    console.error('Error reading news files:', error)
    return []
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
