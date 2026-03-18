# ComfyUI 内部 AIGC 平台 MySQL 精简表结构设计

## 1. 设计目标

这份表结构设计基于以下前提：

- 平台面向 **10 人左右内部团队** 使用
- 平台是 **内部工具**，不包含收费、订单、积分体系
- `ComfyUI` 作为 **远端推理服务**，平台通过 API 调用
- 工作流编辑、导出、维护放在 `ComfyUI` 内完成，平台不做工作流管理后台

因此数据库设计遵循几个原则：

- 只保留真正需要的业务表
- 避免过度拆分
- 优先保证任务流转清晰
- 资源文件统一放对象存储，MySQL 只存索引和元数据

---

## 2. 推荐保留的核心表

建议第一版只保留以下 7 张核心表：

- `users`：用户表
- `roles`：角色表
- `user_roles`：用户角色关联表
- `tasks`：任务主表
- `task_logs`：任务状态和执行日志表
- `assets`：素材与结果资源表
- `system_configs`：系统配置表

如果后续有更强的审计需求，再增加：

- `audit_logs`：审计日志表

---

## 3. 表关系概览

```text
users ---< user_roles >--- roles
  |
  +---< tasks ---< task_logs
  |
  +---< assets

tasks ---< assets
```

可理解为：

- 一个用户可以创建多个任务
- 一个任务可以有多条日志
- 一个任务可以关联多个文件资源
- 一个用户可以拥有多个角色

---

## 4. 表结构设计

## 4.1 `users` 用户表

用途：

- 存平台登录用户
- 支撑任务归属、资源归属、操作追踪

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `username` | varchar(64) | 登录名，唯一 |
| `password_hash` | varchar(255) | 密码哈希 |
| `nickname` | varchar(64) | 用户昵称 |
| `email` | varchar(128) null | 邮箱 |
| `mobile` | varchar(32) null | 手机号 |
| `status` | tinyint | 状态，1 启用，0 禁用 |
| `last_login_at` | datetime null | 最近登录时间 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

索引建议：

- 唯一索引：`username`
- 普通索引：`status`

说明：

- 如果你们后续接入公司统一认证，可以保留这张表，只把认证方式改掉
- `password_hash` 建议使用 `bcrypt` 或 `argon2`

---

## 4.2 `roles` 角色表

用途：

- 做简单角色区分
- 满足普通用户和管理员权限隔离

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `code` | varchar(64) | 角色编码，唯一 |
| `name` | varchar(64) | 角色名称 |
| `description` | varchar(255) null | 描述 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

建议初始化角色：

- `admin`
- `user`

索引建议：

- 唯一索引：`code`

---

## 4.3 `user_roles` 用户角色关联表

用途：

- 支撑一个用户多个角色的情况
- 保持权限设计可扩展

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `user_id` | bigint | 用户 ID |
| `role_id` | bigint | 角色 ID |
| `created_at` | datetime | 创建时间 |

索引建议：

- 唯一索引：`(user_id, role_id)`
- 普通索引：`role_id`

---

## 4.4 `tasks` 任务主表

用途：

- 记录平台所有生成任务
- 统一管理图片、视频、音频任务

这是整个平台最核心的一张表。

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 平台任务 ID |
| `task_no` | varchar(64) | 任务编号，唯一 |
| `user_id` | bigint | 创建人 |
| `task_type` | varchar(32) | 任务类型：image/video/audio |
| `biz_type` | varchar(64) | 业务类型：txt2img、img2img、img2video、tts 等 |
| `title` | varchar(128) null | 任务标题 |
| `status` | varchar(32) | 平台状态 |
| `progress` | int default 0 | 进度，0-100 |
| `input_params` | json | 前端提交的结构化参数 |
| `comfy_server` | varchar(255) null | 实际调用的 ComfyUI 服务地址 |
| `comfy_workflow_name` | varchar(128) null | 使用的工作流标识 |
| `comfy_task_id` | varchar(128) null | ComfyUI 返回的任务 ID |
| `result_summary` | json null | 结果摘要，如输出文件数量、预览信息 |
| `error_message` | text null | 错误信息 |
| `started_at` | datetime null | 开始时间 |
| `finished_at` | datetime null | 完成时间 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

状态建议统一使用平台自己的枚举：

- `pending`
- `queued`
- `running`
- `success`
- `failed`
- `cancelled`

索引建议：

- 唯一索引：`task_no`
- 普通索引：`user_id`
- 普通索引：`status`
- 普通索引：`task_type`
- 普通索引：`biz_type`
- 普通索引：`created_at`
- 联合索引：`(user_id, created_at)`

说明：

- `input_params` 建议保存平台自己的结构化参数，不直接保存原始 ComfyUI 工作流 JSON
- `result_summary` 只保存摘要信息，详细文件信息放到 `assets`
- `task_no` 可以用时间戳 + 随机串，便于业务排查

---

## 4.5 `task_logs` 任务日志表

用途：

- 记录任务状态变化
- 记录调用 ComfyUI 的关键过程
- 便于定位失败原因

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `task_id` | bigint | 平台任务 ID |
| `log_type` | varchar(32) | 日志类型 |
| `status` | varchar(32) null | 当时任务状态 |
| `message` | varchar(500) | 日志摘要 |
| `detail` | json null | 详细信息 |
| `created_at` | datetime | 创建时间 |

`log_type` 建议值：

- `system`
- `submit`
- `polling`
- `callback`
- `result`
- `error`

索引建议：

