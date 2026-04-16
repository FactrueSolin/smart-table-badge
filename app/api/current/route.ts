import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPageContent, setCurrentPage } from '@/lib/storage';
import { broadcast } from '@/lib/sse';
import { isAuthenticated, isValidCurrentPageApiToken } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { errorResponseSchema } from '@/lib/openapi/schemas/common';
import {
  currentPageResponseSchema,
  switchCurrentPageRequestSchema,
  switchCurrentPageResponseSchema,
} from '@/lib/openapi/schemas/current';

export const registerCurrentOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/current',
    tags: ['展示控制'],
    summary: '获取当前展示的页面信息',
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: currentPageResponseSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'put',
    path: '/api/current',
    tags: ['展示控制'],
    summary: '切换当前展示的页面',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: switchCurrentPageRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: '切换成功',
        content: {
          'application/json': {
            schema: switchCurrentPageResponseSchema,
          },
        },
      },
      400: {
        description: '缺少 pageId',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      401: {
        description: '未授权',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      404: {
        description: '页面不存在',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '切换失败',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });
});

registerCurrentOpenApi();

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cookieAuth = await isAuthenticated();
  if (cookieAuth) {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return isValidCurrentPageApiToken(token);
  }

  return false;
}

export async function GET() {
  const { page, content } = await getCurrentPageContent();
  if (!page) {
    return NextResponse.json({ page: null, content: null });
  }
  return NextResponse.json({ page, content });
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { pageId } = body as { pageId?: string };
    if (!pageId) {
      return NextResponse.json({ error: '缺少 pageId' }, { status: 400 });
    }

    const success = await setCurrentPage(pageId);
    if (!success) {
      return NextResponse.json({ error: '页面不存在' }, { status: 404 });
    }

    broadcast('content-changed', { action: 'switch', pageId, timestamp: Date.now() });
    return NextResponse.json({ success: true, pageId, timestamp: Date.now() });
  } catch {
    return NextResponse.json({ error: '切换失败' }, { status: 500 });
  }
}
