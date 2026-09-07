import { PrintUtils } from './printUtils'
import { PrepSection } from '../../types/prepTask'

describe('PrintUtils.printProductionPlan', () => {
  let written: string

  beforeEach(() => {
    written = ''
    const fakeWindow = {
      document: {
        write: (html: string) => {
          written += html
        },
        close: jest.fn(),
      },
      focus: jest.fn(),
      print: jest.fn(),
    }
    jest.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('druckt keine Blechangabe für Positionen ohne Blech', () => {
    const sections: PrepSection[] = [
      {
        name: 'Teigwaren',
        completed: false,
        items: [
          { name: 'Ohne Blech', quantity: 6, completed: false },
          { name: 'Eins', quantity: 8, completed: false, tray_number: 1 },
          {
            name: 'Bereich',
            quantity: 15,
            completed: false,
            tray_numbers: [11, 12, 13],
          },
        ],
      },
    ]

    PrintUtils.printProductionPlan(sections, new Date('2026-01-06'))

    expect(written).toContain('Ohne Blech')
    expect(written).toContain('8 Stück (Blech 1)')
    expect(written).toContain('15 Stück (Bleche 11, 12, 13)')
    expect(written).toMatch(/Ohne Blech<\/span>\s*<span>6 Stück<\/span>/)
    expect(written).not.toMatch(/undefined|NaN/)
  })
})
