import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReadableStreamDefaultController } from 'node:stream/web'

describe('sse', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  function createMockController() {
    return {
      enqueue: vi.fn(),
      close: vi.fn(),
      error: vi.fn(),
    } as unknown as ReadableStreamDefaultController
  }

  describe('addClient', () => {
    it('返回唯一 id', async () => {
      const { addClient } = await import('@/lib/sse')
      const id1 = addClient(createMockController())
      const id2 = addClient(createMockController())
      expect(id1).not.toBe(id2)
    })
  })

  describe('removeClient', () => {
    it('移除后 count 减少', async () => {
      const { addClient, removeClient, getClientCount } = await import('@/lib/sse')
      const id = addClient(createMockController())
      expect(getClientCount()).toBe(1)
      removeClient(id)
      expect(getClientCount()).toBe(0)
    })
  })

  describe('broadcast', () => {
    it('向所有客户端发送消息', async () => {
      const { addClient, broadcast } = await import('@/lib/sse')
      const ctrl = createMockController()
      addClient(ctrl)
      broadcast('test-event', { foo: 'bar' })
      expect(ctrl.enqueue).toHaveBeenCalled()
    })

    it('跳过已关闭的连接', async () => {
      const { addClient, broadcast, getClientCount } = await import('@/lib/sse')
      const ctrl = createMockController()
      vi.mocked(ctrl.enqueue).mockImplementation(() => {
        throw new Error('closed')
      })
      addClient(ctrl)
      broadcast('test-event', { data: 1 })
      // 异常连接应被清理
      expect(getClientCount()).toBe(0)
    })
  })

  describe('getClientCount', () => {
    it('准确计数', async () => {
      const { addClient, removeClient, getClientCount } = await import('@/lib/sse')
      expect(getClientCount()).toBe(0)
      const id1 = addClient(createMockController())
      expect(getClientCount()).toBe(1)
      const id2 = addClient(createMockController())
      expect(getClientCount()).toBe(2)
      removeClient(id1)
      removeClient(id2)
      expect(getClientCount()).toBe(0)
    })
  })
})
