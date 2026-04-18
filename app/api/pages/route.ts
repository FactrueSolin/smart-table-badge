import { NextRequest, NextResponse } from 'next/server';
import { loadConfig, addPage } from '@/lib/storage';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { errorResponseSchema } from '@/lib/openapi/schemas/common';
import { pageInfoSchema, pageListSchema, pageUploadRequestSchema } from '@/lib/openapi/schemas/page';

export const registerPagesCollectionOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'get',
    path: '/api/pages',
    tags: ['页面管理'],
    summary: '获取所有页面列表',
    responses: {
      200: {
        description: '成功',
        content: {
          'application/json': {
            schema: pageListSchema,
          },
        },
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/pages',
    tags: ['页面管理'],
    summary: '上传 HTML 文件',
    request: {
      body: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: pageUploadRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: '上传成功',
        content: {
          'application/json': {
            schema: pageInfoSchema,
          },
        },
      },
      400: {
        description: '缺少文件',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '上传失败',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });
});

registerPagesCollectionOpenApi();

function getUploadName(nameEntry: FormDataEntryValue | null, fallbackName: string): string {
  if (typeof nameEntry !== 'string') {
    return fallbackName;
  }

  const trimmedName = nameEntry.trim();
  return trimmedName.length > 0 ? trimmedName : fallbackName;
}

export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config.pages);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const file = fileEntry instanceof File ? fileEntry : null;

    if (!file) {
      return NextResponse.json({ error: '缺少文件' }, { status: 400 });
    }

    const name = getUploadName(formData.get('name'), file.name || '未命名页面');

    const content = await file.text();
    const page = await addPage(name, content);
    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    console.error('[api/pages] upload failed', err);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
