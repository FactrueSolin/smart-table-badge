import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth')

describe('API: /api/auth/check', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('GET /api/auth/check should return authenticated true for logged-in user', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const { GET } = await import('@/app/api/auth/check/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ authenticated: true })
  })

  it('GET /api/auth/check should return authenticated false for anonymous user', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(false)

    const { GET } = await import('@/app/api/auth/check/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ authenticated: false })
  })
})

describe('API: /api/auth/logout', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('POST /api/auth/logout should clear auth cookie and return success', async () => {
    const { clearAuthCookie } = await import('@/lib/auth')
    vi.mocked(clearAuthCookie).mockResolvedValue()

    const { POST } = await import('@/app/api/auth/logout/route')
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(vi.mocked(clearAuthCookie)).toHaveBeenCalled()
  })
})
