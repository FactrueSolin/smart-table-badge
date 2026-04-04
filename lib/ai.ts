import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export function getAIConfig(): AIConfig {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/+$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o';
  const apiKey = process.env.AI_API_KEY || '';

  if (!baseUrl || !apiKey) {
    throw new Error('AI_BASE_URL 和 AI_API_KEY 环境变量必须设置');
  }

  return { baseUrl, model, apiKey };
}

export async function getGuideContent(): Promise<string> {
  const guidePath = join(process.cwd(), 'docs', '手机展示HTML规范.md');
  return readFileSync(guidePath, 'utf-8');
}

export function buildSystemPrompt(guideContent: string): string {
  return `${guideContent}

重要：只输出完整的 HTML 代码，不要输出任何解释文字、markdown 标记或代码块标记。直接以 <!DOCTYPE html> 开头。`;
}

export function buildUserMessage(prompt: string, currentHtml: string | null): string {
  if (currentHtml && currentHtml.trim()) {
    return `当前 HTML 代码：
\`\`\`html
${currentHtml}
\`\`\`

用户需求：${prompt}

请基于当前代码进行修改，返回修改后的完整 HTML。`;
  }
  return `用户需求：${prompt}`;
}

export async function streamToLLM(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
  signal: AbortSignal
): Promise<ReadableStream> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 请求失败 (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('AI 响应体为空');
  }

  // 解析 SSE 流，提取 content 字段，使用 start 主动 push 模式
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let buffer = '';

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;

              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                controller.close();
                return;
              }

              try {
                const json = JSON.parse(data) as {
                  choices?: Array<{
                    delta?: {
                      content?: string;
                    };
                  }>;
                };
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            controller.close();
          } else {
            controller.error(error);
          }
        }
      };

      pump();
    },
    cancel() {
      reader.cancel();
    },
  });
}
