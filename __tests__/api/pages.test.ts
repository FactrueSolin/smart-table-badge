import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/storage')
vi.mock('@/lib/sse')

describe('API: /api/pages', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('GET /api/pages', () => {
    it('返回页面列表', async () => {
      const { loadConfig } = await import('@/lib/storage')
      vi.mocked(loadConfig).mockResolvedValue({
        currentPageId: '1',
        pages: [
          { id: '1', name: 'page1', filename: '1.html', uploadedAt: '2024-01-01' },
        ],
      })

      const { GET } = await import('@/app/api/pages/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('page1')
    })
  })

  describe('POST /api/pages', () => {
    it('上传文件创建页面', async () => {
      const { addPage } = await import('@/lib/storage')
      vi.mocked(addPage).mockResolvedValue({
        id: 'new-id',
        name: 'test.html',
        filename: 'new-id.html',
        uploadedAt: '2024-01-01',
      })

      const formData = new FormData()
      formData.set('file', new Blob(['<html></html>'], { type: 'text/html' }), 'test.html')

      const request = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/pages/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.id).toBe('new-id')
    })

    it('缺少文件返回 400', async () => {
      const formData = new FormData()
      const request = new NextRequest('http://localhost/api/pages', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/pages/route')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })
})
