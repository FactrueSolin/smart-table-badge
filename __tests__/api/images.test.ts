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
    it('POST /api/images should upload an image and return generated page info', async () => {
      const { addImage } = await import('@/lib/storage')
      const { broadcast } = await import('@/lib/sse')
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
      expect(vi.mocked(broadcast)).toHaveBeenCalledWith(
        'content-changed',
        expect.objectContaining({ action: 'upload', type: 'image', id: 'img-1', pageId: 'page-1' }),
      )
    })

    it('POST /api/images should return 400 when file is missing', async () => {
      const formData = new FormData()

      const request = new NextRequest('http://localhost/api/images', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/images/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('缺少文件')
    })

    it('POST /api/images should reject injected string payload in file field', async () => {
      const formData = new FormData()
      formData.set('file', '<svg onload=alert(1)>')

      const request = new NextRequest('http://localhost/api/images', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/images/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('缺少文件')
    })

    it('POST /api/images should return 415 for unsupported mime type', async () => {
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

    it('POST /api/images should return 413 when uploaded image exceeds size limit', async () => {
      const formData = new FormData()
      const oversized = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' })
      formData.set('file', oversized, 'huge.png')

      const request = new NextRequest('http://localhost/api/images', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/images/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data.error).toBe('图片大小不能超过 10MB')
    })

    it('POST /api/images should return 500 when storage layer throws', async () => {
      const { addImage } = await import('@/lib/storage')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const storageError = new Error('write failed')
      vi.mocked(addImage).mockRejectedValue(storageError)

      const formData = new FormData()
      formData.set('file', new Blob(['image'], { type: 'image/png' }), 'cover.png')

      const request = new NextRequest('http://localhost/api/images', {
        method: 'POST',
        body: formData,
      })

      const { POST } = await import('@/app/api/images/route')
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('上传失败')
      expect(consoleErrorSpy).toHaveBeenCalledWith('[api/images] upload failed', storageError)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('DELETE /api/images', () => {
    it('DELETE /api/images should delete image ids in batch', async () => {
      const { deleteImageAssets } = await import('@/lib/storage')
      const { broadcast } = await import('@/lib/sse')
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
      expect(vi.mocked(broadcast)).toHaveBeenCalledWith(
        'content-changed',
        expect.objectContaining({ action: 'delete', type: 'image', ids: ['img-1', 'img-2'] }),
      )
    })

    it('DELETE /api/images should return 400 when ids are missing', async () => {
      const request = new NextRequest('http://localhost/api/images', {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      const { DELETE } = await import('@/app/api/images/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('缺少待删除的图片 ID')
    })

    it('DELETE /api/images should reject injected non-string ids', async () => {
      const request = new NextRequest('http://localhost/api/images', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [{ $gt: '' }] }),
        headers: { 'Content-Type': 'application/json' },
      })

      const { DELETE } = await import('@/app/api/images/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('缺少待删除的图片 ID')
    })

    it('DELETE /api/images should return 400 for malformed json body', async () => {
      const request = new NextRequest('http://localhost/api/images', {
        method: 'DELETE',
        body: '{"ids":',
        headers: { 'Content-Type': 'application/json' },
      })

      const { DELETE } = await import('@/app/api/images/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('请求参数错误')
    })

    it('DELETE /api/images should return 500 when storage layer throws', async () => {
      const { deleteImageAssets } = await import('@/lib/storage')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const storageError = new Error('unlink failed')
      vi.mocked(deleteImageAssets).mockRejectedValue(storageError)

      const request = new NextRequest('http://localhost/api/images', {
        method: 'DELETE',
        body: JSON.stringify({ ids: ['img-1'] }),
        headers: { 'Content-Type': 'application/json' },
      })

      const { DELETE } = await import('@/app/api/images/route')
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('批量删除失败')
      expect(consoleErrorSpy).toHaveBeenCalledWith('[api/images] batch delete failed', storageError)

      consoleErrorSpy.mockRestore()
    })
  })
})

describe('API: /api/images/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('GET /api/images/[id] should return binary image content with cache headers', async () => {
    const { getImageContent } = await import('@/lib/storage')
    vi.mocked(getImageContent).mockResolvedValue({
      buffer: Buffer.from('png'),
      mimeType: 'image/png',
    })

    const request = new NextRequest('http://localhost/api/images/img-1')
    const { GET } = await import('@/app/api/images/[id]/route')
    const response = await GET(request, { params: Promise.resolve({ id: 'img-1' }) })
    const binary = new Uint8Array(await response.arrayBuffer())

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toContain('immutable')
    expect(Array.from(binary)).toEqual(Array.from(Buffer.from('png')))
  })

  it('GET /api/images/[id] should return 404 when image content is missing', async () => {
    const { getImageContent } = await import('@/lib/storage')
    vi.mocked(getImageContent).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/images/missing')
    const { GET } = await import('@/app/api/images/[id]/route')
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) })

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('图片不存在')
  })

  it('PATCH /api/images/[id] should rename image successfully', async () => {
    const { renameImageAsset } = await import('@/lib/storage')
    const { broadcast } = await import('@/lib/sse')
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
    expect(vi.mocked(broadcast)).toHaveBeenCalledWith(
      'content-changed',
      expect.objectContaining({ action: 'rename', type: 'image', id: 'img-1' }),
    )
  })

  it('PATCH /api/images/[id] should return 400 when name is blank', async () => {
    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { PATCH } = await import('@/app/api/images/[id]/route')
    const response = await PATCH(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('缺少图片名称')
  })

  it('PATCH /api/images/[id] should reject injected non-string name payload', async () => {
    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: { $regex: '.*' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { PATCH } = await import('@/app/api/images/[id]/route')
    const response = await PATCH(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('缺少图片名称')
  })

  it('PATCH /api/images/[id] should return 400 for malformed json body', async () => {
    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      body: '{"name":',
      headers: { 'Content-Type': 'application/json' },
    })

    const { PATCH } = await import('@/app/api/images/[id]/route')
    const response = await PATCH(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('请求参数错误')
  })

  it('PATCH /api/images/[id] should return 404 when image does not exist', async () => {
    const { renameImageAsset } = await import('@/lib/storage')
    vi.mocked(renameImageAsset).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '新名称' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { PATCH } = await import('@/app/api/images/[id]/route')
    const response = await PATCH(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('图片不存在')
  })

  it('PATCH /api/images/[id] should return 500 when rename fails unexpectedly', async () => {
    const { renameImageAsset } = await import('@/lib/storage')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const renameError = new Error('rename failed')
    vi.mocked(renameImageAsset).mockRejectedValue(renameError)

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '新名称' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { PATCH } = await import('@/app/api/images/[id]/route')
    const response = await PATCH(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('重命名失败')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[api/images/:id] rename failed', renameError)

    consoleErrorSpy.mockRestore()
  })

  it('DELETE /api/images/[id] should delete a single image', async () => {
    const { getImageAsset, deleteImageAsset } = await import('@/lib/storage')
    const { broadcast } = await import('@/lib/sse')
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
    expect(data.id).toBe('img-1')
    expect(vi.mocked(broadcast)).toHaveBeenCalledWith(
      'content-changed',
      expect.objectContaining({ action: 'delete', type: 'image', id: 'img-1', pageId: 'page-1' }),
    )
  })

  it('DELETE /api/images/[id] should return 404 when image does not exist', async () => {
    const { getImageAsset } = await import('@/lib/storage')
    vi.mocked(getImageAsset).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/images/missing', {
      method: 'DELETE',
    })

    const { DELETE } = await import('@/app/api/images/[id]/route')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'missing' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('图片不存在')
  })

  it('DELETE /api/images/[id] should return 500 when deletion fails unexpectedly', async () => {
    const { getImageAsset, deleteImageAsset } = await import('@/lib/storage')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const deleteError = new Error('unlink failed')
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
    vi.mocked(deleteImageAsset).mockRejectedValue(deleteError)

    const request = new NextRequest('http://localhost/api/images/img-1', {
      method: 'DELETE',
    })

    const { DELETE } = await import('@/app/api/images/[id]/route')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'img-1' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('删除失败')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[api/images/:id] delete failed', deleteError)

    consoleErrorSpy.mockRestore()
  })
})
