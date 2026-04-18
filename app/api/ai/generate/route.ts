import { NextRequest, NextResponse } from 'next/server';
import { getAIConfig, getGuideContent, getPromptTemplate, buildPrompt, streamToLLM } from '@/lib/ai';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ParsedGenerateBody =
  | {
    ok: true;
    prompt: string;
    currentHtml: string | null;
  }
  | {
    ok: false;
    error: string;
  };

function parseGenerateBody(body: unknown): ParsedGenerateBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: '请求参数错误' };
  }

  const { prompt, currentHtml } = body as { prompt?: unknown; currentHtml?: unknown };

  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { ok: false, error: 'prompt 不能为空' };
  }

  if (currentHtml !== undefined && currentHtml !== null && typeof currentHtml !== 'string') {
    return { ok: false, error: 'currentHtml 必须是字符串' };
  }

  return {
    ok: true,
    prompt: prompt.trim(),
    currentHtml: currentHtml ?? null,
  };
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const parsedBody = parseGenerateBody((await request.json()) as unknown);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: parsedBody.error }, { status: 400 });
    }

    const config = getAIConfig();
    const guideContent = await getGuideContent();
    const promptTemplate = await getPromptTemplate();
    const fullPrompt = buildPrompt(promptTemplate, guideContent, parsedBody.prompt, parsedBody.currentHtml);

    const stream = await streamToLLM(config, fullPrompt, request.signal);

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
    }

    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 204 });
    }

    console.error('[AI] 生成错误:', error);
    const message = error instanceof Error ? error.message : 'AI 生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
