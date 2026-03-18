# ComfyUI API 接入改动记录

这次改动的目标是：

- 让后端在创建任务后，真实调用 `ComfyUI API`
- 在任务提交成功后，自动轮询 ComfyUI 状态
- 将轮询结果持续回写到 MySQL 的 `tasks` 和 `task_logs` 表

也就是说，平台的任务链路已经从“只写数据库”升级成了“写数据库 + 提交 ComfyUI + 轮询状态 + 回写结果”的基础版本。

---

## 1. 本次改动涉及的文件

- `backend/src/modules/comfyui/comfyui.service.ts`
- `backend/src/modules/comfyui/workflow-templates.ts`
- `backend/src/modules/tasks/tasks.service.ts`
- `backend/src/modules/tasks/tasks.controller.ts`
- `backend/.env.example`
- `backend/package.json`

---

## 2. ComfyUI 服务层改动

### 2.1 从 mock 改为真实 HTTP 调用

更新文件：`backend/src/modules/comfyui/comfyui.service.ts`

之前这个服务只是返回一个 mock 结果，没有真正请求 ComfyUI。

现在已经实现了三个核心方法：

- `submitTask()`：调用 `POST /prompt`
- `getTaskResult()`：调用 `GET /history/:promptId`
- `getQueue()`：调用 `GET /queue`

这样后端已经能完成：

- 提交任务
- 查询历史结果
- 查询当前队列状态

### 2.2 增加工作流构造能力

新增文件：`backend/src/modules/comfyui/workflow-templates.ts`

目前内置了一个最基础的 `txt2img` 工作流构造方法：

- `buildTxt2ImgWorkflow()`

这个方法会把平台表单里的参数映射为 ComfyUI 的 prompt JSON。

当前支持的内置映射参数包括：

- `prompt`
- `negativePrompt`
- `width`
- `height`
- `steps`
- `cfg`
- `seed`
- `samplerName`
- `scheduler`

### 2.3 支持两种工作流来源

现在后端支持两种调用方式：

#### 方式一：使用后端内置工作流

当前仅内置支持：

- `taskType = image`
- `bizType = txt2img`

如果前端提交的是这类任务，后端会自动构造 ComfyUI prompt。

#### 方式二：前端或业务层直接传 `comfyPrompt`

如果 `inputParams` 中包含：

```json
{
  "comfyPrompt": { ... }
}
```

那么后端会直接把这个对象当作 ComfyUI prompt 提交。

这意味着：

- 后端可以继续保持轻量
- 对于视频、音频、复杂图像工作流，不需要先在平台里写一堆节点映射
- 只要业务层能拿到导出的 ComfyUI prompt，就可以直接调用

这也符合你之前的要求：

**工作流主要在 ComfyUI 中维护，而不是在平台里做复杂工作流编辑系统。**

---

## 3. 任务服务改动

### 3.1 创建任务后立即提交到 ComfyUI

更新文件：`backend/src/modules/tasks/tasks.service.ts`

现在任务创建流程变成：

1. 先写入平台任务表 `tasks`
2. 写一条 `submit` 类型的任务日志
3. 调用 `ComfyUI /prompt`
4. 成功后把 `prompt_id` 写回 `tasks.comfyTaskId`
5. 更新任务状态为 `queued`
6. 启动后台轮询

这样平台任务和 ComfyUI 任务已经正式关联起来。

### 3.2 增加任务日志写入

新增了统一日志写入逻辑，日志会写入 `task_logs`。

当前会记录这些阶段：

- 平台任务创建
- 提交 ComfyUI
- 轮询中
- 最终成功
- 最终失败
- 超时失败

这样以后排查问题时，不需要只看控制台日志，数据库里就能追踪整个任务过程。

### 3.3 增加轮询逻辑

现在后端在提交成功后，会自动异步执行轮询：

- 先查 `GET /history/:promptId`
- 如果 ComfyUI 还没产出结果，再查 `GET /queue`
- 根据队列状态更新平台任务状态和进度
- 如果历史记录中已经存在结果，则把任务标记为 `success` 或 `failed`

