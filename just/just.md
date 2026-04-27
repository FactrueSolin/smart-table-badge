# Just 命令说明

本项目的根目录 `justfile` 只作为命令入口，实际脚本统一维护在 `just/` 目录中。

`justfile` 不直接加载 `.env`。环境文件由 macOS 服务启动脚本读取，这样密码或 token 中包含 `"`、`:`、`/` 等字符时，不会被 `just` 或 shell 提前解析。

## 前置要求

- 安装 `just`
- 安装 Node.js 与 `pnpm`
- 首次运行前准备 `.env`，至少配置 `ADMIN_PASSWORD`

## 日常开发命令

```bash
just
```

列出所有可用命令。

```bash
just install
```

使用 `pnpm install --frozen-lockfile` 安装依赖。

```bash
just dev
```

启动本地开发服务。

```bash
just typecheck
just lint
just test
just check
```

分别执行类型检查、代码检查、测试；`just check` 会按顺序执行 `typecheck`、`lint`、`test`。

```bash
just build
just start
```

构建生产包并启动生产服务。当前项目启用了 Next.js standalone 输出，macOS 部署脚本会优先使用 `.next/standalone/server.js`。

## macOS 直接部署

```bash
just deploy-macos
```

部署为 macOS system LaunchDaemon，默认 plist 写入：

```text
/Library/LaunchDaemons/com.factrue.smart-table-badge.plist
```

默认服务会以当前用户运行，默认监听：

```text
MACOS_SERVICE_HOST=0.0.0.0
PORT=43210
```

部署过程会执行：

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

然后生成 launchd 配置并启动服务。

```bash
just deploy-macos-user
```

部署为当前用户 LaunchAgent，plist 写入：

```text
~/Library/LaunchAgents/com.factrue.smart-table-badge.plist
```

适合不想写入系统级服务，或没有 sudo 权限的机器。

## 服务管理命令

```bash
just macos-status
```

查看 launchd 服务状态。

```bash
just macos-restart
```

重启服务。

```bash
just macos-logs
just macos-logs-follow
```

查看日志；`macos-logs-follow` 会持续跟随日志输出。

system 服务默认日志目录：

```text
/var/log/smart-table-badge/
```

user 服务默认日志目录：

```text
~/Library/Logs/smart-table-badge/
```

```bash
just macos-uninstall
```

卸载 launchd 服务并删除 plist。该命令不会删除项目目录、`.env` 或 `data/` 数据。

## 常用环境变量

所有变量都可以在命令前临时指定：

```bash
PORT=43210 just deploy-macos
```

常用变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `43210` | 服务监听端口 |
| `MACOS_SERVICE_HOST` | `0.0.0.0` | 服务绑定地址，会写入 Next.js 需要的 `HOSTNAME` |
| `MACOS_SERVICE_SCOPE` | `system` | `system` 或 `user` |
| `MACOS_SERVICE_LABEL` | `com.factrue.smart-table-badge` | launchd 服务 label |
| `MACOS_SERVICE_SLUG` | `smart-table-badge` | 日志目录和文件名使用的短名称 |
| `MACOS_SERVICE_USER` | 当前用户 | system 服务实际运行用户 |
| `MACOS_SERVICE_GROUP` | 用户默认组或 `staff` | system 服务实际运行用户组 |
| `MACOS_SERVICE_LOG_DIR` | 按 scope 自动推导 | 自定义日志目录 |
| `MACOS_SERVICE_PATH` | Homebrew 与系统常用路径 | launchd 内部 `PATH` |
| `NODE_BIN` | `command -v node` | 指定 Node.js 绝对路径 |
| `PNPM_BIN` | `command -v pnpm` | 指定 pnpm 绝对路径 |
| `MACOS_DEPLOY_SKIP_INSTALL` | `0` | 设为 `1` 跳过依赖安装 |
| `MACOS_DEPLOY_SKIP_CHECKS` | `0` | 设为 `1` 跳过 typecheck/lint/test |
| `MACOS_DEPLOY_SKIP_BUILD` | `0` | 设为 `1` 跳过构建 |

示例：

```bash
PORT=43210 MACOS_SERVICE_LABEL=com.example.htmlpush just deploy-macos
```

```bash
MACOS_SERVICE_SCOPE=user PORT=43210 just/macos-deploy.sh install
```

```bash
MACOS_DEPLOY_SKIP_CHECKS=1 just deploy-macos
```

## 配置与数据说明

服务启动时会按顺序加载项目根目录中的环境文件：

```text
.env
.env.local
.env.production
.env.production.local
```

项目数据仍保存在项目根目录的 `data/` 下。由于当前 Next.js 使用 standalone 输出，部署脚本会在 `.next/standalone/` 中创建指向项目根目录 `data/` 和 `docs/` 的符号链接，避免生产服务把运行数据写到构建目录里。
