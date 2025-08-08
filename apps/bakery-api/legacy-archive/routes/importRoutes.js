const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/authMiddleware')
const multer = require('multer')
const path = require('path')

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/reports'))
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  },
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true)
    } else {
      cb(new Error('Only JSON files are allowed'))
    }
  },
})

/**
 * @openapi
 * /api/import/daily-report:
 *   post:
 *     summary: Import a single daily report
 *     description: Upload and import a JSON file containing daily sales and production report data
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: JSON file containing daily report data (max 5MB)
 *     responses:
 *       '200':
 *         description: Report imported successfully
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
 *                   example: 'Daily report imported successfully'
 *                 data:
 *                   type: object
 *                   properties:
 *                     reportDate:
 *                       type: string
 *                       format: date
 *                       example: '2025-08-15'
 *                     recordsImported:
 *                       type: integer
 *                       example: 125
 *                     warnings:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ['Product SKU001 not found in catalog']
 *       '400':
 *         description: Invalid file or data format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '413':
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '415':
 *         description: Unsupported media type - Only JSON files are allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/daily-report',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      // TODO: Implement import logic using the import service
      res.json({
        success: true,
        message:
          'Import functionality will be implemented when TypeScript modules are compiled',
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }
)

/**
 * @openapi
 * /api/import/bulk:
 *   post:
 *     summary: Import multiple daily reports
 *     description: Upload and import multiple JSON files containing daily sales and production report data (max 10 files)
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Multiple JSON files containing daily report data (max 10 files, 5MB each)
 *     responses:
 *       '200':
 *         description: Reports imported successfully
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
 *                   example: 'Successfully imported 8 of 10 reports'
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: integer
 *                       description: Total number of files processed
 *                       example: 10
 *                     successfulImports:
 *                       type: integer
 *                       description: Number of files successfully imported
 *                       example: 8
 *                     failedImports:
 *                       type: integer
 *                       description: Number of files that failed to import
 *                       example: 2
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           filename:
 *                             type: string
 *                             example: 'report-2025-08-15.json'
 *                           success:
 *                             type: boolean
 *                             example: true
 *                           reportDate:
 *                             type: string
 *                             format: date
 *                             example: '2025-08-15'
 *                           recordsImported:
 *                             type: integer
 *                             example: 125
 *                           error:
 *                             type: string
 *                             description: Error message if import failed
 *                             example: null
 *                           warnings:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: []
 *       '400':
 *         description: Invalid files or data format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '413':
 *         description: Request entity too large - Too many files or files too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '415':
 *         description: Unsupported media type - Only JSON files are allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/bulk',
  authenticate,
  upload.array('files', 10),
  async (req, res) => {
    try {
      // TODO: Implement bulk import logic using the import service
      res.json({
        success: true,
        message:
          'Bulk import functionality will be implemented when TypeScript modules are compiled',
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  }
)

module.exports = router
