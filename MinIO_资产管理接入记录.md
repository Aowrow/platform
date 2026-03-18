# MinIO 资产管理接入记录

这次改动的目标是：

- 支持云数据库 + 单机部署前后端和 ComfyUI 的方案
- 同机引入 `MinIO` 作为统一对象存储
- 让平台能够管理并展示：
  - 上传图片
  - 任务生成图片

---

## 1. 需求文档

新增文档：`云数据库_单机部署_MinIO_需求说明.md`

这份文档整理了本阶段的目标、能力范围、技术路线和后续演进方向，明确了：

- 数据库放云端
- 前后端、ComfyUI、MinIO 放同一台云主机
- 资源统一由平台管理，而不是长期直接依赖 ComfyUI output 目录

---

## 2. 后端接入 MinIO

### 2.1 新增依赖

更新文件：`backend/package.json`

新增依赖：

- `minio`
- `mime-types`
- `multer`

以及对应类型包。

### 2.2 新增存储模块

新增文件：

- `backend/src/modules/storage/storage.module.ts`
- `backend/src/modules/storage/storage.service.ts`

当前实现能力：

- 连接 MinIO
- 启动时自动检查 Bucket 是否存在
- 支持将 Buffer 上传到 MinIO
- 支持从 MinIO 读取对象内容

### 2.3 环境变量补充

更新文件：`backend/.env.example`

新增配置：

- `MINIO_USE_SSL`
- `COMFYUI_OUTPUT_DIR`

作用：

- 兼容后续云上 HTTPS MinIO 场景
- 明确本机 ComfyUI output 目录位置，便于任务完成后接管生成结果

---

## 3. 资源接口增强

### 3.1 重构资产服务

更新文件：`backend/src/modules/assets/assets.service.ts`

新增能力：

- 查询资产时返回可访问 URL
- 支持按资产 ID 读取 MinIO 中的文件内容
- 支持创建资产记录

### 3.2 重构资产控制器

更新文件：`backend/src/modules/assets/assets.controller.ts`

新增接口：

- `GET /api/assets`
- `GET /api/assets/:id/content`
- `POST /api/assets/upload`

作用：

- 前端可以读取资产列表
- 前端图片 `<img>` 可以直接用平台自己的内容接口访问资源
- 前端可以上传图片到 MinIO，并写入 `assets` 表

---

## 4. 任务完成后自动接管 ComfyUI 结果

更新文件：`backend/src/modules/tasks/tasks.service.ts`

这次新增了 `syncGeneratedAssets()` 逻辑：

- 当 ComfyUI 任务执行成功后
- 后端会读取历史结果中的输出文件信息
- 根据 `COMFYUI_OUTPUT_DIR` 找到本机输出文件
- 将文件上传到 MinIO
- 在 `assets` 表中创建 `output` 类型资源记录

这意味着现在平台的生成图片开始进入统一资产管理，而不是只停留在 ComfyUI 本地 output 中。

### 这一步的意义

- 上传图片和生成图片都能统一收口到平台管理
- 为以后前端展示结果、历史筛选、下载、迁移到云存储打基础

---

## 5. 前端新增资产管理页

### 5.1 新增导航入口

更新文件：`frontend/components/app-shell.tsx`

新增：

- `资产管理`

### 5.2 新增资产管理页面

新增文件：`frontend/app/assets/page.tsx`

当前能力：

- 拉取 `/api/assets`
- 展示上传图片和生成图片
- 展示资源类型、媒体类型、存储方式、任务编号、功能来源
- 直接预览图片

### 5.3 功能页支持上传图片

更新文件：`frontend/components/feature-form.tsx`

当前在功能页中新增了上传参考图片能力：

- 上传图片到 `POST /api/assets/upload`
- 上传成功后进入 MinIO
- 同时写入 `assets` 表
- 页面上会显示刚上传的参考图片缩略图

这样“分镜图”页就已经具备：

- 上传参考图
- 提交任务
- 任务生成图进入资产管理

---

## 6. 自我 Review 结果

这次完成后，我做了自检和构建验证：

- `backend` 已成功 build
- `frontend` 已成功 build

### 检查通过的点

- MinIO 模块已接入
- 资产上传链路已建立
- 任务生成结果同步到 MinIO 的逻辑已落地
- 前端资产管理页已可展示图片
- 旧方向代码没有和本次改动冲突

### 当前已知限制

- 上传接口当前默认仍将上传用户记为 `userId = 1`，后续应替换为真实登录用户
- 生成结果同步当前基于本机 `COMFYUI_OUTPUT_DIR` 读取文件，适合单机部署方案
- 目前主要围绕图片资源做了完整链路，视频和音频还没进一步扩展

---

## 7. 当前阶段成果

到这一步，项目已经具备：

- 云数据库 + 单机前后端 + 单机 ComfyUI + 同机 MinIO 的基本资源管理能力
- 上传图可在平台中查看
- 生成图可在平台中查看
- 后续切到云端 OSS/COS/S3 时，迁移成本会明显降低

---

## 8. 建议下一步

我建议接下来优先做：

1. 在“分镜图”功能页直接展示该任务对应的生成结果
2. 给资产页增加筛选，例如只看上传图 / 只看生成图
3. 将 `StorageService` 进一步抽象，方便后续切换到云对象存储
