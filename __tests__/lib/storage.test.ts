import { describe, it, expect, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// 动态生成 storage 模块，指向临时目录
async function createStorage() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'htmlpush-storage-'))
  const DATA_DIR = path.join(tempDir, 'data')
  const PAGES_DIR = path.join(DATA_DIR, 'pages')
  const IMAGES_DIR = path.join(DATA_DIR, 'images')
  const CONFIG_FILE = path.join(DATA_DIR, 'config.json')
  const IMAGES_INDEX_FILE = path.join(DATA_DIR, 'images.json')

  const DEFAULT_CONFIG: import('@/lib/types').Config = { currentPageId: null, pages: [], images: [] }
  const DEFAULT_IMAGE_INDEX: import('@/lib/types').ImageIndex = { images: [] }

  async function ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.mkdir(PAGES_DIR, { recursive: true })
    await fs.mkdir(IMAGES_DIR, { recursive: true })
  }

  async function loadImageIndex() {
    await ensureDirs()
    try {
      const raw = await fs.readFile(IMAGES_INDEX_FILE, 'utf-8')
      return JSON.parse(raw) as import('@/lib/types').ImageIndex
    } catch {
      return { ...DEFAULT_IMAGE_INDEX }
    }
  }

  async function saveImageIndex(index: import('@/lib/types').ImageIndex) {
    await ensureDirs()
    await fs.writeFile(IMAGES_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8')
  }

  async function loadConfig() {
    await ensureDirs()
    const imageIndex = await loadImageIndex()
    try {
      const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
      const config = JSON.parse(raw) as import('@/lib/types').Config
      return { ...config, images: imageIndex.images }
    } catch {
      return { ...DEFAULT_CONFIG, images: imageIndex.images }
    }
  }

  async function saveConfig(config: import('@/lib/types').Config) {
    await ensureDirs()
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ currentPageId: config.currentPageId, pages: config.pages }, null, 2), 'utf-8')
    await saveImageIndex({ images: config.images })
  }

  async function addPage(name: string, content: string) {
    const config = await loadConfig()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const filename = `${id}.html`
    const pageInfo: import('@/lib/types').PageInfo = { id, name, filename, uploadedAt: new Date().toISOString() }
    await fs.writeFile(path.join(PAGES_DIR, filename), content, 'utf-8')
    if (!config.images) { config.images = []; }
    config.pages.push(pageInfo)
    if (!config.currentPageId) {
      config.currentPageId = id
    }
    await saveConfig(config)
    return pageInfo
  }

  async function deletePage(id: string) {
    const config = await loadConfig()
    const idx = config.pages.findIndex((p) => p.id === id)
    if (idx === -1) return false
    const page = config.pages[idx]
    try {
      await fs.unlink(path.join(PAGES_DIR, page.filename))
    } catch { /* ignore */ }
    config.pages.splice(idx, 1)
    if (config.currentPageId === id) {
      config.currentPageId = config.pages.length > 0 ? config.pages[0].id : null
    }
    await saveConfig(config)
    return true
  }

  async function setCurrentPage(id: string) {
    const config = await loadConfig()
    if (!config.pages.some((p) => p.id === id)) return false
    config.currentPageId = id
    await saveConfig(config)
    return true
  }

  async function getPageContent(id: string) {
    const config = await loadConfig()
    const page = config.pages.find((p) => p.id === id)
    if (!page) return null
    try {
      return await fs.readFile(path.join(PAGES_DIR, page.filename), 'utf-8')
    } catch {
      return null
    }
  }

  async function getCurrentPageContent() {
    const config = await loadConfig()
    if (!config.currentPageId) return { page: null, content: null }
    const page = config.pages.find((p) => p.id === config.currentPageId)
    if (!page) return { page: null, content: null }
    try {
      const content = await fs.readFile(path.join(PAGES_DIR, page.filename), 'utf-8')
      return { page, content }
    } catch {
      return { page, content: null }
    }
  }

  async function addImage(name: string, content: Buffer, mimeType: string) {
    await ensureDirs()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const ext = mimeType.split('/')[1] || 'png'
    const filename = `${id}.${ext}`
    await fs.writeFile(path.join(IMAGES_DIR, filename), content)
    const page = await addPage(name, `<img src="/api/images/${id}" />`)
    const now = new Date().toISOString()
    const index = await loadImageIndex()
    const image: import('@/lib/types').ImageAsset = {
      id,
      name,
      filename,
      mimeType,
      size: content.byteLength,
      uploadedAt: now,
      updatedAt: now,
      pageId: page.id,
    }
    index.images.push(image)
    await saveImageIndex(index)
    return { image, page }
  }

  async function renameImageAsset(id: string, name: string) {
    const index = await loadImageIndex()
    const image = index.images.find((item) => item.id === id)
    if (!image) return null
    image.name = name
    image.updatedAt = new Date().toISOString()
    await saveImageIndex(index)
    return image
  }

  async function deleteImageAsset(id: string) {
    const index = await loadImageIndex()
    const target = index.images.find((item) => item.id === id)
    if (!target) return false
    index.images = index.images.filter((item) => item.id !== id)
    await saveImageIndex(index)
    await fs.rm(path.join(IMAGES_DIR, target.filename), { force: true })
    if (target.pageId) {
      await deletePage(target.pageId)
    }
    return true
  }

  return {
    loadConfig, saveConfig, addPage, deletePage, setCurrentPage,
    getPageContent, getCurrentPageContent,
    loadImageIndex, saveImageIndex, addImage, renameImageAsset, deleteImageAsset,
    _cleanup: async () => { await fs.rm(tempDir, { recursive: true, force: true }) },
  }
}

