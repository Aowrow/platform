# ComfyUI Internal AIGC Platform

这是一个基于 `ComfyUI` 远端推理的内部 AIGC 平台基础框架，采用前后端分离结构，并以“场景化功能页”作为前端核心交互方式：

- `frontend`：`Next.js` 前端工作台
- `backend`：`NestJS` 后端服务

## 目录结构

```text
.
|- frontend
|- backend
|- init_comfyui_aigc_platform.sql
|- comfyui_aigc_platform_tech_route.md
|- comfyui_aigc_platform_mysql_design.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
mysql -u root -p < init_comfyui_aigc_platform.sql
```

### 3. 配置环境变量

- 复制 `frontend/.env.example` 为 `frontend/.env.local`
- 复制 `backend/.env.example` 为 `backend/.env`

### 4. 启动前后端

```bash
npm run dev:frontend
npm run dev:backend
```

## 当前已包含的基础能力

- 前端能力首页和功能详情页骨架
- 已实现首个测试功能页：`分镜图`
- 后端支持 `featureCode -> workflow JSON -> 参数映射 -> ComfyUI 提交`
- 后端支持任务创建、状态轮询、结果摘要回写
- `Prisma` 数据模型和种子脚本

## Prisma 初始化方式

进入 `backend` 目录后执行：

```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

说明：

- `prisma:generate` 用于生成 Prisma Client
- `prisma:push` 用于把 `schema.prisma` 同步到数据库
- `prisma:seed` 用于初始化角色、管理员用户和系统配置

## 建议下一步

- 接入真实登录
- 对接 MinIO，并把 ComfyUI 输出结果写入 `assets`
- 增加更多功能页，例如视频生成、口播视频、配音
- 前端补充任务详情与日志展示
