# AI 生图后端技术规范

## 1. 文档目的

本文档基于 [`AI生图架构.md`](./AI生图架构.md) 与 [`AI生图数据库设计.md`](./AI生图数据库设计.md)，补充 AI 生图能力在当前仓库中的后端落地规范。

本文档解决三类问题：

- 明确 AI 生图领域的后端边界、分层和职责
- 定义稳定可执行的 API 契约、状态机、错误码和事件规范
- 对数据库访问、异步推进、对象存储、Provider 适配等技术选型做出裁决

本文档是第一阶段实现的直接依据。实现如与本文档冲突，以本文档为准；数据库细节以 [`AI生图数据库设计.md`](./AI生图数据库设计.md) 为准。

## 2. 适用范围

第一阶段范围：

- 文生图 `text_to_image`
- 单 Provider 接入：ModelScope
- 任务制异步提交与状态查询
- 生成结果导入现有图片资产体系
- 管理后台可查询、取消、查看状态
- 基于现有 `/api/sse` 的任务状态推送

第一阶段不纳入范围：

- 前端同步阻塞等待出图
- 多 Provider 编排
- 用户级多租户隔离
- 外部用户开放 API Key 模式
- 任意第三方图片 URL 直传图生图
- 回调式 Provider 接入

## 3. 总体裁决

### 3.1 服务形态

第一阶段不拆独立微服务，继续采用当前仓库的一体化形态：

- API 层：Next.js App Router Route Handlers
- 领域层：`lib/ai/image-generation/*`
- 持久化层：PostgreSQL
- 资产层：复用现有图片存储与页面生成逻辑

裁决原因：

- 当前项目已有 Route Handler、OpenAPI、SSE、文件存储能力
- AI 生图与现有图片资产链路强耦合，拆服务会增加跨服务一致性成本
- 第一阶段目标是快速形成稳定领域能力，不是搭建新的基础平台

### 3.2 Runtime

AI 生图相关 API 一律运行在 Node.js Runtime，不使用 Edge Runtime。

要求：

- 路由文件显式声明 `export const runtime = 'nodejs'`
- 允许使用数据库驱动、文件系统、二进制下载和图片导入逻辑

### 3.3 数据库

数据库选型裁决：

- 关系型数据库：PostgreSQL 16+
- 元数据持久化：必须数据库化，不再依赖 `data/image-generation-jobs.json`
- 图片与 HTML 文件：继续存本地文件系统或对象存储，不入库二进制

原因：

- 任务状态机、幂等导入、事件审计都依赖事务与唯一约束
- `jsonb` 可以保存 Provider 调试快照
- 后续接入多 Provider、多模型、多审计查询仍可演进

### 3.4 数据库访问层

数据库访问层推荐选型：

- 首选：`drizzle-orm` + `drizzle-kit`
- 备选：参数化 SQL + 自建 repository
- 不推荐第一阶段使用 Prisma

裁决说明：

- `drizzle-orm` 与 TypeScript 强类型契合度高，适合当前仓库“禁止 `any`”的规范
- schema、迁移、查询类型可统一维护，适合中小规模领域建模
- Prisma 在简单 CRUD 很高效，但本项目存在状态机推进、条件更新、行锁、局部 JSON 审计等需求，第一阶段收益不如 Drizzle 明确
- 对于 `select ... for update`、批量补偿导入、定制 SQL 索引，可允许 repository 内局部使用原生 SQL

### 3.5 异步推进方式

任务推进策略裁决：

- 第一阶段主策略：请求触发同步
- 第一阶段补偿策略：定时触发同步到期任务
- 禁止把进程内定时器作为正确性前提

落地要求：

- `GET /api/ai/images/jobs/{id}` 在任务未终态且达到 `next_sync_at` 时，允许内部执行一次同步
- 生产环境应补充定时补偿机制，主动推进 `next_sync_at <= now()` 的任务
- 定时补偿可采用受保护的内部 API 或独立 worker 进程，但不影响主 API 契约

不采用“常驻内存轮询器”的原因：

