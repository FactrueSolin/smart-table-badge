# currentPageId API 方案

## 结论

直接编辑 [`data/config.json`](data/config.json) 不会触发同步，根因是页面刷新依赖应用内广播链路：[`setCurrentPage()`](lib/storage.ts:82) 写入配置后，由 [`PUT /api/current`](app/api/current/route.ts:13) 调用 [`broadcast()`](lib/sse.ts:29)，前端再通过 [`EventSource`](app/page.tsx:58) 监听 `content-changed` 事件完成刷新。**绕过 API 直接改 JSON，只改了存储，没有触发事件。**

因此更合适的方案，不是监听底层文件，而是**把 `currentPageId` 的变更统一收口到 API**。

## 接口设计

建议继续使用现有的 [`PUT /api/current`](app/api/current/route.ts:13)，将它明确为**唯一允许切换当前页面的写接口**。

请求体：

```json
{
  "pageId": "1776050757560-2g19q1"
}
```

返回约定：

```json
{
  "success": true,
  "pageId": "1776050757560-2g19q1"
}
```

失败时：

```json
{
  "error": "页面不存在"
}
```

接口职责保持单一：

1. 校验 `pageId` 是否存在
2. 调用 [`setCurrentPage()`](lib/storage.ts:82) 更新 [`data/config.json`](data/config.json)
3. 调用 [`broadcast()`](lib/sse.ts:29) 推送 `content-changed`
4. 返回最终状态给调用方

这样，管理端、脚本、外部系统都可以通过同一入口修改 `currentPageId`，同步行为也会天然一致。

## 实现细化

建议把方案收敛成下面几个点：

### 1. 保持写入入口唯一

保留 [`PUT /api/current`](app/api/current/route.ts:13) 作为写入口，不再鼓励直接修改 [`data/config.json`](data/config.json)。

如果后续需要给外部程序调用，可以在文档中明确：

```bash
curl -X PUT http://localhost:3000/api/current \
  -H 'Content-Type: application/json' \
  -d '{"pageId":"1776050757560-2g19q1"}'
```

### 2. 响应体补充结果信息

当前 [`PUT /api/current`](app/api/current/route.ts:13) 成功时只返回 `{ success: true }`。建议补充：

- `pageId`
- 可选的 `timestamp`

这样便于脚本调用方确认写入结果，也更方便排查同步问题。

### 3. 测试覆盖接口契约

在 [`__tests__/api/current.test.ts`](__tests__/api/current.test.ts) 中补充或调整断言：

- 成功时返回 `success` 与 `pageId`
- 缺少 `pageId` 返回 `400`
- `pageId` 不存在返回 `404`
- 成功时调用 [`broadcast()`](lib/sse.ts:29)

### 4. 文档明确操作方式

可在 [`README.md`](README.md) 或管理文档中增加一小节：

- 不建议手改 [`data/config.json`](data/config.json)
- 若需切页，请调用 [`PUT /api/current`](app/api/current/route.ts:13)
- 这样才能触发前端的 SSE 同步

## 执行清单

- [ ] 调整 [`PUT /api/current`](app/api/current/route.ts:13) 的成功响应结构
- [ ] 为 [`PUT /api/current`](app/api/current/route.ts:13) 补齐广播相关测试
- [ ] 在 [`README.md`](README.md) 或对应文档补充接口使用说明
- [ ] 保持所有 `currentPageId` 更新都通过 API 入口完成

## 说明

这个方案的核心不是“让直接改 JSON 也触发”，而是**避免直接改 JSON**。因为当前系统已经有完整的同步链路，只要把变更入口统一到 [`PUT /api/current`](app/api/current/route.ts:13)，就能稳定触发页面同步，且实现成本更低、可维护性更好。

## 外部调用鉴权方案

## 结论

如果 [`PUT /api/current`](app/api/current/route.ts:13) 现在受管理员 Cookie 鉴权保护，而你又希望外部系统调用，那么**最合适的做法不是去掉鉴权，而是给这个接口增加第二种机器可用鉴权方式**。

建议采用：**`Bearer Token` 方案**。

原因很直接：

- 外部系统通常不适合维护登录态 Cookie
- `Authorization: Bearer <token>` 更适合脚本、自动化平台、硬件端调用
- 可以和现有 [`isAuthenticated()`](lib/auth.ts:37) 并存，不影响管理后台

## 推荐设计

建议把 [`PUT /api/current`](app/api/current/route.ts:13) 改成**双通道鉴权**：

1. 浏览器管理端继续使用现有 Cookie 登录态
2. 外部系统允许使用 `Authorization` 头携带独立的 API Token

例如请求：

```bash
curl -X PUT http://localhost:3000/api/current \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-current-page-api-token' \
  -d '{"pageId":"1776050757560-2g19q1"}'
```

建议新增环境变量：

```env
CURRENT_PAGE_API_TOKEN=your-current-page-api-token
```

然后新增一个专用校验函数，例如放在 [`lib/auth.ts`](lib/auth.ts) 中：

- 读取 `Authorization` 请求头
- 解析 `Bearer token`
- 与 `process.env.CURRENT_PAGE_API_TOKEN` 做常量时间比较
- 成功则允许外部调用

这样可以避免把管理员密码直接暴露给外部系统，也避免让外部系统伪造后台登录 Cookie。

## 接口行为建议

[`PUT /api/current`](app/api/current/route.ts:13) 的鉴权逻辑建议改为：

```ts
if (!(await isAuthenticated()) && !isValidCurrentPageApiToken(request)) {
  return NextResponse.json({ error: '未授权' }, { status: 401 })
}
```

这样有几个好处：

- **兼容现有后台**，管理端无需改造
- **开放给外部系统**，脚本可直接调用
- **权限范围清晰**，只给切页能力，不等于后台全权限

如果想把权限收得更紧，可以进一步不要复用 [`PUT /api/current`](app/api/current/route.ts:13)，而是拆成专用外部接口，例如：[`POST /api/external/current`](app/api/current/route.ts:13)。但从当前项目规模看，**先在现有接口上增加 Bearer Token 支持更实用**。

## 安全边界

这个 Token 方案需要配套几个限制：

1. Token 使用独立环境变量，不复用 [`ADMIN_PASSWORD`](lib/auth.ts:44)
2. Token 只用于切页接口，不自动扩展到其他管理 API
3. 文档中明确要求通过 HTTPS 传输
4. 返回体不要泄露鉴权细节，失败统一返回 `401`

如果未来外部调用会越来越多，再考虑：

- 请求签名
- IP 白名单
- 可轮换的多 Token 管理
- 审计日志

但对当前需求，**独立 `Bearer Token` 已经足够干净且可维护**。

## 实施清单补充

- [ ] 在 [`lib/auth.ts`](lib/auth.ts) 增加外部 API Token 校验函数
- [ ] 在 [`app/api/current/route.ts`](app/api/current/route.ts:13) 支持 Cookie + Bearer Token 双通道鉴权
- [ ] 在 [`__tests__/api/current.test.ts`](__tests__/api/current.test.ts) 增加外部 Token 调用成功与失败测试
- [ ] 在 [`.env.example`](.env.example) 补充 `CURRENT_PAGE_API_TOKEN`
- [ ] 在 [`README.md`](README.md) 补充外部调用示例
