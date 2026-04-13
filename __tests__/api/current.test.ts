import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/storage')
vi.mock('@/lib/sse')
vi.mock('@/lib/auth')

describe('API: /api/current', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('GET /api/current', () => {
    it('有当前页返回 page 和 content', async () => {
      const { getCurrentPageContent } = await import('@/lib/storage')
      vi.mocked(getCurrentPageContent).mockResolvedValue({
        page: { id: '1', name: 'page1', filename: '1.html', uploadedAt: '2024-01-01' },
        content: '<html></html>',
      })

      const { GET } = await import('@/app/api/current/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.page).not.toBeNull()
      expect(data.content).toBe('<html></html>')
    })

    it('无当前页返回 null', async () => {
      const { getCurrentPageContent } = await import('@/lib/storage')
      vi.mocked(getCurrentPageContent).mockResolvedValue({ page: null, content: null })

      const { GET } = await import('@/app/api/current/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.page).toBeNull()
    })
  })

  describe('PUT /api/current', () => {
    it('Cookie 鉴权成功切换页面返回 200', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(true)

      const { setCurrentPage } = await import('@/lib/storage')
      vi.mocked(setCurrentPage).mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/current', {
        method: 'PUT',
        body: JSON.stringify({ pageId: '1' }),
      })

      const { PUT } = await import('@/app/api/current/route')
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.pageId).toBe('1')
    })

    it('Bearer Token 鉴权成功切换页面返回 200', async () => {
      const { isAuthenticated, isValidCurrentPageApiToken } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(false)
      vi.mocked(isValidCurrentPageApiToken).mockReturnValue(true)

      const { setCurrentPage } = await import('@/lib/storage')
      vi.mocked(setCurrentPage).mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/current', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ pageId: '1' }),
      })

      const { PUT } = await import('@/app/api/current/route')
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.pageId).toBe('1')
    })

    it('未授权返回 401', async () => {
      const { isAuthenticated, isValidCurrentPageApiToken } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(false)
      vi.mocked(isValidCurrentPageApiToken).mockReturnValue(false)

      const request = new NextRequest('http://localhost/api/current', {
        method: 'PUT',
        body: JSON.stringify({ pageId: '1' }),
      })

      const { PUT } = await import('@/app/api/current/route')
      const response = await PUT(request)

      expect(response.status).toBe(401)
    })

    it('缺少 pageId 返回 400', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/current', {
        method: 'PUT',
        body: JSON.stringify({}),
      })

      const { PUT } = await import('@/app/api/current/route')
      const response = await PUT(request)

      expect(response.status).toBe(400)
    })

    it('页面不存在返回 404', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(true)

      const { setCurrentPage } = await import('@/lib/storage')
      vi.mocked(setCurrentPage).mockResolvedValue(false)

      const request = new NextRequest('http://localhost/api/current', {
        method: 'PUT',
        body: JSON.stringify({ pageId: 'nonexistent' }),
      })

      const { PUT } = await import('@/app/api/current/route')
      const response = await PUT(request)

      expect(response.status).toBe(404)
    })
  })
})
