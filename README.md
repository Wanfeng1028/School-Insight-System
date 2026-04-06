# School Insight System

校园智能监控与轨迹分析控制台原型，包含认证、摄像头管理、实时监控、视频分析、日志审计、概览统计与报告导出。

## 技术栈

- 前端：React + Vite + ECharts
- 后端：FastAPI + WebSocket
- 自动化：Playwright

## 当前能力

- 账号体系：登录、注册、登出、忘记密码、验证码重置密码
- 监控中心：摄像头 CRUD、启停控制、MJPEG 预览、实时推理流
- 分析链路：单文件上传、批量上传绑定、轨迹分析、模拟兜底
- 运营视图：概览看板、日志筛选分页、JSON 报告导出

## 本地启动

### 1. 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Windows 可将激活命令替换为：

```bash
.venv\Scripts\activate
```

### 2. 启动前端

```bash
npm install
npm run dev
```

默认地址：

- 前端：`http://localhost:5173`
- 后端：`http://127.0.0.1:8000`
- 后端文档：`http://127.0.0.1:8000/docs`

## 自动化脚本

```bash
npm test
npm run automation:smoke
npm run automation:all
npm run automation:auth
npm run automation:logs
npm run automation:monitor
```

说明：

- `npm test` / `npm run automation:smoke`：运行认证页 + 监控页冒烟用例
- `npm run automation:all`：运行全部 Playwright 自动化
- Playwright 会自动拉起前后端本地服务

## API 概览

以下接口均以当前代码实现为准。

### 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### 监控与摄像头

- `GET /health`
- `GET /api/cameras`
- `POST /api/cameras`
- `DELETE /api/cameras/{camera_id}`
- `POST /api/cameras/{camera_id}/start`
- `POST /api/cameras/{camera_id}/stop`
- `GET /api/cameras/{camera_id}/mjpeg`
- `WS /ws/cameras/{camera_id}/inference`

### 分析与运营

- `GET /api/overview`
- `GET /api/logs`
- `GET /api/tracks`
- `POST /api/analysis/run`
- `POST /api/upload`
- `POST /api/upload-batch`
- `GET /api/report`
- `WS /ws/tracks`

## 鉴权说明

- 除登录、注册、忘记密码、重置密码外，绝大多数接口都需要 Bearer Token
- `/health` 当前也要求携带登录态
- `/ws/tracks` 与 `/ws/cameras/{camera_id}/inference` 需通过 query string 传递 `token`

## 上传限制

- 支持格式：`mp4`、`avi`、`mov`
- 单文件限制：`300MB`

## 演示账号

- 账号：`admin@school.local`
- 密码：`Admin12345`