- Next.js Route Handler 部署形态不适合把关键状态推进绑定到单进程内存
- 页面刷新、服务重启、实例伸缩后必须仍能恢复任务

### 3.6 对象存储

对象存储裁决：

- 第一阶段继续复用当前本地文件存储能力
- 代码层必须抽象 `StorageAdapter`，不得在 Provider/Service 中直接操作具体路径
- 第二阶段可平滑切换到 S3 兼容对象存储

### 3.7 API 规范

AI 生图 API 必须遵循当前仓库已有规范：

- 参数校验：Zod
- 接口文档：OpenAPI Registry 注册
- 产物更新：执行 `pnpm openapi:generate`
- Route Handler 不直接堆叠业务逻辑，复杂流程进入 Service

### 3.8 实时通知

实时通知裁决：

- 继续复用现有 `/api/sse`
- 新增独立事件类型 `ai-image-job-changed`
- 不与现有 `content-changed` 事件复用同一 payload 结构

## 4. 模块分层规范

建议目录结构：

```text
app/api/ai/images/jobs/route.ts
app/api/ai/images/jobs/[id]/route.ts
app/api/ai/images/jobs/[id]/cancel/route.ts
app/api/internal/ai/images/jobs/sync-due/route.ts
lib/openapi/schemas/ai-image.ts
lib/ai/image-generation/types.ts
lib/ai/image-generation/service.ts
lib/ai/image-generation/repository.ts
lib/ai/image-generation/importer.ts
lib/ai/image-generation/state-machine.ts
lib/ai/image-generation/providers/types.ts
lib/ai/image-generation/providers/provider-factory.ts
lib/ai/image-generation/providers/modelscope/client.ts
lib/ai/image-generation/providers/modelscope/provider.ts
lib/db/*
```

职责边界：

- Route Handler：认证、解析、校验、HTTP 响应、OpenAPI 注册
- Service：任务创建、状态推进、取消、导入、事件广播
- Repository：数据库读写、事务、锁、幂等约束
- Importer：下载远端图片并导入本地图片资产
- Provider：第三方接口封装、状态映射、错误翻译

禁止事项：

- Route Handler 直接操作 Provider
- Provider 直接写数据库
- Importer 直接决定任务状态机流转
- 前端透传 Provider 原始参数对象

## 5. 领域模型规范

### 5.1 任务模式

第一阶段仅支持：

- `text_to_image`

预留但不开放：

- `image_to_image`

当第二阶段接入图生图时，请求体只能传 `sourceImageAssetId`，不得接受任意公网 `imageUrl`，以避免 SSRF、临时链接失效和审计断链。

### 5.2 任务状态

任务状态定义：

- `queued`
- `submitted`
- `processing`
- `succeeded`
- `failed`
- `timed_out`
- `canceled`
- `import_failed`

终态：

- `succeeded`
- `failed`
- `timed_out`
- `canceled`
- `import_failed`

状态机约束：

- 不允许从终态回退到非终态
- 不允许跳过 `submitted` 直接进入 `processing`
- `succeeded` 前提是至少一张输出已成功导入资产库
- `import_failed` 表示 Provider 已成功但本地导入未完成

### 5.3 输出结果

一个任务可产生多张结果图，因此输出必须单独建模，禁止在任务表上只保留单个 `imageId`。

对外响应中，每张输出至少包含：

- `id`
- `outputIndex`
- `status`
- `imageAssetId`
- `pageId`
- `imageUrl`
- `pageUrl`
- `errorMessage`

### 5.4 Provider 原始数据

允许保存以下原始快照：

- `provider_request_payload`
- `provider_response_payload`

限制：

- 仅用于调试与审计
- 不对前端原样返回
- 业务逻辑不得依赖 JSON 任意字段

## 6. API 契约

### 6.1 认证

以下接口必须复用现有后台认证能力，仅管理员可调用：

- `POST /api/ai/images/jobs`
- `GET /api/ai/images/jobs`
- `GET /api/ai/images/jobs/{id}`
- `POST /api/ai/images/jobs/{id}/cancel`
- `POST /api/internal/ai/images/jobs/sync-due`

