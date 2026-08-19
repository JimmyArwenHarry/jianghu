#!/usr/bin/env bash
# ============================================================
# 江湖录 · 本地电脑分享（cpolar 内网穿透，免费）
# 目标：把本机跑起来的江湖录，生成一个公网 https 链接，发微信就能点开即玩。
#
# 首次使用（只需做一次）：
#   1) 去 https://www.cpolar.com 注册免费账号（邮箱即可，不用实名）
#   2) 登录后在"验证"页复制你的 Authtoken
#   3) 执行：cpolar authtoken 你的Authtoken
#   4) 以后每次分享只需：bash tunnel.sh
#
# 注意事项：
#   - 本脚本自动开启防休眠（插电源时阻止系统睡眠），但合盖睡眠仍会断，
#     请保持开盖运行，或外接显示器（合盖模式）
#   - cpolar 免费版公网地址每 24 小时 / 重启会更换，每次运行请重新复制链接发给朋友
#   - Ctrl+C 关闭脚本后，游戏服务与隧道随之停止
# ============================================================
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"
PORT="${PORT:-3000}"

echo "▶ 0/5 检查 cpolar"
if ! command -v cpolar >/dev/null 2>&1; then
  echo "   未安装 cpolar，先执行："
  echo "     brew tap probezy/core && brew trust probezy/core && brew install cpolar"
  exit 1
fi

echo "▶ 1/5 检查环境变量"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "   ⚠️  已生成 .env.local，请先填入 DEEPSEEK_API_KEY 再运行：vim $APP_DIR/.env.local"
  exit 1
fi

echo "▶ 2/5 检查依赖与构建"
[ -d node_modules ] || { echo "   安装依赖..."; npm ci --no-audit --no-fund; }
[ -d .next ] || { echo "   首次构建..."; npm run build; }

echo "▶ 3/5 开启防休眠（插电源时阻止系统睡眠；合盖睡眠无法阻止，请保持开盖）"
caffeinate -s &
CAFFEINATE_PID=$!

echo "▶ 4/5 启动游戏服务（生产模式 :${PORT}）"
SERVER_PID=""
if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}" 2>/dev/null; then
  echo "   已检测到 :${PORT} 正在运行，直接复用"
else
  npm run start -- -p "$PORT" > /tmp/jianghu-server.log 2>&1 &
  SERVER_PID=$!
  for i in $(seq 1 30); do
    curl -fsS -o /dev/null "http://127.0.0.1:${PORT}" 2>/dev/null && break
    sleep 1
  done
fi
echo "   ✓ 本机已就绪：http://127.0.0.1:${PORT}"

cleanup() {
  [ -n "${CAFFEINATE_PID:-}" ] && kill "$CAFFEINATE_PID" 2>/dev/null
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT

echo "▶ 5/5 启动 cpolar 隧道"
echo ""
echo "================================================================"
echo "  下面 cpolar 输出的 https://xxxx.cpolar.top 就是对外链接，"
echo "  复制它发给微信朋友，点开即玩。"
echo "  提示：免费版地址每 24 小时 / 重启会换，每次分享请重新复制。"
echo "================================================================"
echo ""
cpolar http "$PORT"
