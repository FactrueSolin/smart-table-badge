import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/storage')
vi.mock('@/lib/sse')

describe('API: /api/pages/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('GET /api/pages/[id] should return html content for an existing page', async () => {
    const { getPageContent } = await import('@/lib/storage')
    vi.mocked(getPageContent).mockResolvedValue('<!DOCTYPE html><html><body>Hello</body></html>')

    const request = new NextRequest('http://localhost/api/pages/page-1')
    const { GET } = await import('@/app/api/pages/[id]/route')
    const response = await GET(request, { params: Promise.resolve({ id: 'page-1' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('<body>Hello</body>')
  })

  it('GET /api/pages/[id] should return 404 when page does not exist', async () => {
    const { getPageContent } = await import('@/lib/storage')
    vi.mocked(getPageContent).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/pages/missing')
    const { GET } = await import('@/app/api/pages/[id]/route')
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('页面不存在')
  })

  it('DELETE /api/pages/[id] should delete page and broadcast change', async () => {
    const { deletePage } = await import('@/lib/storage')
    const { broadcast } = await import('@/lib/sse')
    vi.mocked(deletePage).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/pages/page-1', {
      method: 'DELETE',
    })

    const { DELETE } = await import('@/app/api/pages/[id]/route')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'page-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ deleted: true, id: 'page-1' })
    expect(vi.mocked(broadcast)).toHaveBeenCalledWith(
      'content-changed',
      expect.objectContaining({ action: 'delete', pageId: 'page-1' }),
    )
  })

  it('DELETE /api/pages/[id] should return 404 when page does not exist', async () => {
    const { deletePage } = await import('@/lib/storage')
    vi.mocked(deletePage).mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/pages/missing', {
      method: 'DELETE',
    })

    const { DELETE } = await import('@/app/api/pages/[id]/route')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'missing' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('页面不存在')
  })
})
