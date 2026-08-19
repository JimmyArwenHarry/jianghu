#!/usr/bin/env bash
# ============================================================
# 江湖录 · 香港轻量服务器 一次性初始化脚本（Ubuntu 22.04 / 24.04）
# 以 root 或 sudo 运行：sudo bash server-setup.sh
# 作用：安装 Node 20 + PM2 + Caddy（自动 HTTPS）+ git + curl
# 之后只需：clone 仓库 → 填 .env.local → bash deploy.sh
# ============================================================
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行：sudo bash server-setup.sh"
  exit 1
fi

echo "▶ 更新软件源"
apt-get update -y

echo "▶ 安装 Node.js 20（nodesource）"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "▶ 安装 PM2"
npm install -g pm2

echo "▶ 安装 Caddy（官方 stable 源，自动 HTTPS）"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

echo "▶ 安装 git"
apt-get install -y git

echo ""
echo "✅ 初始化完成，版本信息："
node -v
pm2 -v
caddy version

echo ""
echo "=== 下一步 ==="
echo "  1) git clone https://github.com/JimmyArwenHarry/jianghu.git"
echo "  2) cd jianghu && cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY"
echo "  3) bash deploy.sh"
echo "  4) 绑定域名（A 记录 → 本机 IP，免备案），按 DEPLOY_CHINA.md 第 5 步配置 Caddy"
