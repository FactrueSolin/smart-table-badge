import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/ai')
vi.mock('@/lib/auth')

describe('API: /api/ai/generate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('未认证返回 401', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(false)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('空 prompt 返回 400', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }),
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('正常请求返回流式响应', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const { getAIConfig, getGuideContent, getPromptTemplate, buildPrompt, streamToLLM } = await import('@/lib/ai')
    vi.mocked(getAIConfig).mockReturnValue({ baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' })
    vi.mocked(getGuideContent).mockResolvedValue('guide content')
    vi.mocked(getPromptTemplate).mockResolvedValue('template')
    vi.mocked(buildPrompt).mockReturnValue('full prompt')

    const mockStream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'content', content: 'hello' }) + '\n'))
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'))
        controller.close()
      },
    })
    vi.mocked(streamToLLM).mockResolvedValue(mockStream)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'make a page', currentHtml: '<html></html>' }),
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/plain')
    expect(response.headers.get('X-Accel-Buffering')).toBe('no')
  })
})
