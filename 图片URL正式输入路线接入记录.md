# 图片 URL 正式输入路线接入记录

这次改动的目标是正式落地推荐方案：

- 平台上传图片后进入 MinIO
- 平台为图片提供稳定访问 URL
- 提交任务时把图片 URL 注入 ComfyUI 工作流
- ComfyUI 通过你自定义的 `Load Image URL Batch` 节点读取这些图片

这比“把图片同步写到 ComfyUI input 目录”更适合后续云上部署和多功能扩展。

---

## 1. 新工作流接入

这次已切换到新的工作流文件：

- `backend/workflows/fenjingtu3.json`

这个工作流中新增了你自定义的节点：

- `LoadImageURLBatch`

对应节点是：

- 节点 `58`
- 输入字段：`inputs.urls`

这个字段支持用 `;` 拼接多个图片 URL。

---

## 2. 后端工作流映射更新

更新文件：`backend/src/modules/features/feature-registry.ts`

主要改动：

- `fenjingtu` 绑定的工作流改成 `fenjingtu3.json`
- 功能字段新增：`referenceImages`
- 提交任务时支持从 `inputParams.referenceImageUrls` 中取图片 URL 列表
- 把图片 URL 用 `;` 连接后写入：
  - `58.inputs.urls`

同时保留了原来的文本类映射：

- `40.inputs.string_b`
- `46.inputs.aspect_ratio`
- `45.inputs.filename_prefix`
- `47.inputs.string_a`

也就是说，现在“分镜图”任务提交时，工作流里已经能同时接收：

- 文本输入
- 图片 URL 输入

---

## 3. 前端上传图片与任务输入绑定

更新文件：

- `frontend/lib/feature-catalog.ts`
- `frontend/components/feature-form.tsx`

### 3.1 新增字段类型

新增字段类型：

- `assetImage`

这个字段表示：

- 它不是普通文本输入
- 而是“可选的图片资产输入”

### 3.2 分镜图页面现在怎么用参考图

在“分镜图”页里：

- 上传图片后，图片会进入 MinIO 和 `assets`
- 页面会显示所有已上传参考图
- 你可以点击选择一张或多张图片作为当前任务的输入

### 3.3 提交任务时真正传了什么

提交时，前端会把这些值一起带上：

- `referenceImageIds`
- `referenceImageUrls`

其中：

- `referenceImageUrls` 就是平台自己的资源访问地址
- 例如：`http://localhost:3001/api/assets/:id/content`

后端收到后，会把这些 URL 注入工作流中的 `LoadImageURLBatch` 节点。

---

## 4. 技术路线为什么这样设计

这条路线的核心思路是：

- 平台负责文件管理
- ComfyUI 负责推理
- 两者通过“可访问的资源 URL”连接起来

优点：

- 不依赖 ComfyUI input 本地目录
- 更适合未来云上部署
- 上传图和生成图都统一由平台管理
- 如果将来从 MinIO 换到 OSS/COS/S3，前端和工作流思路基本不变

这就是推荐正式路线的原因。

---

## 5. 当前已经实现的效果

现在“分镜图”功能页已经支持：

1. 上传图片到平台
2. 选择一张或多张图片作为当前任务的参考图
3. 提交任务时把这些图片的 URL 传给后端
4. 后端把 URL 注入 `fenjingtu3.json` 的 `LoadImageURLBatch` 节点
5. ComfyUI 工作流据此读取图片并继续执行

这意味着图片输入已经不再只是“资产管理里能看见”，而是已经进入了实际工作流执行链路。

---

## 6. 如何验证是否真的生效

你可以这样验证：

1. 在“分镜图”页上传两张不同风格的参考图
2. 选择其中一张或多张加入当前任务
3. 提交任务
4. 在任务调试信息里查看 `submittedPrompt`
5. 检查节点：
   - `58.inputs.urls`

如果你能看到 URL 被正确写入，并且多个 URL 用 `;` 连接，说明这条正式路线已经接通。

---

## 7. 构建验证

本次改动后已完成：

- `frontend` build 通过
- `backend` build 通过

说明本次接入在当前项目结构中没有明显编译问题。
