import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, getGuideContent, buildSystemPrompt, buildUserMessage, streamToLLM } from '@/lib/ai';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request: NextRequest) {
  console.log('[AI] POST /api/ai/generate 收到请求');

  const authenticated = await isAuthenticated();
  console.log('[AI] 认证状态:', authenticated);
  if (!authenticated) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, currentHtml } = body as { prompt: string; currentHtml?: string };
    console.log('[AI] prompt:', prompt, '| currentHtml 长度:', currentHtml?.length ?? 0);

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt 不能为空' }, { status: 400 });
    }

    const config = getAIConfig();
    console.log('[AI] 配置:', { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey.slice(0, 8) + '...' });

    const guideContent = await getGuideContent();
    console.log('[AI] 规范文档长度:', guideContent.length);

    const systemPrompt = buildSystemPrompt(guideContent);
    const userMessage = buildUserMessage(prompt, currentHtml || null);

    console.log('[AI] 开始调用 LLM...');
    const stream = await streamToLLM(config, systemPrompt, userMessage, request.signal);
    console.log('[AI] LLM 流已建立，返回响应');

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[AI] 请求被中断');
      return new NextResponse(null, { status: 204 });
    }

    console.error('[AI] 生成错误:', error);
    const message = error instanceof Error ? error.message : 'AI 生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
