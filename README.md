# 江湖录：卑贱子的逆命

一款金庸文风的**文字武侠 RPG**，独立于《佛城风云》单独上线。

- 你以**农民 / 乞丐 / 小流氓 / 妓女 / 落魄书生 / 更夫**等卑贱之身踏入乱世；
- 在算命先生的卦摊前**测字断命**——亲手写下一个字，先生按笔画、五行、字义判你一桩宿命；
- 用 **10 回**抉择，在刀光剑影里挣出一条命、一段缘、一口气；
- 终局以**约 800 字金庸笔法战记 + 一首七律**作结，命运呼应你测得的那条命格。

## 技术栈

- Next.js 16（App Router + Turbopack）+ Tailwind CSS v4 + react-markdown
- DeepSeek API（`deepseek-v4-flash`）服务端代理生成剧情
- 主题：墨夜底、朱砂红、鎏金（`globals.css` 的 `@theme` tokens + `.md-body--wuxia`）

## 本地开发

```bash
npm install
# 复制 .env.example 为 .env.local 并填入真实 Key
cp .env.example .env.local   # 填入 DEEPSEEK_API_KEY
npm run dev
```

## 部署（Vercel）

```bash
npx vercel --prod --yes
```

Vercel 项目需配置两个环境变量（Settings → Environment Variables）：

| 名称 | 值 |
| --- | --- |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key（Sensitive） |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` |

## 国内免翻墙部署（免费 / 低价方案）

Vercel 的 `vercel.app` 域名在国内被墙。想让国内朋友不翻墙直接玩，
部署一台**大陆直连、免备案的境外服务器**即可（DeepSeek API 本身是国内服务，服务器直连毫无障碍）。

预算从低到高有 5 条路：

| 方案 | 价格 | 说明 |
| --- | --- | --- |
| 🖥️ 本地电脑 + cpolar 内网穿透 | **¥0** | 电脑常开，临时拉朋友玩（`bash tunnel.sh`） |
| 🆓 Oracle Cloud Always Free | **¥0/月** | ARM 2C/12G，永久免费，需外币信用卡 |
| 🥇 腾讯云/阿里云 香港轻量（新用户活动） | **约 ¥38~99/年** | 最省心，长期稳定 |
| 🏠 大陆轻量 + ICP 备案 | 约 ¥68~99/年 | 延迟最低 |
| 💰 海外年付 VPS | 约 ¥80/年 | 极限省钱 |

仓库已备好整套脚本（`server-setup.sh` / `deploy.sh` / `ecosystem.config.js` / `Caddyfile` / Docker 方案），
完整对比与图文步骤见 **[DEPLOY_CHINA.md](DEPLOY_CHINA.md)**：

1. 按预算选一台服务器（香港/海外，Ubuntu 22.04，防火墙放行 80/443）
2. 买域名 + A 记录解析到服务器 IP（免备案）
3. `sudo bash server-setup.sh`（一键装 Node 20 / PM2 / Caddy）
4. `git clone` 仓库 → `cp .env.example .env.local` 填 `DEEPSEEK_API_KEY`
5. `bash deploy.sh`（一键构建 + PM2 启动）
6. 改好 Caddyfile 绑定域名 → `systemctl reload caddy` → 自动 HTTPS 生效

## 代码结构

```
app/
  page.tsx                    游戏入口（直接渲染 JinYongGame）
  api/jinyong/
    divination/route.ts      测字断命（一个字 → 命格名 + 判词）
    chat/route.ts            10 回剧情（turn 1~9 剧情+3选项，turn 10 结局）
    summary/route.ts         约 800 字战记 + 一首七律
components/jinyong/
  StartScreen / FortuneScreen / Loading / EndingView / JinYongGame
lib/
  deepseek.ts                共用的 DeepSeek 封装（singleCall / callDeepSeek / extractJson）
  jinyong.ts                 身份/命格/战记数据与调用
  jinyong-prompt.ts          GM System Prompt（金庸笔法 + 身份/命格置顶指令）
```

## 稳定性要点（实测）

1. 不用 `response_format: {type:"json_object"}`——长上下文下会 ~17%~100% 概率输出空白；改用"结构化正文契约 + 容错解析"。
2. `deepseek-v4-flash` 必须传 `thinking:{type:"disabled"}`，消息必须以 USER 收尾。
3. 选择持久化：玩家的每次选择立即写入对话历史（`user/assistant` 严格交替），选项解析兼容 `* / 一、/ （一）/ ① / 选项一 / 加粗` 等格式；0 选项时服务端自动补选 + 客户端"续行"安全网，绝不卡死。
