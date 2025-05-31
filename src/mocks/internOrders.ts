import { InternOrder } from '../types/internOrder';

export const mockInternOrders: InternOrder[] = [
  {
    id: 'order-001',
    orderName: 'Weekly Market Stock Replenish',
    description: 'Restock vegetables, fruits, and packaging for the weekend market stall.',
    status: 'pending',
    assignedTo: 'John Doe',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'Admin',
    items: [
      { itemName: 'Carrots', itemQuantity: 10, unit: 'kg' },
      { itemName: 'Apples', itemQuantity: 20, unit: 'kg' },
      { itemName: 'Paper Bags (Large)', itemQuantity: 100, unit: 'pcs' },
    ],
  },
  {
    id: 'order-002',
    orderName: 'Urgent Flour Delivery',
    description: 'Need 50kg of Type 550 flour for special cake production.',
    status: 'in-progress',
    assignedTo: 'Jane Smith',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    updatedAt: new Date().toISOString(),
    createdBy: 'Chef Baker',
    quantity: 50, // Example of using general quantity
    billImageUrl: '/assets/images/stock/flour_bill_example.jpg', // Example path, ensure a placeholder image exists or is fine with a broken link for mock
  },
  {
    id: 'order-003',
    orderName: 'Cleaning Supplies for Bakery',
    description: 'Order standard cleaning supplies - detergent, sponges, paper towels.',
    status: 'done',
    assignedTo: 'Mike Lee',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    createdBy: 'Admin',
    items: [
      { itemName: 'Detergent', itemQuantity: 5, unit: 'bottles' },
      { itemName: 'Sponges', itemQuantity: 10, unit: 'packs' },
    ],
    billImageUrl: '/assets/images/stock/cleaning_bill_example.png', // Example path
  },
  {
    id: 'order-004',
    orderName: 'Packaging for Online Orders',
    description: 'Boxes and bubble wrap for shipping online customer orders.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'Sales Team',
  },
];
