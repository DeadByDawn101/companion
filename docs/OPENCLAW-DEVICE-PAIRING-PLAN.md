# OpenClaw Device Pairing Plan (Companion)

Goal: make first-run feel like approving a new trusted device.

## Phase 1 (now)
- Auto-connect to local gateway via `OPENCLAW_GATEWAY_URL`
- Show health + sessions in bridge card
- If unavailable, show guided actions:
  1) `openclaw gateway start`
  2) `openclaw devices list`
  3) `openclaw pairing approve` if needed

## Phase 2 (next)
- Add first-run wizard in Companion:
  - Detect gateway
  - Detect paired device state
  - Offer one-click "Approve this Mac as trusted device"

## Phase 3 (later)
- Optional OAuth sign-in (Google/Apple)
- Optional cloud relay account link

Security intent: local-trust-first, explicit device approval, then optional social login.
