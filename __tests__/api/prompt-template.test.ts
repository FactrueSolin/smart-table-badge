import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth')

describe('API: /api/prompt-template', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('GET /api/prompt-template', () => {
    it('未认证返回 401', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(false)

      const { GET } = await import('@/app/api/prompt-template/route')
      const response = await GET()

      expect(response.status).toBe(401)
    })

    it('认证成功返回模板内容', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(true)

      const { GET } = await import('@/app/api/prompt-template/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toBeDefined()
    })
  })

  describe('PUT /api/prompt-template', () => {
    it('未认证返回 401', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(false)

      const request = new NextRequest('http://localhost/api/prompt-template', {
        method: 'PUT',
        body: JSON.stringify({ content: 'new template' }),
      })

      const { PUT } = await import('@/app/api/prompt-template/route')
      const response = await PUT(request)

      expect(response.status).toBe(401)
    })

    it('认证成功保存模板', async () => {
      const { isAuthenticated } = await import('@/lib/auth')
      vi.mocked(isAuthenticated).mockResolvedValue(true)

      const request = new NextRequest('http://localhost/api/prompt-template', {
        method: 'PUT',
        body: JSON.stringify({ content: 'new template content' }),
      })

      const { PUT } = await import('@/app/api/prompt-template/route')
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
