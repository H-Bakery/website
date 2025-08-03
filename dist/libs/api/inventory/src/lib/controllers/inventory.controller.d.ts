import { Request, Response } from 'express';
export declare class InventoryController {
    private static inventoryService;
    static createInventoryItem(req: Request, res: Response): Promise<void>;
    static getInventoryItems(req: Request, res: Response): Promise<void>;
    static getInventoryItem(req: Request, res: Response): Promise<void>;
    static updateInventoryItem(req: Request, res: Response): Promise<void>;
    static adjustStock(req: Request, res: Response): Promise<void>;
    static deleteInventoryItem(req: Request, res: Response): Promise<void>;
    static getItemsNeedingReorder(req: Request, res: Response): Promise<void>;
    static getLowStockItems(req: Request, res: Response): Promise<void>;
    static bulkAdjustStock(req: Request, res: Response): Promise<void>;
}
