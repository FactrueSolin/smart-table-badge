import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, setAuthCookie, getAdminPassword } from '@/lib/auth';
import { createOpenApiRouteRegistrar } from '@/lib/openapi/registry';
import { loginRequestSchema } from '@/lib/openapi/schemas/auth';
import { errorResponseSchema, successResponseSchema } from '@/lib/openapi/schemas/common';

export const registerAuthLoginOpenApi = createOpenApiRouteRegistrar((registry) => {
  registry.registerPath({
    method: 'post',
    path: '/api/auth/login',
    tags: ['认证'],
    summary: '管理后台登录',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: loginRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: '登录成功，设置 cookie',
        content: {
          'application/json': {
            schema: successResponseSchema,
          },
        },
      },
      400: {
        description: '请输入密码',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      401: {
        description: '密码错误',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: '登录失败',
        content: {
          'application/json': {
            schema: errorResponseSchema,
          },
        },
      },
    },
  });
});

registerAuthLoginOpenApi();

function getPasswordFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const { password } = body as { password?: unknown };
  if (typeof password !== 'string') {
    return null;
  }

  const trimmedPassword = password.trim();
  return trimmedPassword.length > 0 ? trimmedPassword : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const password = getPasswordFromBody(body);

    if (!password) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 });
    }

    const adminPassword = getAdminPassword();
    const valid = verifyPassword(password, adminPassword);

    if (!valid) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    await setAuthCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
    }

    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
