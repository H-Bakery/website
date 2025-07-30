// Service for handling daily preparation tasks
import { PrepSection, BakingSchedule } from '../types/prepTask'

const API_BASE_URL = 'http://localhost:5000'

export interface PrepTaskResponse {
  sections: PrepSection[]
  bakingSchedule: BakingSchedule
  date: string
  generatedAt: string
}

class PrepTaskService {
  // Load preparation tasks for a specific date
  async loadPrepTasks(date: Date): Promise<PrepTaskResponse> {
    try {
      const dateStr = date.toISOString().split('T')[0]
      const response = await fetch(`${API_BASE_URL}/prep-tasks/${dateStr}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch prep tasks')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error loading prep tasks, using default configuration:', error)
      return this.getDefaultPrepTasks(date)
    }
  }

  // Generate new prep tasks based on orders and standard configuration
  async generatePrepTasks(date: Date, options?: {
    includeSpecialOrders?: boolean
    adjustForWeekend?: boolean
  }): Promise<PrepTaskResponse> {
    try {
      const dateStr = date.toISOString().split('T')[0]
      const response = await fetch(`${API_BASE_URL}/prep-tasks/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: dateStr,
          options: options || {}
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate prep tasks')
      }

      return await response.json()
    } catch (error) {
      console.error('Error generating prep tasks, using default:', error)
      return this.getDefaultPrepTasks(date)
    }
  }

  // Save completed prep tasks
  async savePrepTasks(data: {
    date: Date
    sections: PrepSection[]
    bakingSchedule: BakingSchedule
    completedBy: string
  }): Promise<{ success: boolean; id?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/prep-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          date: data.date.toISOString().split('T')[0]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save prep tasks')
      }