### 6.2 创建任务

`POST /api/ai/images/jobs`

请求头：

- 可选：`Idempotency-Key`

请求体：

```json
{
  "name": "春季海报",
  "mode": "text_to_image",
  "prompt": "A premium spring sale poster, clean layout, realistic flowers",
  "negativePrompt": "blurry, low quality, watermark",
  "model": "Qwen/Qwen-Image",
  "size": "1024x1024",
  "seed": 12345,
  "steps": 30,
  "guidance": 3.5
}
```

字段约束：

- `name`: `1..200`
- `mode`: 第一阶段固定为 `text_to_image`
- `prompt`: `1..4000`
- `negativePrompt`: `0..4000`
- `model`: 必须命中服务端白名单
- `size`: 必须命中服务端白名单，例如 `1024x1024`
- `seed`: `0..2147483647`
- `steps`: 根据模型白名单约束，例如 `1..50`
- `guidance`: 根据模型白名单约束，例如 `0..20`

返回码：

- `201 Created`: 创建成功
- `400 Bad Request`: 参数格式错误
- `401 Unauthorized`: 未认证
- `409 Conflict`: 幂等键冲突但请求体不一致
- `422 Unprocessable Entity`: 参数合法但不满足模型约束
- `502 Bad Gateway`: Provider 提交失败

成功响应：

```json
{
  "job": {
    "id": "job_01HSX8P4T3Q4S6R7N8A9BCDEFG",
    "name": "春季海报",
    "mode": "text_to_image",
    "provider": "modelscope",
    "model": "Qwen/Qwen-Image",
    "status": "submitted",
    "prompt": "A premium spring sale poster, clean layout, realistic flowers",
    "negativePrompt": "blurry, low quality, watermark",
    "size": "1024x1024",
    "seed": 12345,
    "steps": 30,
    "guidance": 3.5,
    "remoteTaskId": "ms_task_xxx",
    "statusReason": null,
    "errorMessage": null,
    "outputs": [],
    "createdAt": "2026-04-19T10:00:00.000Z",
    "updatedAt": "2026-04-19T10:00:01.000Z",
    "submittedAt": "2026-04-19T10:00:01.000Z",
    "completedAt": null
  }
}
```

规范要求：

- 服务端必须先创建本地任务，再调用 Provider
- 成功后写入 `remote_task_id`
- 若 Provider 提交失败，任务状态更新为 `failed` 或保留 `queued` 后再统一失败化，不得丢失本地审计记录
- `Idempotency-Key` 命中时，必须返回首次创建的任务结果

### 6.3 任务列表

`GET /api/ai/images/jobs`

查询参数：

- `status`
- `provider`
- `model`
- `cursor`
- `limit`

分页要求：

- 默认按 `created_at desc`
- 使用游标分页，不使用 offset 分页
- `limit` 默认 `20`，最大 `100`

返回码：

- `200 OK`
- `401 Unauthorized`

成功响应：

```json
{
  "items": [],
  "nextCursor": null
}
```

列表接口规范：

- 不主动同步远端状态
- 仅返回任务摘要和输出摘要
- 不返回 `provider_request_payload`、`provider_response_payload`

### 6.4 任务详情

`GET /api/ai/images/jobs/{id}`

查询参数：

- `sync`: 可选，默认 `true`

行为规范：

- 当 `sync=true` 且任务未终态且达到 `next_sync_at`，服务端允许执行一次同步
- 同步失败时，接口仍返回当前任务状态，但需更新错误审计和同步次数
- 已终态任务不得再次访问 Provider，除非后续补偿导入明确需要

返回码：

- `200 OK`
- `401 Unauthorized`
- `404 Not Found`

成功响应字段要求：

- 返回完整任务信息
- 返回输出列表及已导入的 `imageUrl`、`pageUrl`
- 返回 `syncAttempts`、`lastSyncedAt`

### 6.5 取消任务

`POST /api/ai/images/jobs/{id}/cancel`

行为规范：

