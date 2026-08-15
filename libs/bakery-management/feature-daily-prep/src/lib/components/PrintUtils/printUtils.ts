import {
  PrepSection,
  BakingItem,
  AdditionalProductionItem,
} from '../../types/prepTask'

export class PrintUtils {
  static printProductionPlan(
    prepSections: PrepSection[],
    selectedDate: Date
  ): void {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Produktionsplan - ${tomorrow.toLocaleDateString('de-DE')}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
            body { font-family: Arial, sans-serif; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .section { margin-bottom: 15px; page-break-inside: avoid; }
            .section-title { font-weight: bold; font-size: 14px; margin-bottom: 8px; background: #f0f0f0; padding: 5px; }
            .prep-item { margin: 5px 0; padding: 3px; border: 1px solid #ddd; background: #f9f9f9; }
            .item-row { display: flex; justify-content: space-between; margin: 2px 0; }
            .completed-box { width: 15px; height: 15px; border: 2px solid #000; display: inline-block; margin-right: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PRODUKTIONSPLAN</h1>
          <h2>Vorbereitung für ${tomorrow.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</h2>
          <p>Vorbereitung am: ${selectedDate.toLocaleDateString(
            'de-DE'
          )} | Start: 14:00 Uhr</p>
        </div>

        ${prepSections
          .map(
            (section) => `
        <div class="section">
          <div class="section-title">□ ${section.name.toUpperCase()}</div>
          <p><em>${section.description}</em></p>
          ${
            section.items
              ? section.items
                  .map(
                    (item) => `
            <div class="prep-item">
              <div class="item-row">
                <span>□ ${item.name}</span>
                <span>${item.quantity} Stück${
                      item.tray_number ? ` (Blech ${item.tray_number})` : ''
                    }${
                      item.tray_numbers
                        ? ` (Bleche ${item.tray_numbers.join(', ')})`
                        : ''
                    }</span>
              </div>
              ${
                item.stock_status && item.stock_status !== 'sufficient'
                  ? `<div style="color: red; font-size: 10px;">⚠️ Bestand: ${
                      item.current_stock
                    } (${
                      item.stock_status === 'empty' ? 'LEER' : 'NIEDRIG'
                    })</div>`
                  : ''
              }
            </div>
          `
                  )
                  .join('')
              : ''
          }
          ${
            section.ingredients
              ? `
            <div style="margin: 10px 0;">
              <strong>Zutaten:</strong><br>
              ${section.ingredients
                .map((ing) => `• ${ing.quantity}${ing.unit} ${ing.name}`)
                .join('<br>')}
            </div>
          `
              : ''
          }
          ${
            section.instructions
              ? `
            <div style="margin: 10px 0;">
              <strong>Anweisungen:</strong><br>
              ${section.instructions
                .map((inst, idx) => `${idx + 1}. ${inst}`)
                .join('<br>')}
            </div>
          `
              : ''
          }
          ${
            section.final_step
              ? `<div style="background: #fff3cd; padding: 5px; margin-top: 10px;"><strong>Abschluss:</strong> ${section.final_step}</div>`
              : ''
          }
        </div>
        `
          )
          .join('')}

        <div style="margin-top: 30px; font-size: 10px; color: #666;">
          <p>□ Alle Vorbereitungen abgeschlossen</p>
          <p>□ Gärschrank kontrolliert</p>
          <p>□ Arbeitsplatz aufgeräumt</p>
          <p>Unterschrift Vorbereitungsschicht: ________________________</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }

  static printBakersPlan(
    bakingSchedule: { cakes: BakingItem[]; bread: BakingItem[] },
    additionalProduction: AdditionalProductionItem[],
    selectedDate: Date
  ): void {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const tomorrow = new Date(selectedDate)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Backplan - ${tomorrow.toLocaleDateString('de-DE')}</title>
        <style>
          @media print {
            @page { margin: 1cm; }
            body { font-family: Arial, sans-serif; font-size: 12px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .section { margin-bottom: 15px; page-break-inside: avoid; }
            .section-title { font-weight: bold; font-size: 14px; margin-bottom: 8px; background: #f0f0f0; padding: 5px; }
            .item { margin: 3px 0; padding: 2px 0; border-bottom: 1px dotted #ccc; }
            .additional { background: #fff3cd; padding: 10px; margin-top: 15px; }
            .urgent { background: #f8d7da; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BACKPLAN</h1>
          <h2>${tomorrow.toLocaleDateString('de-DE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</h2>
          <p>Erstellt am: ${selectedDate.toLocaleDateString(
            'de-DE'
          )} um ${new Date().toLocaleTimeString('de-DE')}</p>
          <p>Backstart: 02:00 Uhr | Ladenöffnung: 06:00 Uhr</p>
        </div>

        <div class="section">
          <div class="section-title">KUCHEN & TORTEN</div>
          ${bakingSchedule.cakes
            .map(
              (item) =>
                `<div class="item">□ ${
                  item.quantity || item.standard_quantity
                } x ${item.name}${item.note ? ` (${item.note})` : ''}</div>`
            )
            .join('')}
        </div>

        <div class="section">
          <div class="section-title">BROT</div>
          ${bakingSchedule.bread
            .map(
              (item) =>
                `<div class="item">□ ${
                  item.quantity || item.standard_quantity
                } ${item.unit || ''} ${item.name}</div>`
            )
            .join('')}
        </div>

        ${
          additionalProduction.length > 0
            ? `
        <div class="section additional">
          <div class="section-title">⚠️ ZUSÄTZLICHE PRODUKTION (DRINGEND)</div>
          ${additionalProduction
            .map(
              (item) =>
                `<div class="item ${
                  item.urgency === 'high' || item.urgency === 'critical'
                    ? 'urgent'
                    : ''
                }">□ ${item.name} - ${
                  item.reason === 'empty_stock'
                    ? 'BESTAND LEER'
                    : 'BESTAND NIEDRIG'
                } (${
                  item.urgency === 'high'
                    ? 'HOCH'
                    : item.urgency === 'critical'
                    ? 'KRITISCH'
                    : 'NORMAL'
                })</div>`
            )
            .join('')}
        </div>
        `
            : ''
        }

        <div style="margin-top: 30px; font-size: 10px; color: #666;">
          <p>□ Alle Artikel produziert</p>
          <p>□ Lagerung kontrolliert</p>
          <p>□ Verkaufstheke vorbereitet</p>
          <p>Unterschrift Bäcker: ________________________</p>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }
}
