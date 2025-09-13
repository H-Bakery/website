import { PrepSection, PrepTaskItem, PrepIngredient } from '../types/prepTask'

export class MarkdownParser {
  /**
   * Parse a markdown file content into PrepSection array
   */
  public static parseMarkdownPrepFile(content: string): PrepSection[] {
    const sections: PrepSection[] = []
    const lines = content.split('\n')

    let currentSection: PrepSection | null = null
    let currentTable: PrepTaskItem[] = []
    let inTable = false
    let tableHeaders: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Parse section headers
      if (line.startsWith('## ')) {
        // Save previous section if exists
        if (currentSection) {
          if (currentTable.length > 0) {
            currentSection.items = currentTable
            currentTable = []
          }
          sections.push(currentSection)
        }

        // Extract section number and name
        const match = line.match(/## (\d+)\. (.+)/)
        if (match) {
          currentSection = {
            name: match[2],
            completed: false,
          }
        }
        inTable = false
      }

      // Parse subsection headers
      else if (line.startsWith('### ') && currentSection) {
        const subsectionName = line.replace('### ', '')
        if (!currentSection.description) {
          currentSection.description = subsectionName
        }
      }

      // Parse table headers
      else if (line.startsWith('|') && line.includes('|') && !inTable) {
        tableHeaders = line
          .split('|')
          .map((h) => h.trim())
          .filter((h) => h)
        inTable = true
        i++ // Skip separator line
      }

      // Parse table rows
      else if (line.startsWith('|') && inTable) {
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c)

        if (cells.length >= 2) {
          const item: PrepTaskItem = {
            name: cells[0],
            quantity: parseInt(cells[1]) || 0,
            completed: false,
          }

          // Parse tray numbers
          if (cells[2]) {
            if (cells[2].includes('-')) {
              // Range like "11-13"
              const [start, end] = cells[2].split('-').map((n) => parseInt(n))
              item.tray_numbers = []
              for (let t = start; t <= end; t++) {
                item.tray_numbers.push(t)
              }
            } else {
              item.tray_number = parseInt(cells[2])
            }
          }

          currentTable.push(item)
        }
      }

      // End table when non-table line encountered
      else if (inTable && !line.startsWith('|')) {
        inTable = false
      }

      // Parse ingredients
      else if (line.startsWith('- ') && currentSection) {
        const ingredientMatch = line.match(/- (\d+)([a-zA-Z]+) (.+)/)
        if (ingredientMatch) {
          if (!currentSection.ingredients) {
            currentSection.ingredients = []
          }
          currentSection.ingredients.push({
            quantity: parseInt(ingredientMatch[1]),
            unit: ingredientMatch[2],
            name: ingredientMatch[3],
          })
        } else {
          // Regular list item - could be instruction
          if (!currentSection.instructions) {
            currentSection.instructions = []
          }
          currentSection.instructions.push(line.replace('- ', ''))
        }
      }

      // Parse numbered instructions
      else if (/^\d+\. /.test(line) && currentSection) {
        if (!currentSection.instructions) {
          currentSection.instructions = []
        }
        currentSection.instructions.push(line.replace(/^\d+\. /, ''))
      }

      // Parse final step
      else if (line.startsWith('**Final Step:**') && currentSection) {
        currentSection.final_step = line.replace('**Final Step:**', '').trim()
      }

      // Parse regular description text
      else if (line && !line.startsWith('#') && currentSection) {
        if (!line.startsWith('####') && !line.includes('|---')) {
          if (i < lines.length - 1 && !currentSection.description) {
            currentSection.description = line
          }
        }
      }
    }

    // Save last section
    if (currentSection) {
      if (currentTable.length > 0) {
        currentSection.items = currentTable
      }
      sections.push(currentSection)
    }

    return sections
  }

  /**
   * Convert PrepSection array to markdown format
   */
  public static convertToMarkdown(sections: PrepSection[]): string {
    let markdown = '# Daily Preparation Checklist\n\n'

    sections.forEach((section, index) => {
      markdown += `## ${index + 1}. ${section.name}\n\n`

      if (section.description) {
        markdown += `### ${section.description}\n\n`
      }

      if (section.instructions && section.instructions.length > 0) {
        markdown += '#### Instructions:\n'
        section.instructions.forEach((instruction, i) => {
          markdown += `${i + 1}. ${instruction}\n`
        })
        markdown += '\n'
      }

      if (section.ingredients && section.ingredients.length > 0) {
        markdown += '#### Ingredients:\n'
        section.ingredients.forEach((ingredient) => {
          markdown += `- ${ingredient.quantity}${ingredient.unit} ${ingredient.name}\n`
        })
        markdown += '\n'
      }

      if (section.items && section.items.length > 0) {
        markdown += '| Item | Quantity | Tray # |\n'
        markdown += '|------|----------|--------|\n'
        section.items.forEach((item) => {
          let trayInfo = ''
          if (item.tray_number) {
            trayInfo = item.tray_number.toString()
          } else if (item.tray_numbers) {
            trayInfo = `${item.tray_numbers[0]}-${
              item.tray_numbers[item.tray_numbers.length - 1]
            }`
          }
          markdown += `| ${item.name} | ${item.quantity} | ${trayInfo} |\n`
        })
        markdown += '\n'
      }

      if (section.final_step) {
        markdown += `**Final Step:** ${section.final_step}\n\n`
      }
    })

    return markdown
  }
}
