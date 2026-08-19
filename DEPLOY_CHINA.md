# 🇨🇳 国内免翻墙部署指南（香港轻量服务器）

《江湖录》目前跑在 Vercel（`vercel.app` 在国内被墙），要让国内朋友不翻墙也能玩，
把它部署到**香港云服务器**即可 —— 香港节点大陆直连、**免备案**，且 DeepSeek API 本身就是国内服务，服务器直连毫无障碍。

> 预算：服务器约 ¥24~40/月 + 域名约 ¥60~70/年，总成本一年约 ¥400。纯文字游戏，2C2G 轻松扛几十个朋友同时玩。

```
国内朋友 ──▶ https://你的域名（国内直连）
                  │
            香港服务器  [Caddy 自动 HTTPS]
                  │ 反向代理 127.0.0.1:3000
             Node.js 20 + PM2 运行 Next.js
                  │
            服务端调用 api.deepseek.com（国内服务，直连）
```

---

## 第 1 步：买一台香港轻量服务器

任选一家（价格/活动差不多，看手头优惠）：

| 平台 | 购买入口 | 建议配置 | 参考价 |
| --- | --- | --- | --- |
| 腾讯云 | 轻量应用服务器 | 香港 · 2核2G · Ubuntu 22.04 | 约 ¥24~40/月 |
| 阿里云 | 轻量应用服务器 | 香港 · 2核2G · Ubuntu 22.04 | 约 ¥34~45/月 |

> ⚠️ **务必选「香港」节点**（或新加坡等境外节点），大陆节点必须 ICP 备案。
> 系统选 **Ubuntu 22.04**。买完后在控制台的**防火墙/安全组**里放行 `80` 和 `443` 端口。

## 第 2 步：买一个域名并解析（免备案）

1. 在 腾讯云/阿里云（国际域名）/Namecheap/GoDaddy 任买一个 `.com`（约 ¥60~70/年，新用户 .top/.xyz 更便宜）。
2. 在域名控制台加一条 **A 记录**：
   - 主机记录：`@`（或 `www`）
   - 记录值：**服务器公网 IP**
   - TTL：600
3. 域名解析到**境外(香港)服务器 IP 不需要备案**，可以立即生效。

## 第 3 步：初始化服务器

SSH 登录服务器后，把仓库里的初始化脚本传上去跑（一键装好 Node 20 + PM2 + Caddy）：

```bash
# 在本地电脑生成脚本内容，或直接在服务器上：
curl -fsSL -o server-setup.sh https://raw.githubusercontent.com/JimmyArwenHarry/jianghu/main/server-setup.sh
sudo bash server-setup.sh
```

装完会显示 `node -v` / `pm2 -v` / `caddy version` 三项版本号。

## 第 4 步：部署游戏（PM2 方案，推荐）

```bash
# 1. 拉取代码
git clone https://github.com/JimmyArwenHarry/jianghu.git
cd jianghu

# 2. 配置环境变量（填入真实 DeepSeek Key）
cp .env.example .env.local
vim .env.local        # 填入 DEEPSEEK_API_KEY=sk-xxxx  （DEEPSEEK_MODEL 可留默认）

# 3. 一键部署（自动 npm ci + build + PM2 启动）
bash deploy.sh
```

看到 `✅ 部署完成` 和 PM2 状态表里的 `jianghu` 为 **online** 即成功。

> 验证本机：`curl http://127.0.0.1:3000` 应返回 200。

## 第 5 步：绑定域名 + 自动 HTTPS（Caddy）

Caddy 会自动申请并续期 Let's Encrypt 免费证书，国内浏览器完全信任。

```bash
# 把仓库里的 Caddyfile 按你的域名改好，覆盖系统 Caddy 配置
cp Caddyfile /etc/caddy/Caddyfile
vim /etc/caddy/Caddyfile   # 把 your-domain.com 换成你的真实域名
systemctl reload caddy
```

等 1~3 分钟（首次要申请证书），然后手机开热点（走运营商网络）访问 `https://你的域名` 应能直接打开、地址栏带锁。

## 第 6 步：验证一局

打开首页 → 择一身世 → 测字 → 剧情选项 → 走完到战记/七律。DeepSeek 国内直连，速度通常比 Vercel 还快。

---

## 日常更新

```bash
cd jianghu && bash deploy.sh    # 自动 git pull + 重建 + 重启，一条命令
```

## 排错速查

| 现象 | 原因/解决 |
| --- | --- |
| 打不开、一直转圈 | 服务器防火墙/安全组没放行 80/443，去控制台放行 |
| 能打开但没 HTTPS/提示不安全 | 域名解析没生效（等 5 分钟再 `systemctl reload caddy`），或 Caddyfile 域名没换 |
| 剧情报错"缺少 API Key" | `.env.local` 里没填 `DEEPSEEK_API_KEY`，填完 `bash deploy.sh` 重启 |
| 剧情报错"余额不足/限流" | DeepSeek 控制台充值/稍后再试 |
| 看进程日志 | `pm2 logs jianghu` |
| 看 Caddy 日志 | `journalctl -u caddy -f` |

## 可选：Docker 方案

不想在宿主机装 Node/PM2，可用 Docker（初始化脚本已装好 Caddy，另需装 Docker）：

```bash
cp .env.example .env.local        # 填 Key
vim Caddyfile.docker              # 把 your-domain.com 换成你的域名
docker compose up -d --build
```

对外同样是 `https://你的域名`（Caddy 容器自动 HTTPS）。

## 成本清单

| 项目 | 参考价 |
| --- | --- |
| 香港轻量服务器 2C2G | ¥24~40/月 |
| 域名 .com | ¥60~70/年（首年常有 ¥10 级优惠） |
| DeepSeek API（文字游戏） | 极低，每月几元 |

> 注：如果你以后想上大陆服务器（延迟最低），只需多做一步 ICP 备案（个人约 1~2 周），部署方式完全不变。
