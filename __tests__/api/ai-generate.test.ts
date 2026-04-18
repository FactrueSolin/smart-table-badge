import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/ai')
vi.mock('@/lib/auth')

interface StreamEvent {
  type: string
  content?: string
}

function createProtocolStream(events: StreamEvent[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const event of events) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      controller.close()
    },
  })
}

async function readProtocolEvents(response: Response): Promise<StreamEvent[]> {
  const body = await response.text()
  return body
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StreamEvent)
}

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
    const { streamToLLM } = await import('@/lib/ai')
    expect(vi.mocked(streamToLLM)).not.toHaveBeenCalled()
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
    await expect(response.json()).resolves.toEqual({ error: 'prompt 不能为空' })
  })

  it('仅包含空白字符的 prompt 返回 400', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '   ' }),
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('prompt 不能为空')
  })

  it('对象注入 prompt 返回 400 且不会触发下游 AI 调用', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: { $gt: '' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)
    const data = await response.json()

    const { buildPrompt, streamToLLM } = await import('@/lib/ai')
    expect(response.status).toBe(400)
    expect(data.error).toBe('prompt 不能为空')
    expect(vi.mocked(buildPrompt)).not.toHaveBeenCalled()
    expect(vi.mocked(streamToLLM)).not.toHaveBeenCalled()
  })

  it('对象注入 currentHtml 返回 400 且不会拼接 Prompt', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '生成海报', currentHtml: { script: '<script>alert(1)</script>' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)
    const data = await response.json()

    const { buildPrompt, streamToLLM } = await import('@/lib/ai')
    expect(response.status).toBe(400)
    expect(data.error).toBe('currentHtml 必须是字符串')
    expect(vi.mocked(buildPrompt)).not.toHaveBeenCalled()
    expect(vi.mocked(streamToLLM)).not.toHaveBeenCalled()
  })

  it('畸形 JSON 请求体返回 400', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: '{"prompt":',
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('请求体格式错误')
  })

  it('正常请求返回流式响应并按依赖顺序组装 Prompt', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const { getAIConfig, getGuideContent, getPromptTemplate, buildPrompt, streamToLLM } = await import('@/lib/ai')
    vi.mocked(getAIConfig).mockReturnValue({ baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' })
    vi.mocked(getGuideContent).mockResolvedValue('guide content')
    vi.mocked(getPromptTemplate).mockResolvedValue('template')
    vi.mocked(buildPrompt).mockReturnValue('full prompt')
    vi.mocked(streamToLLM).mockResolvedValue(createProtocolStream([
      { type: 'thinking', content: 'step-1' },
      { type: 'content', content: '<main>Hello</main>' },
      { type: 'done' },
    ]))

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '  make a page  ', currentHtml: '<html></html>' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)
    const events = await readProtocolEvents(response)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/plain')
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform')
    expect(response.headers.get('X-Accel-Buffering')).toBe('no')
    expect(vi.mocked(buildPrompt)).toHaveBeenCalledWith('template', 'guide content', 'make a page', '<html></html>')
    expect(vi.mocked(streamToLLM)).toHaveBeenCalledWith(
      { baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' },
      'full prompt',
      request.signal,
    )
    expect(events).toEqual([
      { type: 'thinking', content: 'step-1' },
      { type: 'content', content: '<main>Hello</main>' },
      { type: 'done' },
    ])
  })

  it('未提供 currentHtml 时会以 null 传给 Prompt 构造器', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const { getAIConfig, getGuideContent, getPromptTemplate, buildPrompt, streamToLLM } = await import('@/lib/ai')
    vi.mocked(getAIConfig).mockReturnValue({ baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' })
    vi.mocked(getGuideContent).mockResolvedValue('guide content')
    vi.mocked(getPromptTemplate).mockResolvedValue('template')
    vi.mocked(buildPrompt).mockReturnValue('full prompt')
    vi.mocked(streamToLLM).mockResolvedValue(createProtocolStream([{ type: 'done' }]))

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'make a page' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(vi.mocked(buildPrompt)).toHaveBeenCalledWith('template', 'guide content', 'make a page', null)
  })

  it('下游返回 AbortError 时接口返回 204', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const { getAIConfig, getGuideContent, getPromptTemplate, buildPrompt, streamToLLM } = await import('@/lib/ai')
    vi.mocked(getAIConfig).mockReturnValue({ baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' })
    vi.mocked(getGuideContent).mockResolvedValue('guide content')
    vi.mocked(getPromptTemplate).mockResolvedValue('template')
    vi.mocked(buildPrompt).mockReturnValue('full prompt')
    vi.mocked(streamToLLM).mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'make a page' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)

    expect(response.status).toBe(204)
    expect(response.body).toBeNull()
  })

  it('下游异常时返回 500 并输出明确错误信息', async () => {
    const { isAuthenticated } = await import('@/lib/auth')
    vi.mocked(isAuthenticated).mockResolvedValue(true)

    const { getAIConfig } = await import('@/lib/ai')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(getAIConfig).mockImplementation(() => {
      throw new Error('AI_BASE_URL 和 AI_API_KEY 环境变量必须设置')
    })

    const request = new NextRequest('http://localhost/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'make a page' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const { POST } = await import('@/app/api/ai/generate/route')
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('AI_BASE_URL 和 AI_API_KEY 环境变量必须设置')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[AI] 生成错误:', expect.any(Error))

    consoleErrorSpy.mockRestore()
  })
})
