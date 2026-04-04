# HTMLPush

> 让手机浏览器变成一个"桌面显示器"——后台推送 HTML 内容，手机端实时展示。

## 功能特性

- **实时推送**：后台切换内容，手机端通过 SSE 自动刷新
- **全屏展示**：支持浏览器全屏 + 横屏锁定，适合手机横屏放置
- **代码编辑**：管理页面内直接编写 HTML 代码并保存
- **密码保护**：管理后台需要密码认证，cookie 有效期 7 天
- **暗色模式**：管理页面自动跟随系统暗色/亮色模式

## 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 设置环境变量
cp .env.example .env.local
# 编辑 .env.local，设置 ADMIN_PASSWORD

# 启动开发服务器
pnpm dev
```

访问：
- 首页（手机展示）：http://localhost:3000
- 管理后台：http://localhost:3000/admin

### Docker 部署

```bash
# 方式一：docker-compose（推荐）
ADMIN_PASSWORD=your_password docker-compose up -d

# 方式二：直接构建运行
docker build -t htmlpush .
docker run -d -p 43210:3000 -e ADMIN_PASSWORD=your_password -v htmlpush-data:/app/data htmlpush
```

访问：http://localhost:43210

数据持久化在 `htmlpush-data` 卷中。

## 环境变量

| 变量名 | 说明 | 必填 | 默认值 |
|--------|------|------|--------|
| `ADMIN_PASSWORD` | 管理后台登录密码 | 是 | - |
| `PORT` | 服务端口 | 否 | 3000 |

## API 接口

详见 [OpenAPI 文档](docs/openapi.yaml)。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/pages` | 获取页面列表 |
| `POST` | `/api/pages` | 上传 HTML 文件 |
| `GET` | `/api/pages/[id]` | 获取页面内容 |
| `DELETE` | `/api/pages/[id]` | 删除页面 |
| `GET` | `/api/current` | 获取当前展示页面 |
| `PUT` | `/api/current` | 切换展示页面 |
| `GET` | `/api/sse` | SSE 实时推送 |

## 文档

- [软件架构](docs/软件架构.md) — 系统架构设计
- [手机展示 HTML 规范](docs/手机展示HTML规范.md) — 如何编写适合手机展示的 HTML（管理后台 `/admin` 中可直接复制 Markdown）
- [OpenAPI 文档](docs/openapi.yaml) — API 接口定义（管理后台 `/admin` 中可直接复制 Markdown）

## 技术栈

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- TypeScript 5
- bcryptjs（密码哈希）

## 许可证

MIT
