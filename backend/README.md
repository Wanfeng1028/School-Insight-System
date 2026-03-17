# School Insight System Backend

## Start

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `GET /api/overview`
- `GET /api/logs`
- `GET /api/tracks`
- `WS /ws/tracks`