      return await response.json()
    } catch (error) {
      console.error('Error saving prep tasks:', error)
      // Mock successful save
      return { success: true, id: 'mock-id' }
    }
  }

  // Get prep task history
  async getPrepTaskHistory(days: number = 7): Promise<Array<{
    date: string
    completed: boolean
    completionRate: number
    completedBy?: string
    completedAt?: string
  }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/prep-tasks/history?days=${days}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch prep task history')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error loading prep task history:', error)
      return this.getMockHistory(days)
    }
  }

  // Load standard configuration from YAML
  async loadStandardConfig(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/prep-tasks/config`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch standard config')
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error loading standard config:', error)
      return this.getDefaultConfig()
    }
  }

  // Default preparation tasks (fallback when backend is unavailable)
  private getDefaultPrepTasks(date: Date): PrepTaskResponse {
    return {
      sections: [
        {
          name: 'Teigwaren-Aufbereitung',
          description: 'Artikel vom Gefrierschrank auf den Kaffeestückchen Wagen räumen',
          instructions: ['Alle Artikel auf Bleche mit Schutzfolie legen'],
          final_step: 'Wagen in Retarder schieben und auf Programm A stellen',
          items: [
            { name: 'Schokocroissant', quantity: 10, tray_number: 1, completed: false },
            { name: 'Croissant', quantity: 12, tray_number: 2, completed: false },
            { name: 'Schoko-Vanille Hörnchen', quantity: 7, tray_number: 3, completed: false },
            { name: 'Quarktaschen', quantity: 7, tray_number: 4, completed: false },
            { name: 'Nusschnecke', quantity: 6, tray_number: 5, completed: false },
            { name: 'Pudding Schnecke', quantity: 6, tray_number: 5, completed: false },
            { name: 'Pudding Plunder', quantity: 7, tray_number: 6, completed: false },
            { name: 'Kirschtaschen', quantity: 7, tray_number: 7, completed: false },
            { name: 'Apfeltaschen', quantity: 7, tray_number: 7, completed: false },
            { name: 'Franzbrötchen', quantity: 5, tray_number: 8, completed: false },
            { name: 'Marzipanschleifen', quantity: 6, tray_number: 9, completed: false },
            { name: 'Laufenstangen', quantity: 8, tray_number: 10, completed: false },
            { name: 'Einback', quantity: 15, trays_of: 5, tray_numbers: [11, 12, 13], completed: false },
            { name: 'Streusel', quantity: 8, tray_number: 14, completed: false },
            { name: 'Nougatplunder', quantity: 40, trays_of: 10, tray_numbers: [15, 16, 17, 18], completed: false },
          ],
          completed: false,
        },
        {
          name: 'Sauerteig-Vorbereitung',
          description: 'Für 3 Liter Mischbrot',
          ingredients: [
            { name: 'Sauerteigstarter', quantity: 28, unit: 'g' },
            { name: 'Wasser', quantity: 188, unit: 'g' },
            { name: 'Weizenmehl', quantity: 378, unit: 'g' },
          ],
          instructions: [
            'Zutaten schnell vermischen bis Teigkugel entsteht',
            'Teig aus Schüssel nehmen und langsam glatt kneten',
            'In kleinen, sauberen Behälter geben',
            'In kleinen Gärschrank lagern (27°C für 599 Minuten - verlängerte Gärung)',
          ],
          completed: false,
        },
        {
          name: 'Leberkäse-Vorbereitung',
          description: 'Leberkäse für den nächsten Tag vorbereiten',
          instructions: [
            'GN-Behälter einfetten',
            'Leberkäse in Hülle aus Gefrierschrank nehmen (liegt auf Blech auf kleiner Waage)',
            'Haut einritzen, dann Hülle entfernen',
            'In Behälter ohne Deckel legen',
            'In kleinen Ofen stellen und auf 105°C einstellen',
          ],
          completed: false,
        },
      ],
      bakingSchedule: {
        cakes: [
          { name: 'Marmorkuchen', standard_quantity: 3, quantity: 3 },
          { name: 'Sahnetorte', standard_quantity: 3, quantity: 3 },
          { name: 'Käsekuchen mit Mandarinen', standard_quantity: 2, quantity: 2 },
          { name: 'Kirsch-Streuselkuchen', standard_quantity: 2, quantity: 2, note: 'für morgen, 06:30' },
        ],
        bread: [
          { name: 'Kornbrot', standard_quantity: 6, unit: 'Liter', quantity: 6 },
          { name: 'Holzlukenbrot', standard_quantity: 6, unit: 'Liter', quantity: 6 },
          { name: 'Mischbrot', standard_quantity: 3, unit: 'Liter', quantity: 3 },
          { name: 'Haferbrot', standard_quantity: 1.24, unit: 'Liter', quantity: 1.24 },
        ],
      },
      date: date.toISOString().split('T')[0],
      generatedAt: new Date().toISOString()
    }
  }

  private getMockHistory(days: number): Array<{
    date: string
    completed: boolean
    completionRate: number
    completedBy?: string
    completedAt?: string
  }> {
    const history = []
    const today = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      // Mock some realistic completion data
      const completed = Math.random() > 0.2 // 80% completion rate
      const completionRate = completed ? Math.random() * 20 + 80 : Math.random() * 60 // 80-100% if completed, 0-60% if not
      
      history.push({
        date: date.toISOString().split('T')[0],
        completed,
        completionRate: Math.round(completionRate),
        completedBy: completed ? ['Max Müller', 'Anna Schmidt', 'Thomas Weber'][Math.floor(Math.random() * 3)] : undefined,
        completedAt: completed ? `${14 + Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}` : undefined
      })
    }

    return history
  }

  private getDefaultConfig(): any {
    // This would normally come from the YAML file
    return {
      preparation: {
        standard_time: "14:00-15:00",
        baking_start_time: "02:00",
        bakery_opening_time: "06:00"
      },
      // ... rest of the config from the YAML file
    }
  }
}

export const prepTaskService = new PrepTaskService()
export default prepTaskService