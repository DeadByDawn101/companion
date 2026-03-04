# Camila v1.0.0 Release Notes

## Tagged Releases
- `v1.0.0-consumer`
- `v1.0.0-openclaw`

## Highlights
- Dual product variants from one codebase:
  - Consumer (`VITE_APP_VARIANT=consumer`)
  - OpenClaw (`VITE_APP_VARIANT=openclaw`)
- Camila-first identity and goth styling
- Multi-model session switching with presets
- Sister advisory lens per session (Camila core remains primary)
- Tools/skills visibility in Task Panel
- Favorites, in-chat search, markdown/worklog exports
- Draft autosave + daily-driver composer upgrades

## Deploy Targets
### camila-chat (consumer)
- Env:
  - `VITE_APP_VARIANT=consumer`
  - `VITE_BRAND_NAME=Camila Chat`
  - `VITE_BRAND_TAGLINE=Goth-native AI chat for everyday execution.`

### camila-openclaw (openclaw)
- Env:
  - `VITE_APP_VARIANT=openclaw`
  - `VITE_BRAND_NAME=Camila OpenClaw`
  - `VITE_BRAND_TAGLINE=Claude-grade flow, OpenClaw-native execution.`
  - `OPENCLAW_MODE=on`
  - `OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789`
  - `OPENCLAW_RELAY_URL=<your relay url>`

## Notes
- Both products can ship from the same repo with env-driven branding/behavior.
