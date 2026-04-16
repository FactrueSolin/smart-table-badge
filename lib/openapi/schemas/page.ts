import { z } from '@/lib/openapi/registry';

export const pageInfoSchema = z.object({
  id: z.string().openapi({ description: '页面唯一 ID' }),
  name: z.string().openapi({ description: '页面名称' }),
  filename: z.string().openapi({ description: '存储文件名' }),
  uploadedAt: z.string().datetime().openapi({ description: '上传时间' }),
}).openapi('PageInfo');

export const pageListSchema = z.array(pageInfoSchema).openapi('PageList');

export const pageUploadRequestSchema = z.object({
  file: z.string().openapi({ type: 'string', format: 'binary', description: 'HTML 文件' }),
  name: z.string().optional().openapi({ description: '页面名称，可选，默认使用文件名' }),
}).openapi('PageUploadRequest');

export const pageContentSchema = z.string().openapi({
  description: 'HTML 内容',
  example: '<!DOCTYPE html><html><body>Hello</body></html>',
});
