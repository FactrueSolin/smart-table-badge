import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth')

describe('API: /api/auth/login', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('POST /api/auth/login should set auth cookie when password is correct', async () => {
    const { verifyPassword, setAuthCookie, getAdminPassword } = await import('@/lib/auth')
    vi.mocked(getAdminPassword).mockReturnValue('secret')
    vi.mocked(verifyPassword).mockReturnValue(true)
    vi.mocked(setAuthCookie).mockResolvedValue()

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'secret' }),
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(vi.mocked(setAuthCookie)).toHaveBeenCalled()
  })

  it('POST /api/auth/login should return 401 when password is incorrect', async () => {
    const { verifyPassword, getAdminPassword } = await import('@/lib/auth')
    vi.mocked(getAdminPassword).mockReturnValue('secret')
    vi.mocked(verifyPassword).mockReturnValue(false)

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong' }),
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('POST /api/auth/login should return 400 when password is missing', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('请输入密码')
  })

  it('POST /api/auth/login should return 400 for injected non-string password payload', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: { $gt: '' } }),
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('请输入密码')
    expect(vi.mocked(verifyPassword)).not.toHaveBeenCalled()
  })

  it('POST /api/auth/login should return 400 for malformed json body', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: '{"password":',
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('请求体格式错误')
  })

  it('POST /api/auth/login should return 500 when auth cookie cannot be written', async () => {
    const { verifyPassword, setAuthCookie, getAdminPassword } = await import('@/lib/auth')
    vi.mocked(getAdminPassword).mockReturnValue('secret')
    vi.mocked(verifyPassword).mockReturnValue(true)
    vi.mocked(setAuthCookie).mockRejectedValue(new Error('cookie store unavailable'))

    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'secret' }),
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('登录失败')
  })
})
