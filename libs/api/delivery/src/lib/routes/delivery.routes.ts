/**
 * Delivery routes with OpenAPI documentation
 */

import { Router } from 'express';
import { deliveryController } from '../controllers/delivery.controller';

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     DeliveryAddress:
 *       type: object
 *       required:
 *         - street
 *         - houseNumber
 *         - postalCode
 *         - city
 *       properties:
 *         street:
 *           type: string
 *           example: 'Main Street'
 *         houseNumber:
 *           type: string
 *           example: '123'
 *         postalCode:
 *           type: string
 *           example: '10001'
 *         city:
 *           type: string
 *           example: 'New York'
 *         country:
 *           type: string
 *           example: 'USA'
 *         notes:
 *           type: string
 *           example: 'Ring bell twice'
 *     
 *     Delivery:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         orderId:
 *           type: integer
 *           example: 42
 *         driverId:
 *           type: integer
 *           example: 5
 *         deliveryAddress:
 *           $ref: '#/components/schemas/DeliveryAddress'
 *         deliveryDate:
 *           type: string
 *           format: date
 *           example: '2025-08-04'
 *         deliveryTime:
 *           type: string
 *           example: '14:00-16:00'
 *         status:
 *           type: string
 *           enum: [pending, assigned, in_transit, delivered, failed, cancelled]
 *           example: 'pending'
 *         estimatedArrival:
 *           type: string
 *           format: date-time
 *           example: '2025-08-04T15:30:00Z'
 *         actualDeliveryTime:
 *           type: string
 *           format: date-time
 *           example: '2025-08-04T15:45:00Z'
 *         deliveryFee:
 *           type: number
 *           example: 3.50
 *         trackingCode:
 *           type: string
 *           example: 'DLV-ABC123-XYZ789'
 *         attempts:
 *           type: integer
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     CreateDeliveryRequest:
 *       type: object
 *       required:
 *         - orderId
 *         - deliveryAddress
 *         - deliveryDate
 *         - deliveryTime
 *       properties:
 *         orderId:
 *           type: integer
 *           example: 42
 *         deliveryAddress:
 *           $ref: '#/components/schemas/DeliveryAddress'
 *         deliveryDate:
 *           type: string
 *           format: date
 *           example: '2025-08-04'
 *         deliveryTime:
 *           type: string
 *           example: '14:00-16:00'
 *         deliveryNotes:
 *           type: string
 *           example: 'Handle with care'
 *         deliveryFee:
 *           type: number
 *           example: 3.50
 *     
 *     UpdateDeliveryRequest:
 *       type: object
 *       properties:
 *         driverId:
 *           type: integer
 *           example: 5
 *         status:
 *           type: string
 *           enum: [pending, assigned, in_transit, delivered, failed, cancelled]
 *         estimatedArrival:
 *           type: string
 *           format: date-time
 *         actualDeliveryTime:
 *           type: string
 *           format: date-time
 *         deliveryNotes:
 *           type: string
 *         customerSignature:
 *           type: string
 *         deliveryPhoto:
 *           type: string
 *         failureReason:
 *           type: string
 *     
 *     DeliveryStats:
 *       type: object
 *       properties:
 *         totalDeliveries:
 *           type: integer
 *           example: 150
 *         pendingDeliveries:
 *           type: integer
 *           example: 25
 *         completedDeliveries:
 *           type: integer
 *           example: 120
 *         failedDeliveries:
 *           type: integer
 *           example: 5
 *         averageDeliveryTime:
 *           type: number
 *           description: Average delivery time in minutes
 *           example: 42
 *         totalRevenue:
 *           type: number
 *           example: 525.50
 *         activeDrivers:
 *           type: integer
 *           example: 8
 *         deliveriesByZone:
 *           type: object
 *           additionalProperties:
 *             type: integer
 *           example:
 *             "City Center": 45
 *             "North": 30
 *             "South": 25
 *     
 *     RouteOptimizationResult:
 *       type: object
 *       properties:
 *         routes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               driverId:
 *                 type: integer
 *               deliveries:
 *                 type: array
 *                 items:
 *                   type: integer
 *               totalDistance:
 *                 type: number
 *               estimatedDuration:
 *                 type: number
 *         totalDistance:
 *           type: number
 *           example: 125.5
 *         totalDuration:
 *           type: number
 *           example: 480
 *         unassignedDeliveries:
 *           type: array
 *           items:
 *             type: integer
 *         efficiency:
 *           type: number
 *           example: 92.5
 */

