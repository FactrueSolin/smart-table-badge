import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { openApiRegistry } from '@/lib/openapi/registry';

export const openApiTags = [
  { name: '页面管理', description: 'HTML 页面的增删查' },
  { name: '图床管理', description: '图片素材的上传、列表、重命名、删除与原图访问' },
  { name: '展示控制', description: '当前展示页面的读取与切换' },
  { name: '认证', description: '管理后台认证接口' },
  { name: 'AI 生图', description: '异步 AI 生图任务管理' },
  { name: '内部任务', description: '仅供服务内部或定时任务调用的接口' },
] as const;

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'HTMLPush API',
      description: 'HTMLPush 是一个让手机浏览器变成桌面显示器的服务。后台上传或切换 HTML 内容，手机端读取同一份 API 文档产物。',
      version: '0.1.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '本地开发环境',
      },
    ],
    tags: [...openApiTags],
  });
}
