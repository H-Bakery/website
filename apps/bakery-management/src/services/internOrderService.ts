import { InternOrder } from '../types/internOrder'
import { mockInternOrders } from '../mocks/internOrders'

// Simulate a database or API store for intern orders
let internOrdersStore: InternOrder[] = [...mockInternOrders]

export const internOrderService = {
  // GET all intern orders
  getAllInternOrders: async (): Promise<InternOrder[]> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300))
    return [...internOrdersStore]
  },

  // GET a single intern order by ID
  getInternOrderById: async (id: string): Promise<InternOrder | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 200))
    return internOrdersStore.find((order) => order.id === id)
  },

  // POST (add) a new intern order
  addInternOrder: async (
    orderData: Omit<InternOrder, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<InternOrder> => {
    await new Promise((resolve) => setTimeout(resolve, 400))
    const newOrder: InternOrder = {
      ...orderData,
      id: `order-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    internOrdersStore.push(newOrder)
    return newOrder
  },

  // PUT (update) an existing intern order
  updateInternOrder: async (
    id: string,
    updates: Partial<Omit<InternOrder, 'id' | 'createdAt'>>
  ): Promise<InternOrder | null> => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const orderIndex = internOrdersStore.findIndex((order) => order.id === id)
    if (orderIndex === -1) {
      return null // Or throw an error
    }
    const updatedOrder = {
      ...internOrdersStore[orderIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    internOrdersStore[orderIndex] = updatedOrder
    return updatedOrder
  },

  // DELETE an intern order
  deleteInternOrder: async (id: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const initialLength = internOrdersStore.length
    internOrdersStore = internOrdersStore.filter((order) => order.id !== id)
    return internOrdersStore.length < initialLength
  },
}

// Example usage (optional, for testing service)
/*
(async () => {
  console.log('All Orders:', await internOrderService.getAllInternOrders());
  const newOrder = await internOrderService.addInternOrder({
    orderName: 'Test Order',
    description: 'This is a test.',
    status: 'pending',
  });
  console.log('Added Order:', newOrder);
  if (newOrder) {
    const updated = await internOrderService.updateInternOrder(newOrder.id, { status: 'done', assignedTo: 'Test User' });
    console.log('Updated Order:', updated);
    // await internOrderService.deleteInternOrder(newOrder.id);
    // console.log('Deleted order, current orders:', await internOrderService.getAllInternOrders());
  }
})();
*/
