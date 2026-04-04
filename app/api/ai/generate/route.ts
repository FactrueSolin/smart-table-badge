import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, getGuideContent, buildSystemPrompt, buildUserMessage, streamToLLM } from '@/lib/ai';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { prompt, currentHtml } = body as { prompt: string; currentHtml?: string };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt 不能为空' }, { status: 400 });
    }

    const config = getAIConfig();
    const guideContent = await getGuideContent();
    const systemPrompt = buildSystemPrompt(guideContent);
    const userMessage = buildUserMessage(prompt, currentHtml || null);

    const stream = await streamToLLM(config, systemPrompt, userMessage, request.signal);

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 204 });
    }

    console.error('[AI] 生成错误:', error);
    const message = error instanceof Error ? error.message : 'AI 生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
