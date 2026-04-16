import { describe, expect, it } from 'vitest';

import { generateOpenApiDocument } from '@/lib/openapi/document';
import '@/app/api/pages/route';
import '@/app/api/pages/[id]/route';
import '@/app/api/current/route';
import '@/app/api/images/route';
import '@/app/api/images/[id]/route';
import '@/app/api/auth/login/route';
import '@/app/api/auth/logout/route';
import '@/app/api/auth/check/route';

describe('openapi document', () => {
  it('生成核心 API 路径与 schema', () => {
    const document = generateOpenApiDocument();

    expect(document.openapi).toBe('3.1.0');
    expect(document.paths).toMatchObject({
      '/api/pages': expect.any(Object),
      '/api/pages/{id}': expect.any(Object),
      '/api/current': expect.any(Object),
      '/api/images': expect.any(Object),
      '/api/images/{id}': expect.any(Object),
      '/api/auth/login': expect.any(Object),
      '/api/auth/logout': expect.any(Object),
      '/api/auth/check': expect.any(Object),
    });
    expect(document.components?.schemas).toMatchObject({
      PageInfo: expect.any(Object),
      ImageAsset: expect.any(Object),
      ErrorResponse: expect.any(Object),
      AuthCheckResponse: expect.any(Object),
    });
  });
});
