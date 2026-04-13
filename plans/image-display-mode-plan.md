# 图片显示模式方案

> 2026-04-13 更新：当前优先采用**最小改动方案**，即**复用现有 HTML 展示链路**，仅新增图片上传接口，并自动生成一份引用图片 URL 的 HTML 页面模板。

## 概述

当前系统的展示入口集中在 [`app/page.tsx`](app/page.tsx)，本质上是通过 `iframe` 加载 [`app/api/current/view/route.ts`](app/api/current/view/route.ts) 返回的 HTML。基于这个事实，图片展示**不一定要新增独立显示模式**，也可以直接复用现有 HTML 页面链路。

本次更新后的优先方案是：**新增图片上传接口，拿到图片 URL 后，自动生成一份图片展示 HTML 模板，并仍然作为普通页面接入现有 `pages` 体系**。这样首页、SSE、当前页切换、页面渲染逻辑都几乎不用动，兼容性最强，改动也最小。

方案重点从“新增 image 类型”调整为“新增图片资源能力 + HTML 模板生成能力”。

## 最小方案结论

最小方案只做三件事：

- 新增图片上传接口
- 返回可访问图片的 URL
- 基于固定模板生成一份全屏展示图片的 HTML，并复用现有页面存储与展示逻辑

也就是说，**展示端仍然只认识 HTML 页面**。图片只是页面内容来源之一，而不是新的播放类型。

## 现状分析

从现有代码看：

- `lib/types.ts` 中配置结构只有 `currentPageId` 与 `pages`
- `lib/storage.ts` 只管理 HTML 文件，存储目录固定在 `data/pages`
- `app/api/pages/route.ts` 只负责 HTML 页面上传与列表
- `app/api/current/route.ts` 只允许通过 `pageId` 切换当前展示内容
- `app/page.tsx` 固定以 `iframe` 渲染当前内容
- `app/admin/page.tsx` 的管理能力也完全围绕 HTML 页面构建

因此图片模式不能只在前端加一个 `img` 标签，而需要同时调整**数据模型、存储层、API、管理后台、首页展示逻辑、测试**。

## 设计方案

### 为什么这个方案更兼容

从当前实现看：

- [`app/page.tsx`](app/page.tsx) 不关心页面内容细节，只负责展示 `iframe`
- [`app/api/current/route.ts`](app/api/current/route.ts) 只切换当前页面 ID
- [`app/api/current/view/route.ts`](app/api/current/view/route.ts) 只负责输出 HTML
- [`lib/storage.ts`](lib/storage.ts) 已经具备页面落盘、切换、读取的完整链路

所以如果上传图片后，自动生成一个 HTML 文件，例如内部仅包含：

```html
<img src="/api/images/xxx" />
```

那么系统对外表现仍然是一张“页面”。这样就不需要修改当前展示对象的数据模型，也不需要把 [`app/page.tsx`](app/page.tsx) 改成多类型渲染。

### 推荐的数据流

```mermaid
flowchart LR
  A[管理后台上传图片] --> B[图片上传接口保存文件]
  B --> C[返回图片URL]
  C --> D[生成图片展示HTML模板]
  D --> E[调用现有页面存储逻辑]
  E --> F[写入pages列表]
  F --> G[现有首页iframe展示]
```

### 存储设计

这个方案下，建议只新增**图片文件存储**，而不新增独立的展示内容类型。

建议新增目录：

- `data/images` 存放上传图片文件

建议新增图片元数据结构，但它只服务于图片文件访问，不进入当前展示主模型。最小结构可以是：

```ts
interface ImageAsset {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
}
```

这里甚至可以不把图片资产放进主配置文件，只要能根据文件名访问即可。但从可维护性看，仍建议在配置或单独索引中保留图片元数据，便于删除与管理。

### API 设计

最小方案只需要增加图片资源接口，不需要引入 `currentDisplay` 一类的新模型。

建议增加：

- `POST /api/images` 上传图片，返回 `{ url }`
- `GET /api/images/[id]` 返回图片文件流
- 可选：`DELETE /api/images/[id]` 删除图片资源

其中 [`app/api/current/route.ts`](app/api/current/route.ts) 与 [`app/api/current/view/route.ts`](app/api/current/view/route.ts) 都可以保持现状。

`POST /api/images` 的典型处理流程：

1. 接收图片文件
2. 保存到 `data/images`
3. 生成访问 URL，如 `/api/images/{id}`
4. 基于固定模板拼出 HTML 字符串
5. 直接复用 [`lib/storage.ts`](lib/storage.ts) 中的 [`addPage`](lib/storage.ts:40) 保存为一个普通页面
6. 返回生成后的页面信息与图片 URL

