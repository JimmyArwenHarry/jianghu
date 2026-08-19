# ============================================================
# 江湖录 · Docker 构建（可选，与 PM2 方案二选一）
# 说明：把服务端(Next.js)打包成镜像，Caddy 在 docker-compose 里做 HTTPS。
# 构建/启动：docker compose up -d --build
# ============================================================

# ---- 依赖层 ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---- 构建层 ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 运行层 ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.env.example ./.env.example
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-p", "3000"]