- 本地取消优先
- 若 Provider 不支持取消，则只将本地任务标记为 `canceled`
- 已终态任务重复取消时，直接返回当前任务，不报错
- 已进入 `succeeded` 的任务不允许取消后回退

返回码：

- `200 OK`
- `401 Unauthorized`
- `404 Not Found`
- `409 Conflict`

### 6.6 到期任务补偿同步

`POST /api/internal/ai/images/jobs/sync-due`

用途：

- 供 Cron、运维任务或独立 worker 主动推进到期任务

鉴权要求：

- 必须使用独立内部密钥，例如 `INTERNAL_CRON_TOKEN`
- 不对管理后台暴露

请求体：

```json
{
  "limit": 20
}
```

响应体：

```json
{
  "picked": 20,
  "processed": 18,
  "succeeded": 4,
  "failed": 2
}
```

## 7. 响应结构与错误码规范

### 7.1 成功响应

AI 生图领域接口统一采用对象包装：

```json
{
  "job": {}
}
```

或

```json
{
  "items": [],
  "nextCursor": null
}
```

### 7.2 错误响应

推荐错误响应结构：

```json
{
  "error": {
    "code": "AI_IMAGE_MODEL_NOT_ALLOWED",
    "message": "当前模型不在允许列表内",
    "retryable": false
  },
  "requestId": "req_01HSX8..."
}
```

错误码约定：

- `AI_IMAGE_INVALID_INPUT`
- `AI_IMAGE_MODEL_NOT_ALLOWED`
- `AI_IMAGE_SIZE_NOT_ALLOWED`
- `AI_IMAGE_JOB_NOT_FOUND`
- `AI_IMAGE_JOB_STATE_CONFLICT`
- `AI_IMAGE_PROVIDER_SUBMIT_FAILED`
- `AI_IMAGE_PROVIDER_POLL_FAILED`
- `AI_IMAGE_PROVIDER_TIMEOUT`
- `AI_IMAGE_IMPORT_FAILED`
- `AI_IMAGE_UNAUTHORIZED`
- `AI_IMAGE_IDEMPOTENCY_CONFLICT`

要求：

- `message` 面向前端展示，可直接阅读
- `code` 面向程序判断，发布后需保持兼容
- `retryable` 表示调用方是否可安全重试

## 8. SSE 事件规范

继续复用现有 `/api/sse`，新增事件：

```text
event: ai-image-job-changed
data: {"jobId":"job_xxx","status":"processing","event":"job_processing","timestamp":1770000000000}
```

payload 字段：

- `jobId`
- `status`
- `event`
- `timestamp`
- `imageAssetIds`
- `pageIds`

事件触发时机：

- 任务创建
- 任务提交成功
- 任务进入处理
- 任务成功
- 任务失败
- 任务取消
- 输出导入成功
- 导入失败

要求：

- SSE 只推送摘要，不推送完整任务对象
- 前端收到事件后再调用详情接口拉取最新状态

## 9. Provider 适配规范

统一接口：

```ts
export interface ImageGenerationProvider {
  readonly provider: 'modelscope';
  submit(input: ProviderSubmitInput): Promise<ProviderSubmittedTask>;
  getTask(taskId: string): Promise<ProviderTaskSnapshot>;
}
```

Provider 层要求：

- 屏蔽第三方 header、状态码、异常格式差异
- 将远端状态映射为本地统一状态语义
- 返回脱敏错误，不把敏感 header 和 token 暴露到日志
- 严禁向上层暴露不稳定的原始响应结构作为业务契约

ModelScope 适配要求：

- 提交接口：`POST /v1/images/generations`
- 提交头：`X-ModelScope-Async-Mode: true`
- 查询接口：`GET /v1/tasks/{task_id}`
- 查询头：`X-ModelScope-Task-Type: image_generation`

环境变量：

