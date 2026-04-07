# School Insight System Backend

## 启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Windows：

```bash
.venv\Scripts\activate
```

接口文档：

- `http://127.0.0.1:8000/docs`

## 模块

- 认证与会话管理
- 摄像头管理与实时监控
- 视频上传与轨迹分析
- 日志检索与概览统计
- JSON 报告导出

## 路由清单

### 认证

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### 摄像头与监控

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

- 除登录、注册、忘记密码、重置密码外，其余接口默认要求 Bearer Token
- `GET /health` 当前也要求鉴权
- WebSocket 通过 query 中的 `token` 进行校验
