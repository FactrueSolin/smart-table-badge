import { NextRequest, NextResponse } from 'next/server';

import { createAiImageRequestId, toAiImageErrorResponse } from '@/lib/ai/image-generation/errors';
import { imageGenerationService } from '@/lib/ai/image-generation/service';
import { isAuthenticated } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import {
  aiImageErrorResponseSchema,
  aiImageJobIdParamSchema,
  aiImageJobResponseSchema,
} from '@/lib/openapi/schemas/ai-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const registerAiImageJobCancelOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'post',
    path: '/api/ai/images/jobs/{id}/cancel',
    tags: ['AI 生图'],
    summary: '取消 AI 生图任务',
    request: {
      params: aiImageJobIdParamSchema,
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
      409: {
        description: '任务状态冲突',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
          },
        },
      },
    },
  });
});

registerAiImageJobCancelOpenApi();

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const requestId = createAiImageRequestId();

  if (!(await isAuthenticated())) {
    return buildUnauthorizedResponse(requestId);
  }

  try {
    const { id } = await params;
    const job = await imageGenerationService.cancelJob(id);
    return NextResponse.json({ job });
  } catch (error) {
    const { body, status } = toAiImageErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}