当前状态映射大致如下：

- 在队列中：`queued`
- 正在执行：`running`
- 有历史结果且成功：`success`
- 超时或异常：`failed`

### 3.4 增加结果摘要写回

轮询结束后，后端会从 ComfyUI 历史结果中提取一个简化摘要，写回到：

- `tasks.resultSummary`

当前会先提取：

- 图片输出数量
- 视频输出数量
- 原始 outputs 数据

这为后续把产物进一步写入 `assets` 表打下了基础。

### 3.5 增加手动轮询接口

更新文件：`backend/src/modules/tasks/tasks.controller.ts`

新增接口：

- `GET /api/tasks/:id`：查看任务详情和日志
- `POST /api/tasks/:id/poll`：手动触发一次轮询流程

这样即使自动轮询中断，也可以手动重新拉一次状态。

---

## 4. 环境变量改动

更新文件：`backend/.env.example`

新增配置：

- `COMFYUI_DEFAULT_CHECKPOINT`

用途：

- 给内置 `txt2img` 工作流指定默认模型名

例如：

```env
COMFYUI_DEFAULT_CHECKPOINT=v1-5-pruned-emaonly.safetensors
```

注意：

- 这个名字必须和你的 ComfyUI 实际可用模型名称一致
- 如果不一致，ComfyUI 提交虽然可能成功，但执行时会报找不到模型

---

## 5. 当前支持范围

### 已支持

- 平台创建图片 `txt2img` 任务
- 自动提交到 ComfyUI
- 自动轮询任务状态
- 成功或失败后回写数据库
- 查看任务详情与日志
- 手动触发轮询

### 当前限制

- 后端内置工作流目前只支持 `image/txt2img`
- 视频、音频以及其他图片业务类型，暂时需要通过 `inputParams.comfyPrompt` 直接传原始 ComfyUI prompt
- 还没有把 ComfyUI 输出结果自动写入 `assets` 表
- 还没有接入 WebSocket 实时推送

---

## 6. 如何使用

### 6.1 确保 ComfyUI 正在运行

例如：

- `http://127.0.0.1:8188`

并且它的 API 可以访问：

- `POST /prompt`
- `GET /history/:promptId`
- `GET /queue`

### 6.2 配置后端环境变量

在 `backend/.env` 中至少保证这些值正确：

```env
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_TIMEOUT_MS=300000
COMFYUI_POLL_INTERVAL_MS=3000
COMFYUI_DEFAULT_CHECKPOINT=v1-5-pruned-emaonly.safetensors
```

### 6.3 创建 txt2img 任务示例

发送到后端：

```json
{
  "taskType": "image",
  "bizType": "txt2img",
  "title": "测试文生图",
  "inputParams": {
    "prompt": "a cinematic portrait with soft lighting",
    "negativePrompt": "blur, low quality",
    "width": 1024,
    "height": 1024,
    "steps": 20,
    "cfg": 7
  }
}
```

后端就会：

- 写入任务表
- 调用 ComfyUI
- 获取 `prompt_id`
- 轮询直到结束

### 6.4 创建复杂工作流任务示例

如果你已经在 ComfyUI 中导出了可用 prompt，可以这样传：

```json
{
  "taskType": "video",
  "bizType": "img2video",
  "title": "测试视频任务",
  "inputParams": {
    "comfyPrompt": {
      "3": {
        "inputs": {},
        "class_type": "SomeNode"
      }
    }
  }
}
```

后端会直接使用这个 `comfyPrompt` 提交到 ComfyUI。

---

## 7. 建议你下一步做什么

从当前版本继续往前，我建议优先做下面两件事：

1. 把 ComfyUI 历史结果中的图片/视频/音频产物自动解析后写入 `assets` 表
2. 在前端任务页增加任务详情弹窗，展示 `task_logs` 和当前 ComfyUI 状态

如果你希望尽快做成团队内部可演示版本，我建议先做第 1 项。
