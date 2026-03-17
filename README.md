# School Insight System

\u8f68\u8ff9\u5206\u6790\u63a7\u5236\u53f0 / XX\u6821\u56ed\u667a\u80fd\u76d1\u63a7\u7cfb\u7edf\u524d\u540e\u7aef\u4e00\u4f53\u539f\u578b\u3002

## \u6280\u672f\u6808

- Frontend: React + Vite + ECharts + Canvas
- Backend: FastAPI + WebSocket

## \u524d\u7aef\u542f\u52a8

```bash
cd E:\code\xxw\School-Insight-System
npm install
npm run dev
```

## \u540e\u7aef\u542f\u52a8

```bash
cd E:\code\xxw\School-Insight-System\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## \u4e3b\u8981\u80fd\u529b

- \u89c6\u9891\u4e0a\u4f20\u4e0e\u7ed1\u5b9a
- WebSocket \u5b9e\u65f6\u8f68\u8ff9\u76d1\u63a7
- \u7edf\u8ba1\u6982\u89c8\u770b\u677f
- \u4e8b\u4ef6\u65e5\u5fd7\u67e5\u770b\u4e0e\u7b5b\u9009
- JSON \u62a5\u544a\u5bfc\u51fa

## API

- `GET /health`
- `GET /api/overview`
- `GET /api/logs`
- `GET /api/tracks`
- `POST /api/upload`
- `GET /api/report`
- `WS /ws/tracks`

## \u8bf4\u660e

- \u524d\u7aef\u4f18\u5148\u8bf7\u6c42 FastAPI \u63a5\u53e3\uff0c\u63a5\u53e3\u4e0d\u53ef\u7528\u65f6\u4f1a\u56de\u9000\u5230\u672c\u5730\u6a21\u62df\u6570\u636e\u3002
- \u4e0a\u4f20\u652f\u6301 `mp4` / `avi` / `mov`\uff0c\u5355\u6587\u4ef6\u9650\u5236 `300MB`\u3002
