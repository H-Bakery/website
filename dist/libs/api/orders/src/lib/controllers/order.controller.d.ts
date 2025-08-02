import { Request, Response } from 'express'
interface OrderRequestBody {
  customerName: string
  customerPhone?: string
  customerEmail?: string
  pickupDate: Date
  status?: string
  notes?: string
  items: Array<{
    productId: string
    productName: string
    quantity: number
    unitPrice: number
  }>
  totalPrice: number
}
export declare class OrderController {
  static getOrders(req: Request, res: Response): Promise<void>
  static getOrder(req: Request, res: Response): Promise<void>
  static createOrder(
    req: Request<{}, {}, OrderRequestBody>,
    res: Response
  ): Promise<void>
  static updateOrder(
    req: Request<
      {
        id: string
      },
      {},
      OrderRequestBody
    >,
    res: Response
  ): Promise<void>
  static deleteOrder(
    req: Request<{
      id: string
    }>,
    res: Response
  ): Promise<void>
}
export {}