describe('storage', () => {
  let storage: Awaited<ReturnType<typeof createStorage>>

  afterEach(async () => {
    if (storage?._cleanup) {
      await storage._cleanup()
    }
  })

  it('loadConfig 目录不存在时返回默认配置', async () => {
    storage = await createStorage()
    const config = await storage.loadConfig()
    expect(config).toEqual({ currentPageId: null, pages: [], images: [] })
  })

  it('saveConfig 写入后可被 loadConfig 读取', async () => {
    storage = await createStorage()
    const newConfig: import('@/lib/types').Config = {
      currentPageId: 'test-id',
      pages: [{ id: 'test-id', name: 'test', filename: 'test.html', uploadedAt: '2024-01-01T00:00:00.000Z' }],
      images: [],
    }
    await storage.saveConfig(newConfig)
    const loaded = await storage.loadConfig()
    expect(loaded).toEqual(newConfig)
  })

  it('addPage 创建页面文件并更新配置', async () => {
    storage = await createStorage()
    const page = await storage.addPage('测试页面', '<html></html>')
    expect(page.name).toBe('测试页面')
    expect(page.filename).toMatch(/\.html$/)
    const config = await storage.loadConfig()
    expect(config.pages).toHaveLength(1)
    expect(config.currentPageId).toBe(page.id)
    const content = await storage.getPageContent(page.id)
    expect(content).toBe('<html></html>')
  })

  it('addPage 已有当前页时不覆盖', async () => {
    storage = await createStorage()
    const page1 = await storage.addPage('页面1', '<html>1</html>')
    await storage.addPage('页面2', '<html>2</html>')
    const config = await storage.loadConfig()
    expect(config.currentPageId).toBe(page1.id)
  })

  it('deletePage 删除存在的页面', async () => {
    storage = await createStorage()
    const page = await storage.addPage('待删除', '<html></html>')
    const result = await storage.deletePage(page.id)
    expect(result).toBe(true)
    const config = await storage.loadConfig()
    expect(config.pages).toHaveLength(0)
  })

  it('deletePage 删除当前页后自动切换到第一个', async () => {
    storage = await createStorage()
    const page1 = await storage.addPage('页面1', '<html>1</html>')
    const page2 = await storage.addPage('页面2', '<html>2</html>')
    await storage.setCurrentPage(page2.id)
    await storage.deletePage(page2.id)
    const config = await storage.loadConfig()
    expect(config.currentPageId).toBe(page1.id)
  })

  it('deletePage 删除不存在的 id 返回 false', async () => {
    storage = await createStorage()
    const result = await storage.deletePage('nonexistent')
    expect(result).toBe(false)
  })

  it('setCurrentPage 切换到存在的页面', async () => {
    storage = await createStorage()
    const page = await storage.addPage('目标页', '<html></html>')
    const result = await storage.setCurrentPage(page.id)
    expect(result).toBe(true)
    const config = await storage.loadConfig()
    expect(config.currentPageId).toBe(page.id)
  })

  it('setCurrentPage 切换到不存在的 id 返回 false', async () => {
    storage = await createStorage()
    const result = await storage.setCurrentPage('nonexistent')
    expect(result).toBe(false)
  })

  it('getPageContent 获取存在的页面内容', async () => {
    storage = await createStorage()
    const page = await storage.addPage('有内容', '<html>hello</html>')
    const content = await storage.getPageContent(page.id)
    expect(content).toBe('<html>hello</html>')
  })

  it('getPageContent 获取不存在的页面返回 null', async () => {
    storage = await createStorage()
    const content = await storage.getPageContent('nonexistent')
    expect(content).toBeNull()
  })

  it('getCurrentPageContent 有当前页返回 page 和 content', async () => {
    storage = await createStorage()
    await storage.addPage('当前页', '<html>current</html>')
    const result = await storage.getCurrentPageContent()
    expect(result.page).not.toBeNull()
    expect(result.content).toBe('<html>current</html>')
  })

  it('getCurrentPageContent 无当前页返回 null', async () => {
    storage = await createStorage()
    const result = await storage.getCurrentPageContent()
    expect(result.page).toBeNull()
    expect(result.content).toBeNull()
  })

  it('addImage 写入图片索引并绑定展示页', async () => {
    storage = await createStorage()
    const { image, page } = await storage.addImage('海报', Buffer.from('image'), 'image/png')
    const index = await storage.loadImageIndex()

    expect(index.images).toHaveLength(1)
    expect(index.images[0].name).toBe('海报')
    expect(index.images[0].pageId).toBe(page.id)
    expect(image.size).toBe(5)
  })

  it('renameImageAsset 更新名称', async () => {
    storage = await createStorage()
    const { image } = await storage.addImage('旧名称', Buffer.from('image'), 'image/png')
    const renamed = await storage.renameImageAsset(image.id, '新名称')

    expect(renamed?.name).toBe('新名称')
  })

  it('deleteImageAsset 删除图片及关联页面', async () => {
    storage = await createStorage()
    const { image, page } = await storage.addImage('待删', Buffer.from('image'), 'image/png')
    const deleted = await storage.deleteImageAsset(image.id)
    const config = await storage.loadConfig()
    const index = await storage.loadImageIndex()

    expect(deleted).toBe(true)
    expect(index.images).toHaveLength(0)
    expect(config.pages.find((item) => item.id === page.id)).toBeUndefined()
  })
})