这样管理后台拿到结果后，无需理解图片模式，只需要像普通页面那样加入列表、切换当前页即可。

### 图片模板页设计

你已经明确采用**最小模板**：只传图片 URL，全屏展示图片，不带标题和其他参数。

模板建议固定生成如下结构：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>图片展示</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
  </style>
</head>
<body>
  <img src="{{IMAGE_URL}}" alt="display-image" />
</body>
</html>
```

这里默认使用 `object-fit: contain`，因为最小方案的目标是**稳定展示完整图片**，避免裁切。

### 管理后台改造

[`app/admin/page.tsx`](app/admin/page.tsx) 不需要做成独立“图片模式管理”，只要增加一个“上传图片并生成页面”的入口即可。

推荐交互：

- 用户选择图片文件
- 调用 `POST /api/images`
- 接口返回新生成的页面记录
- 前端刷新现有页面列表
- 用户像切换普通 HTML 页面一样切换这张图片页

如果希望更顺手，也可以在上传成功后直接把该图片页设为当前页面，但这属于交互增强，不是最小必需项。

### 兼容性影响

这个方案的优势非常直接：

- 现有 `pages` 配置结构不用变
- 现有 `currentPageId` 不用变
- 现有首页 `iframe` 逻辑不用变
- 现有 SSE 刷新机制不用变
- 现有页面切换接口不用变

也就是说，真正新增的只是：

- 图片文件存储能力
- 图片访问 API
- 图片 HTML 模板生成逻辑
- 后台图片上传入口

### 与独立 image 模式方案对比

两种方案都能实现目标，但优先级已经变化。

**复用 HTML 链路方案**的优点：

- 改动面最小
- 兼容现有数据结构
- 前台几乎零改动
- 实现成本和测试范围更可控

它的不足是：

- 图片本质上仍被包装成 HTML 页面
- 后续若要做图片轮播、图片专属配置、图片统计，会比独立模型稍绕

**独立 image 模式方案**更适合长期演进，但对于当前目标来说明显偏重。

因此目前推荐路径应调整为：**先落地复用 HTML 的最小方案，等未来真的出现轮播、图片专属配置、多媒体统一管理需求时，再升级为独立展示模型。**

### 测试方案

项目规范要求执行 `pnpm typecheck`、`pnpm lint`、`pnpm test`，并使用 Vitest。建议增加以下测试：

在 `__tests__/lib` 中补充：

- 图片文件保存与读取测试
- 图片上传后自动生成 HTML 页面测试
- 删除图片资源时的文件清理测试

在 `__tests__/api` 中补充：

- `images` API 上传、查询、删除测试
- 图片上传后返回图片 URL 与页面信息测试
- 现有 `current` API 仍可直接切换生成后的图片页面测试

前端测试建议覆盖：

- [`app/page.tsx`](app/page.tsx) 继续稳定渲染 `iframe`
- [`app/admin/page.tsx`](app/admin/page.tsx) 图片上传入口的关键交互
- 上传图片后页面列表出现新生成页面的测试

## 实施顺序

推荐按下面顺序落地：

1. 在 [`lib/storage.ts`](lib/storage.ts) 增加图片文件保存与模板生成能力
2. 新增 [`app/api/images/route.ts`](app/api/images/route.ts) 与 [`app/api/images/[id]/route.ts`](app/api/images/[id]/route.ts)
3. 在 [`app/admin/page.tsx`](app/admin/page.tsx) 增加图片上传入口
4. 复用现有页面列表与切换逻辑完成展示
5. 补全测试并执行 `pnpm typecheck`、`pnpm lint`、`pnpm test`

## 风险点

主要风险有三类。

第一，[`app/admin/page.tsx`](app/admin/page.tsx) 当前文件已经很大，新增上传逻辑时要尽量复用现有方法，避免继续堆砌。

第二，图片 URL 注入 HTML 模板时要注意转义与安全性，避免拼接出非法 HTML。

第三，图片接口返回文件流时要正确设置 `Content-Type` 和缓存头，否则浏览器可能显示异常。

## 结论

当前更推荐的方案已经调整为：**把图片当作 HTML 页面的一种内容来源，而不是新增独立显示模式。**

这条路线对现有架构最友好，能够用最小代价完成“上传图片并展示”的目标。如果未来再出现轮播、混合媒体、图片专属参数等需求，再从这个基础上升级为独立内容模型会更稳妥。