/**
 * @openapi
 * /api/deliveries:
 *   get:
 *     summary: Get all deliveries
 *     description: Retrieve a list of deliveries with optional filtering
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, assigned, in_transit, delivered, failed, cancelled]
 *         description: Filter by delivery status
 *       - in: query
 *         name: driverId
 *         schema:
 *           type: integer
 *         description: Filter by driver ID
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by delivery date
 *     responses:
 *       '200':
 *         description: Successfully retrieved deliveries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 42
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Delivery'
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/', deliveryController.getDeliveries);

/**
 * @openapi
 * /api/deliveries/stats:
 *   get:
 *     summary: Get delivery statistics
 *     description: Retrieve delivery statistics with optional date filter
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Get statistics for specific date
 *     responses:
 *       '200':
 *         description: Successfully retrieved statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DeliveryStats'
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/stats', deliveryController.getDeliveryStats);

/**
 * @openapi
 * /api/deliveries/routes/{date}:
 *   get:
 *     summary: Get optimized delivery routes
 *     description: Get optimized delivery routes for a specific date
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date for route optimization
 *       - in: query
 *         name: driverId
 *         schema:
 *           type: integer
 *         description: Specific driver ID
 *       - in: query
 *         name: strategy
 *         schema:
 *           type: string
 *           enum: [distance, time, balanced]
 *         description: Optimization strategy
 *     responses:
 *       '200':
 *         description: Successfully optimized routes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RouteOptimizationResult'
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/routes/:date', deliveryController.getOptimizedRoutes);

/**
 * @openapi
 * /api/deliveries/by-date/{date}:
 *   get:
 *     summary: Get deliveries by date
 *     description: Retrieve all deliveries for a specific date
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Delivery date
 *     responses:
 *       '200':
 *         description: Successfully retrieved deliveries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Delivery'
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/by-date/:date', deliveryController.getDeliveriesByDate);

/**
 * @openapi
 * /api/deliveries/by-driver/{driverId}:
 *   get:
 *     summary: Get deliveries by driver
 *     description: Retrieve all deliveries assigned to a specific driver
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Driver ID
 *     responses:
 *       '200':
 *         description: Successfully retrieved deliveries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Delivery'
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/by-driver/:driverId', deliveryController.getDeliveriesByDriver);

/**
 * @openapi
 * /api/deliveries/{id}:
 *   get:
 *     summary: Get delivery by ID
 *     description: Retrieve specific delivery details
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Delivery ID
 *     responses:
 *       '200':
 *         description: Successfully retrieved delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Delivery'
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Delivery not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:id', deliveryController.getDeliveryById);

/**
 * @openapi
 * /api/deliveries:
 *   post:
 *     summary: Create new delivery
 *     description: Create a new delivery from an order
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDeliveryRequest'
 *     responses:
 *       '201':
 *         description: Delivery created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Delivery created successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Delivery'
 *       '400':
 *         description: Bad request - Missing required fields
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.post('/', deliveryController.createDelivery);

/**
 * @openapi
 * /api/deliveries/{id}:
 *   put:
 *     summary: Update delivery
 *     description: Update delivery status and details
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Delivery ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDeliveryRequest'
 *     responses:
 *       '200':
 *         description: Delivery updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Delivery updated successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Delivery'
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Delivery not found
 *       '500':
 *         description: Internal server error
 */
router.put('/:id', deliveryController.updateDelivery);

/**
 * @openapi
 * /api/deliveries/{id}/assign:
 *   put:
 *     summary: Assign driver to delivery
 *     description: Assign a driver to handle the delivery
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Delivery ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - driverId
 *             properties:
 *               driverId:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       '200':
 *         description: Driver assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 'Driver assigned successfully'
 *                 data:
 *                   $ref: '#/components/schemas/Delivery'
 *       '400':
 *         description: Bad request - Driver not available
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Delivery or driver not found
 *       '500':
 *         description: Internal server error
 */
router.put('/:id/assign', deliveryController.assignDriver);

/**
 * @openapi
 * /api/deliveries/{id}/track:
 *   get:
 *     summary: Track delivery
 *     description: Get real-time tracking information for a delivery
 *     tags: [Deliveries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Delivery ID
 *     responses:
 *       '200':
 *         description: Successfully retrieved tracking information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     deliveryId:
 *                       type: integer
 *                     trackingCode:
 *                       type: string
 *                     status:
 *                       type: string
 *                     driverName:
 *                       type: string
 *                     driverPhone:
 *                       type: string
 *                     estimatedArrival:
 *                       type: string
 *                       format: date-time
 *                     updates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                           notes:
 *                             type: string
 *       '404':
 *         description: Delivery not found
 *       '500':
 *         description: Internal server error
 */
router.get('/:id/track', deliveryController.trackDelivery);

/**
 * @openapi
 * /api/delivery-zones:
 *   get:
 *     summary: Get delivery zones
 *     description: Retrieve all active delivery zones
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Successfully retrieved delivery zones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       deliveryFee:
 *                         type: number
 *                       estimatedMinutes:
 *                         type: integer
 *                       maxRadius:
 *                         type: number
 *                       isActive:
 *                         type: boolean
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */
router.get('/zones', deliveryController.getDeliveryZones);

export { router as deliveryRoutes };