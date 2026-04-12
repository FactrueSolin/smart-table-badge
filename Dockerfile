FROM node:22-alpine AS base

# 使用国内镜像源，避免 Docker 构建阶段访问默认 npm 源失败
ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV npm_config_registry="$NPM_REGISTRY"
ENV PNPM_CONFIG_REGISTRY="$NPM_REGISTRY"
RUN npm install -g pnpm@10.32.1
RUN apk add --no-cache su-exec

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data/pages && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/data ./data

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "mkdir -p /app/data/pages && chown -R nextjs:nodejs /app/data && exec su-exec nextjs:nodejs node server.js"]
