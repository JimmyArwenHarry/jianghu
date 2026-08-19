// PM2 进程配置：《江湖录》Next.js 生产服务
// 启动：pm2 startOrReload ecosystem.config.js --env production
// 说明：.env.local 由 Next.js 在 next start 时自动加载（含 DEEPSEEK_API_KEY），无需 PM2 额外注入。
module.exports = {
  apps: [
    {
      name: "jianghu",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
