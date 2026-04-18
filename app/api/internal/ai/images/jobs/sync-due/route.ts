import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';

import { createAiImageRequestId } from '@/lib/ai/image-generation/errors';
import { imageGenerationService } from '@/lib/ai/image-generation/service';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import {
  aiImageErrorResponseSchema,
  aiImageSyncDueRequestSchema,
  aiImageSyncDueResponseSchema,
} from '@/lib/openapi/schemas/ai-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const registerAiImageSyncDueOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'post',
    path: '/api/internal/ai/images/jobs/sync-due',
    tags: ['内部任务'],
    summary: '推进到期的 AI 生图任务',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: aiImageSyncDueRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: aiImageSyncDueResponseSchema,
          },
        },
      },
      401: {
        description: '未授权',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
          },
        },
      },
    },
  });
});

registerAiImageSyncDueOpenApi();

function isValidInternalCronToken(token: string): boolean {
  const expected = process.env.INTERNAL_CRON_TOKEN;

  if (!expected || !token) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

function readBearerToken(request: NextRequest): string {
  const header = request.headers.get('authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = createAiImageRequestId();

  if (!isValidInternalCronToken(readBearerToken(request))) {
    return NextResponse.json(
      {
        error: {
          code: 'AI_IMAGE_UNAUTHORIZED',
          message: '未授权',
          retryable: false,
        },
        requestId,
      },
      { status: 401 },
    );
  }

  try {
    const body = aiImageSyncDueRequestSchema.parse(await request.json());
    const result = await imageGenerationService.syncDueJobs(body.limit);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'AI_IMAGE_INVALID_INPUT',
            message: '请求参数错误',
            retryable: false,
          },
          requestId,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: 'AI_IMAGE_PROVIDER_POLL_FAILED',
          message: '同步到期任务失败',
          retryable: true,
        },
        requestId,
      },
      { status: 500 },
    );
  }
}
