import { z } from '@/lib/openapi/registry';
import { pageInfoSchema } from '@/lib/openapi/schemas/page';

export const currentPageResponseSchema = z.object({
  page: pageInfoSchema.nullable().openapi({ description: '当前展示页面' }),
  content: z.string().nullable().openapi({ description: '当前页面 HTML 内容' }),
}).openapi('CurrentPageResponse');

export const switchCurrentPageRequestSchema = z.object({
  pageId: z.string().min(1).openapi({ description: '要切换到的页面 ID' }),
}).openapi('SwitchCurrentPageRequest');

export const switchCurrentPageResponseSchema = z.object({
  success: z.literal(true).openapi({ description: '切换成功标记' }),
  pageId: z.string().openapi({ description: '当前页面 ID' }),
  timestamp: z.number().int().openapi({ description: '操作时间戳' }),
}).openapi('SwitchCurrentPageResponse');
