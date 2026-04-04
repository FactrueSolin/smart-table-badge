import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('auth', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('verifyPassword', () => {
    it('正确密码返回 true', async () => {
      vi.stubEnv('ADMIN_PASSWORD', 'secret123')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('secret123', 'secret123')).toBe(true)
    })

    it('错误密码返回 false', async () => {
      vi.stubEnv('ADMIN_PASSWORD', 'secret123')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('wrong', 'secret123')).toBe(false)
    })

    it('长度不同返回 false', async () => {
      vi.stubEnv('ADMIN_PASSWORD', 'abc')
      const { verifyPassword } = await import('@/lib/auth')
      expect(verifyPassword('abcd', 'abc')).toBe(false)
    })
  })

  describe('createToken', () => {
    it('返回时间戳-随机字符串格式', async () => {
      const { createToken } = await import('@/lib/auth')
      const token = createToken()
      expect(token).toMatch(/^\d+-[a-z0-9]+$/)
    })
  })

  describe('getAdminPassword', () => {
    it('有环境变量时返回密码', async () => {
      vi.stubEnv('ADMIN_PASSWORD', 'mysecret')
      const { getAdminPassword } = await import('@/lib/auth')
      expect(getAdminPassword()).toBe('mysecret')
    })

    it('无环境变量时抛出错误', async () => {
      vi.stubEnv('ADMIN_PASSWORD', undefined)
      const { getAdminPassword } = await import('@/lib/auth')
      expect(() => getAdminPassword()).toThrow('ADMIN_PASSWORD 环境变量未设置')
    })
  })
})