- 普通索引：`task_id`
- 普通索引：`log_type`
- 普通索引：`created_at`
- 联合索引：`(task_id, created_at)`

说明：

- 不建议把所有第三方原始响应完整塞到主表里
- 建议在 `detail` 中保留关键请求摘要和返回摘要，避免日志失控

---

## 4.6 `assets` 资源表

用途：

- 保存上传素材和生成结果的索引信息
- 统一管理图片、视频、音频文件

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `user_id` | bigint | 所属用户 |
| `task_id` | bigint null | 关联任务 ID |
| `asset_type` | varchar(32) | input/output/preview/thumbnail |
| `media_type` | varchar(32) | image/video/audio |
| `storage_provider` | varchar(32) | minio/s3/oss/cos |
| `bucket_name` | varchar(128) null | 存储桶名 |
| `object_key` | varchar(500) | 对象存储路径 |
| `file_name` | varchar(255) | 文件名 |
| `mime_type` | varchar(128) null | MIME 类型 |
| `file_size` | bigint null | 文件大小，字节 |
| `width` | int null | 图片或视频宽度 |
| `height` | int null | 图片或视频高度 |
| `duration` | decimal(10,2) null | 音视频时长，秒 |
| `sort_order` | int default 0 | 同任务下排序 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

索引建议：

- 普通索引：`user_id`
- 普通索引：`task_id`
- 普通索引：`asset_type`
- 普通索引：`media_type`
- 联合索引：`(task_id, asset_type)`

说明：

- 文件访问 URL 不建议永久直接存死，可以通过后端动态拼接签名地址
- 如果是内部环境且访问方式固定，也可以增加 `url` 字段做缓存展示

---

## 4.7 `system_configs` 系统配置表

用途：

- 保存平台运行级配置
- 避免把所有配置都硬编码在代码里

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `config_key` | varchar(128) | 配置键，唯一 |
| `config_value` | text | 配置值 |
| `value_type` | varchar(32) | string/number/boolean/json |
| `description` | varchar(255) null | 说明 |
| `created_at` | datetime | 创建时间 |
| `updated_at` | datetime | 更新时间 |

建议配置项：

- `comfyui.base_url`
- `comfyui.timeout_ms`
- `comfyui.poll_interval_ms`
- `storage.default_bucket`
- `task.default_retry_count`

索引建议：

- 唯一索引：`config_key`

说明：

- 第一版如果你更想简单一些，也可以先不用这张表，直接写在环境变量中
- 但如果需要后台可配置能力，这张表会很实用

---

## 4.8 `audit_logs` 审计日志表（可选）

如果你们后续对操作追溯有要求，再加这张表。

用途：

- 记录谁做了什么操作
- 用于后台审计和问题追查

建议字段：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主键 |
| `user_id` | bigint null | 操作人 |
| `action` | varchar(64) | 操作类型 |
| `target_type` | varchar(64) | 操作对象类型 |
| `target_id` | varchar(64) null | 操作对象 ID |
| `request_path` | varchar(255) null | 请求路径 |
| `request_method` | varchar(16) null | 请求方法 |
| `ip` | varchar(64) null | IP |
| `detail` | json null | 详细内容 |
| `created_at` | datetime | 创建时间 |

---

## 5. 建表顺序建议

建议按这个顺序落地：

1. `users`
2. `roles`
3. `user_roles`
4. `tasks`
5. `task_logs`
6. `assets`
7. `system_configs`

原因：

- 先把用户和权限基础搭好
- 再把任务主链路搭起来
- 最后补配置类表

---

## 6. 推荐的字段类型与规范

### 6.1 主键建议

建议统一使用：

- `bigint` 自增主键

原因：

- 简单直接
- Prisma、NestJS、MySQL 配合方便
- 对内部平台足够稳定

如果你们特别在意分布式 ID，也可以后续改成雪花 ID，但第一版没必要。

### 6.2 时间字段建议

建议所有核心表统一保留：

- `created_at`
- `updated_at`

任务表额外保留：

- `started_at`
- `finished_at`

### 6.3 枚举值建议

对于 `task_type`、`status`、`asset_type` 这类字段，建议：

- 数据库中使用 `varchar`
- 枚举值在后端代码中统一维护

这样比 MySQL 原生 `enum` 更灵活，后续扩展更方便。

### 6.4 JSON 字段建议

建议以下字段使用 `json`：

- `tasks.input_params`
- `tasks.result_summary`
- `task_logs.detail`
- `audit_logs.detail`

这样能避免过早把字段拆得过细。

但要注意：

- 高频筛选字段不要只放在 JSON 中
- 会参与查询的关键字段仍然要单独列出来

---

## 7. 第一版最小可用数据库方案

如果你想更快启动，第一版甚至可以只建下面 5 张表：

- `users`
- `roles`
- `user_roles`
- `tasks`
- `assets`

其中：

- 日志先简单写应用日志文件
- 系统配置先放环境变量

等平台跑顺之后，再补：

- `task_logs`
- `system_configs`

这是更符合内部小平台节奏的做法。

---

## 8. 最终建议

结合你的场景，我建议数据库第一版不要超过 7 张核心表。

最推荐的主链路是：

- `users / roles / user_roles` 负责登录和权限
- `tasks` 负责任务主流程
- `task_logs` 负责排错与状态追踪
- `assets` 负责文件索引
- `system_configs` 负责运行参数配置

这套设计已经足够支撑一个内部使用的 ComfyUI AIGC 平台，并且后续扩展到图片、视频、音频都不会太吃力。
