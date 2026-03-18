# MinIO 本机启动与上传验证说明

这次补了两件事：

1. 给你一套本机最简 MinIO 启动方式
2. 给后端增加一个存储健康检查接口，方便你先验证上传链路是否具备运行条件

---

## 1. 本机最简启动 MinIO

新增文件：

- `docker-compose.minio.yml`
- `start_minio.bat`

### 启动方式

如果你本机已经安装好 Docker Desktop，直接在项目根目录运行：

```bash
start_minio.bat
```

或者手动执行：

```bash
docker compose -f docker-compose.minio.yml up -d
```

### 启动后访问地址

- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

默认账号密码：

- 用户名：`minioadmin`
- 密码：`minioadmin`

---

## 2. 后端新增存储健康检查接口

更新文件：

- `backend/src/modules/storage/storage.service.ts`
- `backend/src/modules/assets/assets.controller.ts`

新增接口：

- `GET /api/assets/health/storage`

作用：

- 主动检查后端能否连接 MinIO
- 主动检查 Bucket 是否可用

这个接口是为了让你在上传图片前，先确认整个上传链路的前提条件已经满足。

---

## 3. 正确的验证顺序

建议你按下面顺序验证。

### 第一步：启动 MinIO

执行：

```bash
start_minio.bat
```

### 第二步：启动后端

执行：

```bash
cd backend
npm run start:dev
```

### 第三步：检查后端健康

打开：

- `http://localhost:3001/api/health`

如果能返回 JSON，说明后端服务正常。

### 第四步：检查 MinIO 链路

打开：

- `http://localhost:3001/api/assets/health/storage`

如果返回类似：

```json
{
  "ok": true,
  "bucket": "aigc-assets",
  "endpoint": "127.0.0.1",
  "port": 9000
}
```

说明：

- 后端已经能连上 MinIO
- Bucket 已可用
- 上传接口具备运行条件

### 第五步：测试上传图片

再回到前端“分镜图”功能页，点击上传图片。

---

## 4. 如果仍然上传失败，优先检查什么

### 检查 1：MinIO 是否真的在运行

打开：

- `http://localhost:9001`

如果控制台打不开，说明 MinIO 没起来。

### 检查 2：后端环境变量是否匹配

确认 `backend/.env` 里：

```env
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=aigc-assets
```

### 检查 3：后端是否正常运行在 3001

打开：

- `http://localhost:3001/api/health`

---

## 5. 当前结果

现在你已经有：

- 一套最简本机 MinIO 启动方式
- 一个可直接用于自检上传链路的后端接口

这样你可以先确认环境是否正常，再测上传，不需要再靠猜。
