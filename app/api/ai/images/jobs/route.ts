import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { createAiImageRequestId, toAiImageErrorResponse } from '@/lib/ai/image-generation/errors';
import { imageGenerationService } from '@/lib/ai/image-generation/service';
import { isAuthenticated } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import {
  aiImageCreateRequestSchema,
  aiImageErrorResponseSchema,
  aiImageJobListQuerySchema,
  aiImageJobListResponseSchema,
  aiImageJobResponseSchema,
} from '@/lib/openapi/schemas/ai-image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const registerAiImageJobsCollectionOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/ai/images/jobs',
    tags: ['AI 生图'],
    summary: '获取 AI 生图任务列表',
    request: {
      query: aiImageJobListQuerySchema,
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: aiImageJobListResponseSchema,
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

  registry.registerPath({
    method: 'post',
    path: '/api/ai/images/jobs',
    tags: ['AI 生图'],
    summary: '创建 AI 生图任务',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: aiImageCreateRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: '创建成功',
        content: {
          'application/json': {
            schema: aiImageJobResponseSchema,
          },
        },
      },
      400: {
        description: '请求参数错误',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
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
      409: {
        description: '幂等冲突',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
          },
        },
      },
      422: {
        description: '模型约束不满足',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
          },
        },
      },
      502: {
        description: 'Provider 请求失败',
        content: {
          'application/json': {
            schema: aiImageErrorResponseSchema,
          },
        },
      },
    },
  });
});

registerAiImageJobsCollectionOpenApi();

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = createAiImageRequestId();

  if (!(await isAuthenticated())) {
    return buildUnauthorizedResponse(requestId);
  }

  try {
    const parsed = aiImageJobListQuerySchema.parse({
      status: request.nextUrl.searchParams.get('status') ?? undefined,
      provider: request.nextUrl.searchParams.get('provider') ?? undefined,
      model: request.nextUrl.searchParams.get('model') ?? undefined,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    });

    const result = await imageGenerationService.listJobs({
      status: parsed.status,
      provider: parsed.provider,
      model: parsed.model,
      cursor: parsed.cursor,
      limit: parsed.limit ?? 20,
    });

    return NextResponse.json(result);
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = createAiImageRequestId();

  if (!(await isAuthenticated())) {
    return buildUnauthorizedResponse(requestId);
  }

  try {
    const body = aiImageCreateRequestSchema.parse(await request.json());
    const job = await imageGenerationService.createJob(body, {
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });

    return NextResponse.json({ job }, { status: 201 });
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

    const { body, status } = toAiImageErrorResponse(error, requestId);
    return NextResponse.json(body, { status });
  }
}
