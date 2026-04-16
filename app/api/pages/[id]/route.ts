import { NextRequest, NextResponse } from 'next/server';
import { deletePage, getPageContent } from '@/lib/storage';
import { broadcast } from '@/lib/sse';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { deletedByIdResponseSchema, errorResponseSchema, idParamSchema } from '@/lib/openapi/schemas/common';
import { pageContentSchema } from '@/lib/openapi/schemas/page';

export const registerPageDetailOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/pages/{id}',
    tags: ['页面管理'],
    summary: '获取指定页面的 HTML 内容',
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: '成功',
        content: {
          'text/html': {
            schema: pageContentSchema,
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
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/api/pages/{id}',
    tags: ['页面管理'],
    summary: '删除指定页面',
    request: {
      params: idParamSchema,
    },
    responses: {
      200: {
        description: '删除成功',
        content: {
          'application/json': {
            schema: deletedByIdResponseSchema,
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
    },
  });
});

registerPageDetailOpenApi();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const content = await getPageContent(id);
  if (!content) {
    return NextResponse.json({ error: '页面不存在' }, { status: 404 });
  }
  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = await deletePage(id);
  if (!success) {
    return NextResponse.json({ error: '页面不存在' }, { status: 404 });
  }
  broadcast('content-changed', { action: 'delete', pageId: id, timestamp: Date.now() });
  return NextResponse.json({ deleted: true, id });
}
