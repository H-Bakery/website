import { InternOrder } from '../types/internOrder'

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

/**
 * Beispieldaten für interne Bestellungen (Einkäufe/Besorgungen des Teams).
 * Wird verwendet, solange kein Backend-Endpunkt existiert.
 */
export const mockInternOrders: InternOrder[] = [
  {
    id: 'order-001',
    orderName: 'Wochenmarkt-Nachschub',
    description:
      'Obst, Gemüse und Verpackungsmaterial für den Marktstand am Wochenende nachbestellen.',
    status: 'pending',
    assignedTo: 'Jonas Becker',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
    createdBy: 'Admin',
    items: [
      { itemName: 'Karotten', itemQuantity: 10, unit: 'kg' },
      { itemName: 'Äpfel', itemQuantity: 20, unit: 'kg' },
      { itemName: 'Papiertüten (groß)', itemQuantity: 100, unit: 'Stk' },
    ],
  },
  {
    id: 'order-002',
    orderName: 'Dringende Mehllieferung',
    description:
      '50 kg Weizenmehl Type 550 für die Sonderproduktion von Torten benötigt.',
    status: 'in-progress',
    assignedTo: 'Julia Schmidt',
    createdAt: daysAgo(1),
    updatedAt: new Date().toISOString(),
    createdBy: 'Backstube',
    quantity: 50,
  },
  {
    id: 'order-003',
    orderName: 'Reinigungsmittel für die Backstube',
    description:
      'Standard-Reinigungsmittel bestellen: Spülmittel, Schwämme, Papiertücher.',
    status: 'done',
    assignedTo: 'Michael Lehmann',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(2),
    createdBy: 'Admin',
    items: [
      { itemName: 'Spülmittel', itemQuantity: 5, unit: 'Flaschen' },
      { itemName: 'Schwämme', itemQuantity: 10, unit: 'Packungen' },
    ],
  },
  {
    id: 'order-004',
    orderName: 'Verpackung für Online-Bestellungen',
    description:
      'Kartons und Luftpolsterfolie für den Versand von Online-Kundenbestellungen.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Verkauf',
  },
]
