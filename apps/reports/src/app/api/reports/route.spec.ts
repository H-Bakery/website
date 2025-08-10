/**
 * Unit tests for reports list API route
 */

import { NextRequest } from 'next/server'
import { GET } from './route'
import * as fs from 'fs/promises'
import * as path from 'path'

// Mock fs module
jest.mock('fs/promises')
jest.mock('path')

describe('GET /api/reports', () => {
  const mockFs = fs as jest.Mocked<typeof fs>
  const mockPath = path as jest.Mocked<typeof path>

  beforeEach(() => {
    jest.clearAllMocks()
    // Default path.resolve behavior
    mockPath.resolve.mockImplementation((...args) => args.join('/'))
    mockPath.join.mockImplementation((...args) => args.join('/'))
  })

  it('should return list of reports successfully', async () => {
    // Mock directory access
    mockFs.access.mockResolvedValueOnce(undefined)

    // Mock directory listing
    mockFs.readdir.mockResolvedValueOnce([
      '2025-07-12_50779225.json',
      '2025-07-11_50779225.json',
      'invalid-file.txt',
      'malformed.json',
    ] as any)

    // Mock file stats
    mockFs.stat.mockImplementation((filePath: any) => {
      if (filePath.includes('2025-07-12')) {
        return Promise.resolve({ size: 12345 } as any)
      }
      if (filePath.includes('2025-07-11')) {
        return Promise.resolve({ size: 11000 } as any)
      }
      return Promise.resolve({ size: 0 } as any)
    })

    // Mock file content for first file
    mockFs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        transactions: new Array(110),
        daily_summary: { total_revenue: 3157.25 },
      })
    )

    const request = new NextRequest('http://localhost:3000/api/reports')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.reports).toHaveLength(2)
    expect(data.data.reports[0]).toMatchObject({
      date: '2025-07-12',
      filename: '2025-07-12_50779225.json',
      filesize: 12345,
      transaction_count: 110,
      total_revenue: 3157.25,
    })
  })

  it('should filter by date range', async () => {
    mockFs.access.mockResolvedValueOnce(undefined)
    mockFs.readdir.mockResolvedValueOnce([
      '2025-07-15_50779225.json',
      '2025-07-12_50779225.json',
      '2025-07-10_50779225.json',
      '2025-07-08_50779225.json',
    ] as any)
    mockFs.stat.mockResolvedValue({ size: 10000 } as any)

    const request = new NextRequest(
      'http://localhost:3000/api/reports?startDate=2025-07-10&endDate=2025-07-12'
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.reports).toHaveLength(2)
    expect(data.data.reports.map((r: any) => r.date)).toEqual([
      '2025-07-12',
      '2025-07-10',
    ])
  })

  it('should handle missing reports directory', async () => {
    // Both paths fail
    mockFs.access.mockRejectedValue(new Error('Directory not found'))

    const request = new NextRequest('http://localhost:3000/api/reports')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.success).toBe(false)
    expect(data.message).toBe('Reports directory not found')
  })

  it('should handle alternative path when primary fails', async () => {
    // First path fails, second succeeds
    mockFs.access
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce(undefined)

    mockFs.readdir.mockResolvedValueOnce(['2025-07-12_50779225.json'] as any)
    mockFs.stat.mockResolvedValue({ size: 10000 } as any)

    const request = new NextRequest('http://localhost:3000/api/reports')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockFs.access).toHaveBeenCalledTimes(2)
  })

  it('should handle file read errors gracefully', async () => {
    mockFs.access.mockResolvedValueOnce(undefined)
    mockFs.readdir.mockResolvedValueOnce(['2025-07-12_50779225.json'] as any)
    mockFs.stat.mockResolvedValue({ size: 10000 } as any)
    mockFs.readFile.mockRejectedValueOnce(new Error('Read error'))

    const request = new NextRequest('http://localhost:3000/api/reports')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Should still return the report but without transaction count/revenue
    expect(data.data.reports[0].transaction_count).toBeUndefined()
    expect(data.data.reports[0].total_revenue).toBeUndefined()
  })

  it('should sort reports by date descending', async () => {
    mockFs.access.mockResolvedValueOnce(undefined)
    mockFs.readdir.mockResolvedValueOnce([
      '2025-07-10_50779225.json',
      '2025-07-15_50779225.json',
      '2025-07-12_50779225.json',
    ] as any)
    mockFs.stat.mockResolvedValue({ size: 10000 } as any)

    const request = new NextRequest('http://localhost:3000/api/reports')
    const response = await GET(request)
    const data = await response.json()

    expect(data.data.reports.map((r: any) => r.date)).toEqual([
      '2025-07-15',
      '2025-07-12',
      '2025-07-10',
    ])
  })
})