#!/usr/bin/env bash
# ============================================================
# 江湖录 · 香港轻量服务器 一键部署/更新脚本
# 用法：
#   首次部署：bash deploy.sh   （自动 git pull + 装依赖 + 构建 + 启动/重启 PM2）
#   以后更新：bash deploy.sh   （同一命令，自动拉最新代码并重建）
# 前置：Node 20+、PM2、git 已装好（见 DEPLOY_CHINA.md / server-setup.sh）
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="jianghu"
PORT="${PORT:-3000}"
cd "$APP_DIR"

echo "▶ 1/5 拉取最新代码"
if [ -d .git ]; then
  git pull --ff-only origin main 2>/dev/null || echo "   ⚠️  git pull 失败（忽略，继续用现有代码）"
fi

echo "▶ 2/5 检查环境变量"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "   ⚠️  已生成 .env.local，请先填入 DEEPSEEK_API_KEY："
  echo "      vim $APP_DIR/.env.local"
  exit 1
fi

echo "▶ 3/5 安装依赖"
npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

echo "▶ 4/5 构建"
npm run build

echo "▶ 5/5 启动/重启 PM2"
pm2 startOrReload ecosystem.config.js --env production
pm2 save --force 2>/dev/null || true

echo ""
echo "✅ 部署完成"
echo "   - 本机端口：${PORT}"
echo "   - 对外访问：通过 Caddy https（见 DEPLOY_CHINA.md 第 5 步绑定域名）"
echo "   - 进程状态："
pm2 status "$APP_NAME" 2>/dev/null || true
