import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth')

describe('API: /api/auth/login', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('密码正确返回 200', async () => {
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
  })

  it('密码错误返回 401', async () => {
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

  it('缺少密码返回 400', async () => {
    const request = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request)

    expect(response.status).toBe(400)
  })
})
