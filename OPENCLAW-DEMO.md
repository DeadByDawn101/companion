# OpenClaw Demo Mode (Companion)

This fork includes an OpenClaw bridge surface for demoing health/config/session visibility.

## Env

Create `.env` in `web/`:

```bash
OPENCLAW_MODE=on
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_RELAY_URL=https://ravenxllc.beardie-ph.ts.net
```

## Run

```bash
cd web
bun install
bun run dev
```

Open `http://localhost:5174` and verify:
- OpenClaw Bridge card = Connected
- Session count updates (poll every 15s)
- Overview link opens `/overview` on relay URL

## API endpoints
- `GET /api/openclaw/health`
- `GET /api/openclaw/config`
- `GET /api/openclaw/sessions`

## Notes
This is a bridge scaffold for demo. Next phase is full event stream adapter for OpenClaw conversation rendering.
