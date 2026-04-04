import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('ai', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('getAIConfig', () => {
    it('正常配置返回正确对象', async () => {
      vi.stubEnv('AI_BASE_URL', 'https://api.example.com/v1')
      vi.stubEnv('AI_MODEL', 'gpt-4')
      vi.stubEnv('AI_API_KEY', 'sk-test')
      const { getAIConfig } = await import('@/lib/ai')
      const config = getAIConfig()
      expect(config).toEqual({
        baseUrl: 'https://api.example.com/v1',
        model: 'gpt-4',
        apiKey: 'sk-test',
      })
    })

    it('缺少 BASE_URL 抛出错误', async () => {
      vi.stubEnv('AI_BASE_URL', undefined)
      vi.stubEnv('AI_API_KEY', 'sk-test')
      const { getAIConfig } = await import('@/lib/ai')
      expect(() => getAIConfig()).toThrow('AI_BASE_URL 和 AI_API_KEY 环境变量必须设置')
    })

    it('缺少 API_KEY 抛出错误', async () => {
      vi.stubEnv('AI_BASE_URL', 'https://api.example.com')
      vi.stubEnv('AI_API_KEY', undefined)
      const { getAIConfig } = await import('@/lib/ai')
      expect(() => getAIConfig()).toThrow('AI_BASE_URL 和 AI_API_KEY 环境变量必须设置')
    })

    it('baseUrl 尾部斜杠被去除', async () => {
      vi.stubEnv('AI_BASE_URL', 'https://api.example.com/v1///')
      vi.stubEnv('AI_API_KEY', 'sk-test')
      const { getAIConfig } = await import('@/lib/ai')
      const config = getAIConfig()
      expect(config.baseUrl).toBe('https://api.example.com/v1')
    })
  })

  describe('buildPrompt', () => {
    it('替换所有占位符', async () => {
      const { buildPrompt } = await import('@/lib/ai')
      const result = buildPrompt(
        '模板: {{规范内容}} | {{当前代码}} | {{用户需求}}',
        '规范内容',
        '用户需求',
        '<html></html>'
      )
      expect(result).toContain('规范内容')
      expect(result).toContain('<html></html>')
      expect(result).toContain('用户需求')
      expect(result).not.toContain('{{')
    })

    it('无当前代码时替换为（无，从零生成）', async () => {
      const { buildPrompt } = await import('@/lib/ai')
      const result = buildPrompt(
        '{{当前代码}}',
        '规范',
        '需求',
        null
      )
      expect(result).toBe('（无，从零生成）')
    })
  })

  describe('streamToLLM', () => {
    function createSSEStream(chunks: string[]) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    it('正常内容流输出 content 消息', async () => {
      vi.stubEnv('AI_BASE_URL', 'https://api.example.com')
      vi.stubEnv('AI_API_KEY', 'sk-test')
      const { streamToLLM } = await import('@/lib/ai')

      const sseData = [
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n',
        'data: [DONE]\n',
      ]

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createSSEStream(sseData)))

      const config = { baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' }
      const stream = await streamToLLM(config, 'prompt', new AbortController().signal)

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      const messages: string[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        messages.push(decoder.decode(value))
      }

      expect(messages.length).toBeGreaterThan(0)
      const contentMsgs = messages.filter((m) => m.includes('"type":"content"'))
      expect(contentMsgs.length).toBe(2)
      expect(contentMsgs[0]).toContain('hello')
      expect(contentMsgs[1]).toContain(' world')
      const doneMsg = messages.find((m) => m.includes('"type":"done"'))
      expect(doneMsg).toBeDefined()
    })

    it('思考内容流输出 thinking 消息', async () => {
      vi.stubEnv('AI_BASE_URL', 'https://api.example.com')
      vi.stubEnv('AI_API_KEY', 'sk-test')
      const { streamToLLM } = await import('@/lib/ai')

      const sseData = [
        'data: {"choices":[{"delta":{"reasoning_content":"thinking..."}}]}\n',
        'data: {"choices":[{"delta":{"content":"result"}}]}\n',
        'data: [DONE]\n',
      ]

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createSSEStream(sseData)))

      const config = { baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' }
      const stream = await streamToLLM(config, 'prompt', new AbortController().signal)

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      const messages: string[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        messages.push(decoder.decode(value))
      }

      const thinkingMsg = messages.find((m) => m.includes('"type":"thinking"'))
      expect(thinkingMsg).toBeDefined()
      expect(thinkingMsg).toContain('thinking...')
    })

    it('API 返回错误状态抛出异常', async () => {
      vi.stubEnv('AI_BASE_URL', 'https://api.example.com')
      vi.stubEnv('AI_API_KEY', 'sk-test')
      const { streamToLLM } = await import('@/lib/ai')

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response('Rate limit', { status: 429 })
      ))

      const config = { baseUrl: 'https://api.example.com', model: 'gpt-4', apiKey: 'sk-test' }
      await expect(streamToLLM(config, 'prompt', new AbortController().signal))
        .rejects.toThrow('429')
    })
  })
})
