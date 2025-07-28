import { PrepSection, PrepTaskItem, BakingItem, PrepIngredient } from '../types/prepTask'

export class MarkdownParser {
  static parseMarkdownPrepFile(content: string): PrepSection[] {
    const sections: PrepSection[] = []
    const lines = content.split('\n')
    
    let currentSection: Partial<PrepSection> | null = null
    let currentMode: 'pastry_table' | 'ingredients' | 'instructions' | 'baking' | 'none' = 'none'
    let isInTable = false
    let tableHeaders: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Skip empty lines
      if (!line) continue
      
      // Check for section headers
      if (line.startsWith('## ') && line.includes('Pastries Preparation')) {
        if (currentSection) sections.push(currentSection as PrepSection)
        currentSection = {
          name: 'Teigwaren-Aufbereitung',
          description: 'Items to be removed from freezer and arranged on the Kaffeestückchen Wagen cart',
          instructions: ['All items must be placed on trays with protective foil'],
          items: [],
          completed: false
        }
        currentMode = 'none'
      } else if (line.startsWith('## ') && line.includes('Sourdough Preparation')) {
        if (currentSection) sections.push(currentSection as PrepSection)
        currentSection = {
          name: 'Sauerteig-Vorbereitung',
          description: 'Sourdough starter preparation',
          ingredients: [],
          instructions: [],
          completed: false
        }
        currentMode = 'none'
      } else if (line.startsWith('## ') && line.includes('Brühstück Preparation')) {
        if (currentSection) sections.push(currentSection as PrepSection)
        currentSection = {
          name: 'Brühstück-Vorbereitung', 
          description: 'Pre-scald preparation',
          ingredients: [],
          instructions: [],
          completed: false
        }
        currentMode = 'none'
      } else if (line.startsWith('## ') && line.includes('Meatloaf Preparation')) {
        if (currentSection) sections.push(currentSection as PrepSection)
        currentSection = {
          name: 'Leberkäse-Vorbereitung',
          description: 'Meatloaf preparation for next day',
          instructions: [],
          completed: false
        }
        currentMode = 'instructions'
      }
      
      // Handle tables (for pastries)
      if (line.startsWith('| Item') && line.includes('Quantity') && line.includes('Tray')) {
        isInTable = true
        tableHeaders = line.split('|').map(h => h.trim()).filter(h => h)
        currentMode = 'pastry_table'
        continue
      }
      
      if (line.startsWith('|--') || line.startsWith('|-')) {
        continue // Skip table separator
      }
      
      if (isInTable && line.startsWith('|') && currentMode === 'pastry_table') {
        const cells = line.split('|').map(c => c.trim()).filter(c => c)
        if (cells.length >= 3) {
          const item: PrepTaskItem = {
            name: cells[0],
            quantity: this.parseQuantity(cells[1]),
            completed: false
          }
          
          // Parse tray info
          const trayInfo = cells[2]
          if (trayInfo.includes('-')) {
            // Range like "11-13"
            const [start, end] = trayInfo.split('-').map(n => parseInt(n.trim()))
            item.tray_numbers = Array.from({length: end - start + 1}, (_, i) => start + i)
            item.trays_of = Math.floor(item.quantity / item.tray_numbers.length)
          } else {
            item.tray_number = parseInt(trayInfo)
          }
          
          // Add stock status (simulated)
          this.addStockStatus(item)
          
          if (currentSection && currentSection.items) {
            currentSection.items.push(item)
          }
        }
      }
      
      // Handle ingredients sections
      if (line.startsWith('#### Ingredients:')) {
        currentMode = 'ingredients'
        continue
      }
      
      if (currentMode === 'ingredients' && line.startsWith('- ')) {
        const ingredientText = line.substring(2)
        const ingredient = this.parseIngredient(ingredientText)
        if (ingredient && currentSection && currentSection.ingredients) {
          currentSection.ingredients.push(ingredient)
        }
      }
      
      // Handle instructions
      if (line.startsWith('#### Instructions:')) {
        currentMode = 'instructions'
        continue
      }
      
      if (currentMode === 'instructions' && line.match(/^\d+\./)) {
        const instruction = line.replace(/^\d+\.\s*/, '')
        if (currentSection && currentSection.instructions) {
          currentSection.instructions.push(instruction)
        }
      }
      
      // Handle final step
      if (line.startsWith('**Final Step:**')) {
        const finalStep = line.replace('**Final Step:**', '').trim()
        if (currentSection) {
          currentSection.final_step = finalStep
        }
      }
      
      // End table when we hit non-table content
      if (isInTable && !line.startsWith('|') && !line.startsWith('**Final Step:**')) {
        isInTable = false
        currentMode = 'none'
      }
    }
    
    // Add final section
    if (currentSection) {
      sections.push(currentSection as PrepSection)
    }
    
    return sections
  }
  
  static parseBakingSchedule(content: string): { cakes: BakingItem[], bread: BakingItem[] } {
    const lines = content.split('\n')
    const cakes: BakingItem[] = []
    const bread: BakingItem[] = []
    
    let currentMode: 'cakes' | 'bread' | 'none' = 'none'
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      if (trimmed.includes('Cakes & Pastries:')) {
        currentMode = 'cakes'
        continue
      } else if (trimmed.includes('Bread:')) {
        currentMode = 'bread'
        continue
      } else if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
        currentMode = 'none'
        continue
      }
      
      if (trimmed.startsWith('- ')) {
        const item = this.parseBakingItem(trimmed.substring(2))
        if (item) {
          if (currentMode === 'cakes') {
            cakes.push(item)
          } else if (currentMode === 'bread') {
            bread.push(item)
          }
        }
      }
    }
    
    return { cakes, bread }
  }
  
  private static parseQuantity(quantityStr: string): number {
    const match = quantityStr.match(/(\d+)/)
    return match ? parseInt(match[1]) : 1
  }
  
  private static parseIngredient(text: string): PrepIngredient | null {
    // Parse patterns like "28g starter culture" or "188g water"
    const match = text.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(.+)/)
    if (match) {
      return {
        quantity: parseFloat(match[1]),
        unit: match[2],
        name: match[3]
      }
    }
    return null
  }
  
  private static parseBakingItem(text: string): BakingItem | null {
    // Parse patterns like "3 Marble cakes" or "6 liters Kornbrot (grain bread)"
    const match = text.match(/(\d+(?:\.\d+)?)\s*(\w+)?\s*(.+?)(\s*\([^)]+\))?$/)
    if (match) {
      const quantity = parseFloat(match[1])
      const unit = match[2] && match[2] !== 'liters' ? match[2] : undefined
      const name = match[3].trim()
      
      return {
        name,
        standard_quantity: quantity,
        quantity,
        unit: match[2] === 'liters' ? 'liters' : unit
      }
    }
    return null
  }
  
  private static addStockStatus(item: PrepTaskItem): void {
    // Simulate stock status based on item name hash
    const hash = item.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const statuses: Array<'sufficient' | 'low' | 'critical' | 'empty'> = ['sufficient', 'low', 'critical', 'empty']
    const weights = [0.6, 0.25, 0.1, 0.05]
    
    let stockIndex = 0
    const random = (hash * 7) % 100 / 100
    let cumulative = 0
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i]
      if (random <= cumulative) {
        stockIndex = i
        break
      }
    }
    
    const status = statuses[stockIndex]
    const minStock = 5
    const currentStock = status === 'sufficient' ? 15 : 
                        status === 'low' ? 3 :
                        status === 'critical' ? 1 : 0

    item.stock_status = status
    item.current_stock = currentStock
    item.min_stock_level = minStock
  }
}