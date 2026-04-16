import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/storage')
vi.mock('@/lib/sse')

describe('API: /api/images', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('GET /api/images', () => {
    it('返回按时间排序的图片列表', async () => {
      const { listImages } = await import('@/lib/storage')
      vi.mocked(listImages).mockResolvedValue([
        {
          id: 'img-1',
          name: '海报',
          filename: 'img-1.png',
          mimeType: 'image/png',
          size: 123,
          uploadedAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          pageId: 'page-1',
        },
      ])

      const { GET } = await import('@/app/api/images/route')
      const response = await GET(new NextRequest('http://localhost/api/images?sort=uploadedAt-desc'))
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(vi.mocked(listImages)).toHaveBeenCalledWith('desc')
      expect(data[0].imageUrl).toBe('/api/images/img-1')
      expect(data[0].pageUrl).toBe('/api/pages/page-1')
    })
  })

  describe('POST /api/images', () => {
    it('上传图片成功', async () => {
      const { addImage } = await import('@/lib/storage')
      vi.mocked(addImage).mockResolvedValue({
        image: {
          id: 'img-1',
          name: '封面',
          filename: 'img-1.png',
          mimeType: 'image/png',
          size: 456,
          uploadedAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          pageId: 'page-1',
        },
        page: {
          id: 'page-1',
          name: '封面',
          filename: 'page-1.html',
          uploadedAt: '2024-01-01T00:00:00.000Z',
        },
      })

      const formData = new FormData()
      formData.set('file', new Blob(['image'], { type: 'image/png' }), 'cover.png')
      formData.set('name', '封面')

      const request = new NextRequest('http://localhost/api/images', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/images/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.image.name).toBe('封面')
      expect(data.image.imageUrl).toBe('/api/images/img-1')
    })

    it('格式不支持时返回 415', async () => {
      const formData = new FormData()
      formData.set('file', new Blob(['txt'], { type: 'text/plain' }), 'x.txt')

      const request = new NextRequest('http://localhost/api/images', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/images/route')
      const response = await POST(request)

      expect(response.status).toBe(415)
    })
  })

  describe('DELETE /api/images', () => {
    it('批量删除图片', async () => {
      const { deleteImageAssets } = await import('@/lib/storage')
      vi.mocked(deleteImageAssets).mockResolvedValue(['img-1', 'img-2'])

      const request = new NextRequest('http://localhost/api/images', {
        method: 'DELETE',
        body: JSON.stringify({ ids: ['img-1', 'img-2'] }),
        headers: { 'Content-Type': 'application/json' },
      })

      const { DELETE } = await import('@/app/api/images/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.deletedIds).toEqual(['img-1', 'img-2'])
    })
  })
})

describe('API: /api/images/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('PATCH 重命名图片', async () => {
    const { renameImageAsset } = await import('@/lib/storage')
    vi.mocked(renameImageAsset).mockResolvedValue({
      id: 'img-1',
      name: '新名称',
      filename: 'img-1.png',
      mimeType: 'image/png',
      size: 12,
      uploadedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      pageId: 'page-1',
    })

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '新名称' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { PATCH } = await import('@/app/api/images/[id]/route')
    const response = await PATCH(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.name).toBe('新名称')
    expect(data.imageUrl).toBe('/api/images/img-1')
    expect(data.pageUrl).toBe('/api/pages/page-1')
  })

  it('DELETE 删除单张图片', async () => {
    const { getImageAsset, deleteImageAsset } = await import('@/lib/storage')
    vi.mocked(getImageAsset).mockResolvedValue({
      id: 'img-1',
      name: '图片',
      filename: 'img-1.png',
      mimeType: 'image/png',
      size: 12,
      uploadedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      pageId: 'page-1',
    })
    vi.mocked(deleteImageAsset).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'DELETE',
    })

    const { DELETE } = await import('@/app/api/images/[id]/route')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deleted).toBe(true)
  })
})
