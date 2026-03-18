# ComfyUI temp 输出兼容修复记录

说明：这份改动后来已经回退。当前项目重新恢复为只从 `COMFYUI_OUTPUT_DIR` 读取结果文件。

这次修复的是“分镜图分割任务显示 100% 但最终失败”的问题。

你在 `task_logs` 里看到的关键错误是：

```json
{
  "message": "ENOENT: no such file or directory, open 'D:\\ComfyUI\\output\\ComfyUI_temp_gmcic_00001_.png'"
}
```

---

## 1. 根本原因

这次并不是工作流本身没有执行，而是：

- ComfyUI 已经返回了生成结果文件名
- 但平台后端在同步结果到 MinIO 时，默认只会去：
  - `COMFYUI_OUTPUT_DIR`
  查找文件

而 `fenjingtuSplitter` 这个工作流返回的文件属于：

- `type = temp`

也就是说，这类文件通常实际位于：

- `ComfyUI/temp`

而不是：

- `ComfyUI/output`

所以后端找错了目录，导致报出：

- `ENOENT`

---

## 2. 当时的修复方式

更新文件：`backend/src/modules/tasks/tasks.service.ts`

现在同步任务结果时，不再一律只读 `output` 目录，而是：

- 如果 `file.type = output`，读取 `COMFYUI_OUTPUT_DIR`
- 如果 `file.type = temp`，读取 `COMFYUI_TEMP_DIR`

也就是说，后端现在会根据 ComfyUI 历史结果里返回的 `type` 字段，动态选择正确的本地目录。

这是比“写死某个目录”更合理的方式，也更适合后续不同工作流混用。

---

## 3. 当时新增的环境变量

更新文件：`backend/.env.example`

这个环境变量后来已移除，不再需要配置。

---

## 4. 后续调整

后来基于实际使用决定：

- 不再兼容 `temp` 目录读取
- 统一要求相关工作流通过保存节点把结果落到 `output`

因此当前项目已经回退为：

- 只从 `COMFYUI_OUTPUT_DIR` 读取结果文件

这样平台逻辑更简单，也更符合你当前的使用方式。

## 5. 当前效果

修复后：

- 普通生成任务仍然从 `output` 读取结果
- 像分镜图分割这种返回 `temp` 文件的任务，也能被平台正确接管并同步到 MinIO

也就是说：

- splitter 功能现在不再因为“结果在 temp 而不在 output”而失败

---

## 6. 当前建议

请直接把 splitter 工作流改成保存到 `output`，然后重启后端再测试。
