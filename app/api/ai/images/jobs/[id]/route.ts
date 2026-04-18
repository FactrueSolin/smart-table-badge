import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { createAiImageRequestId, toAiImageErrorResponse } from '@/lib/ai/image-generation/errors';
import { imageGenerationService } from '@/lib/ai/image-generation/service';
import { isAuthenticated } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import {
  aiImageErrorResponseSchema,
  aiImageJobDetailQuerySchema,
  aiImageJobIdParamSchema,
  aiImageJobResponseSchema,
} from '@/lib/openapi/schemas/ai-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const registerAiImageJobDetailOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/ai/images/jobs/{id}',
    tags: ['AI 生图'],
    summary: '获取 AI 生图任务详情',
    request: {
      params: aiImageJobIdParamSchema,
      query: aiImageJobDetailQuerySchema,
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: aiImageJobResponseSchema,
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
      404: {
        description: '任务不存在',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
          },
        },
      },
    },
  });
});

registerAiImageJobDetailOpenApi();

function buildUnauthorizedResponse(requestId: string): NextResponse {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = createAiImageRequestId();

  if (!(await isAuthenticated())) {
    return buildUnauthorizedResponse(requestId);
  }

  try {
    const { id } = await params;
    const query = aiImageJobDetailQuerySchema.parse({
      sync: request.nextUrl.searchParams.get('sync') ?? undefined,
    });
    const job = await imageGenerationService.getJob(id, {
      sync: query.sync !== 'false',
    });

    return NextResponse.json({ job });
  } catch (error) {
    if (error instanceof ZodError) {
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

    const { body, status } = toAiImageErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}
