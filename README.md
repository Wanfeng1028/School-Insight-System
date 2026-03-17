# School Insight System

轨迹分析控制台 / XX校园智能监控系统前后端一体原型。

## 技术栈

- Frontend: React + Vite + ECharts + Canvas
- Backend: FastAPI + WebSocket

## 前端启动

```bash
cd E:\code\xxw\School-Insight-System
npm install
npm run dev
```

## 后端启动

```bash
cd E:\code\xxw\School-Insight-System\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 主要能力

- 视频上传与绑定
- WebSocket 实时轨迹监控
- 统计概览看板
- 事件日志查看与筛选
- JSON 报告导出

## API

- `GET /health`
- `GET /api/overview`
- `GET /api/logs`
- `GET /api/tracks`
- `POST /api/upload`
- `GET /api/report`
- `WS /ws/tracks`

## 说明

- 前端优先请求 FastAPI 接口，接口不可用时会回退到本地模拟数据。
- 上传支持 `mp4` / `avi` / `mov`，单文件限制 `300MB`。