- `MODELSCOPE_API_TOKEN`
- `MODELSCOPE_API_BASE_URL`
- `MODELSCOPE_IMAGE_DEFAULT_MODEL`
- `MODELSCOPE_IMAGE_ALLOWED_MODELS`
- `MODELSCOPE_IMAGE_TIMEOUT_SECONDS`
- `MODELSCOPE_IMAGE_POLL_INTERVAL_MS`
- `MODELSCOPE_IMAGE_MAX_ATTEMPTS`

模型控制要求：

- 必须维护白名单，不允许前端传任意模型 ID
- 模型白名单需附带允许尺寸、步数范围、guidance 范围等约束

## 10. 幂等、并发与事务规范

### 10.1 创建任务幂等

创建任务接口支持 `Idempotency-Key`：

- 相同 key + 相同请求语义：返回同一任务
- 相同 key + 不同请求体：返回 `409 Conflict`
- key 建议保存 24 小时

### 10.2 同步任务并发控制

同步任务时必须满足以下约束：

- 事务内读取任务
- 对任务主记录使用行锁
- 导入输出时使用唯一约束保护
- 更新任务时使用 `version` 乐观锁或条件更新

幂等锚点：

- `image_generation_job_outputs(job_id, output_index)` 唯一
- `image_assets.generation_output_id` 唯一
- `(provider, remote_task_id)` 唯一

### 10.3 导入流程

导入流程要求：

- 下载远端图片
- 校验 MIME 类型与大小上限
- 计算内容摘要
- 调用现有图片资产存储逻辑入库
- 回写 `image_asset_id`、`page_id`

禁止事项：

- 前端直接使用 Provider 临时 URL 作为最终展示地址
- 因重复同步生成重复图片资产

## 11. 安全规范

### 11.1 鉴权与权限

- AI 生图接口只允许后台管理员调用
- 内部补偿接口必须使用独立 token，不复用用户会话

### 11.2 输入安全

- `prompt`、`negativePrompt` 只做文本存储，不直接拼接执行命令
- 图生图阶段仅接受 `sourceImageAssetId`，不接受用户任意 URL
- 白名单控制 `model`、`size`、`steps`、`guidance`

### 11.3 日志脱敏

日志中必须记录：

- `requestId`
- `jobId`
- `provider`
- `remoteTaskId`
- `status`

日志中不得直接记录：

- `MODELSCOPE_API_TOKEN`
- 完整认证 cookie
- 未脱敏 Provider 响应头

对于 `prompt`，只记录摘要、长度或截断内容。

## 12. 观测性规范

必须记录以下审计事件：

- `job_created`
- `job_submitted`
- `job_processing`
- `job_succeeded`
- `job_failed`
- `job_timed_out`
- `job_canceled`
- `job_import_failed`
- `job_output_imported`

监控指标建议：

- 任务创建量
- 任务成功率
- 平均提交耗时
- 平均完成耗时
- 导入失败率
- Provider 轮询错误率

## 13. 测试规范

实现阶段必须补充 Vitest 测试，最少覆盖：

- 状态机迁移合法性
- Provider 状态到本地状态的映射
- 创建任务幂等
- 输出导入幂等
- 终态任务重复同步安全性
- 取消任务的状态约束

测试分层要求：

- 单元测试：`state-machine`、`provider mapper`、`service` 纯逻辑
- 集成测试：repository 事务与唯一约束、Route Handler 参数校验

验收命令：

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`

## 14. 第一阶段实施清单

1. 建立 PostgreSQL 表结构与迁移脚本。
2. 实现 `lib/db` 与 AI 生图 repository。
3. 实现 ModelScope Provider 与统一状态映射。
4. 实现 `POST/GET/cancel` 三个管理接口。
5. 接入 OpenAPI schema 与文档生成。
6. 接入 SSE 事件推送。
7. 复用现有图片资产导入链路。
8. 增加到期任务补偿同步能力。
9. 完成 Vitest 测试与回归检查。

## 15. 明确不做

以下方案在第一阶段明确不采用：

- 独立 AI 生图微服务
- 纯内存任务队列
- 前端直连第三方 Provider
- 直接暴露 Provider 原始响应
- 允许任意外部 URL 作为图生图输入
- 未经白名单控制的模型透传
