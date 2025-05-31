export interface InternOrder {
  id: string;
  orderName: string; // e.g., "Market Order KW32", "Deliverer Supplies"
  description: string; // More details about the order
  quantity?: number; // Optional: General quantity if items are not broken down
  items?: Array<{ // Optional: For orders with multiple distinct items
    itemName: string;
    itemQuantity: number;
    unit?: string; // e.g., kg, pcs, box
  }>;
  status: 'pending' | 'in-progress' | 'done' | 'cancelled';
  assignedTo?: string; // Name or ID of the person/role responsible
  billImageUrl?: string; // URL to the uploaded bill image
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  createdBy?: string; // Name or ID of the creator
}
