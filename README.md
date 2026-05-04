# BrainTrainer

Working memory training app with N-Back, Complex Working Memory (CWM), streak tracking, and a Slack reminder bot. Vanilla frontend, Node.js + SQLite backend.

## Quick Start

```bash
npm install
npm start        # http://localhost:8090
```

For static-only dev (no server/DB):

```bash
cd public && python3 -m http.server 8090
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8090` | Server port |
| `DB_PATH` | `./data/brain-training.sqlite` | SQLite database path |
| `BT_API_TOKEN` | (none) | Bearer token for API auth. If unset, API is open. |
| `SLACK_WEBHOOK_URL` | (none) | Slack incoming webhook URL for daily reminders |
| `SLACK_REMINDER_HOUR` | `20` | Hour (0-23) to send the daily Slack reminder |

Copy `.env.example` to `.env` and fill in values.

## REST API

All endpoints under `/api`. If `BT_API_TOKEN` is set, pass `Authorization: Bearer <token>` header.

### Sessions

```
GET    /api/sessions                List sessions (?exercise=nback|cwm, ?limit=500, ?offset=0)
GET    /api/sessions/:id            Get single session
POST   /api/sessions                Create session
POST   /api/sessions/import         Bulk import { sessions: [...] }
DELETE /api/sessions?confirm=true   Delete all sessions
```

**Create session** — POST body (example for CWM):

```json
{
  "exercise": "cwm",
  "cwmType": "combined",
  "cwmLevel": 5,
  "decisionAccuracy": 0.85,
  "recallAccuracy": 0.8,
  "combined": 0.82,
  "correctRecalls": 4,
  "newLevel": 6
}
```

Server assigns `id` and `timestamp` if missing. Returns the record with `201`.

**Create session** — POST body (example for N-Back):

```json
{
  "exercise": "nback",
  "nbackLevel": 3,
  "modalities": ["position", "audio"],
  "trialCount": 20,
  "scores": {
    "position": { "dPrime": 2.5, "accuracy": 0.85 },
    "audio": { "dPrime": 1.8, "accuracy": 0.75 }
  },
  "overallAccuracy": 0.8,
  "avgDPrime": 2.15,
  "newLevel": 3
}
```

### Settings

```
GET  /api/settings              List all settings
GET  /api/settings/:key         Get setting by key
PUT  /api/settings/:key         Upsert setting (body is the value JSON)
```

Keys: `bt_nback_settings`, `bt_cwm_settings`, `bt_dark_mode`, `bt_last_view`

### Streaks

```
GET  /api/streaks
```

Response:

```json
{
  "currentStreak": 5,
  "longestStreak": 12,
  "trainedToday": true,
  "lastTrainingDate": "2026-05-04"
}
```

### Slack

```
POST /api/slack/remind    Trigger a reminder check (sends if not trained today)
GET  /api/slack/status    { configured: bool, reminderHour: number }
```

The server runs a daily cron at `SLACK_REMINDER_HOUR`. If no training session exists for today, it POSTs a message to the Slack webhook.

## Docker

```bash
docker build -t brain-training .
docker run -p 8090:8090 -v bt-data:/app/data brain-training
```

## Deploy

**Railway**: connect the GitHub repo, set env vars, add a persistent volume mounted at `/app/data`.

**Render**: create a Web Service from the repo, set env vars, add a disk mounted at `/app/data`.

**Fly.io**:

```bash
fly launch
fly volumes create bt_data --size 1
# add [mounts] in fly.toml: source = "bt_data", destination = "/app/data"
fly deploy
```
