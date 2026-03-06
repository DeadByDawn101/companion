# RavenX Companion — Simple Login & Onboarding Spec

Date: 2026-03-05
Product line: **Your Agents. Your Team. On the Go.**

## Goal
Deliver a retail-simple onboarding flow that feels like opening your personal AI org, not a generic chat app.

## Core Principle
OpenClaw-native trust first. Account login second.

---

## v1 Login (Simple + Shippable)

### Step 1 — Connect Device (Primary)
- App starts in **Connect OpenClaw** mode
- Detect local/relay gateway
- If not paired: show one clear action: **"Approve this device"**
- Complete by device pairing approval (OpenClaw-native)

### Step 2 — Main Agent Greeting
- After pairing, land on **Main Agent Welcome** screen
- Agent greets user by name/context
- CTA: **"Open Command Center"**

### Step 3 — Team Dashboard
- Agent roster cards
- Active tasks and approvals queue
- Quick action composer

No Claude CLI login prompt in OpenClaw mode.

---

## v1.5 Optional Account Layer (Later)

Add optional cloud account login for sync + recovery:
- Sign in with Apple
- Sign in with Google

This is additive, not blocking local use.

---

## UX Screens (must-have)
1. **Connect Screen**
   - Gateway status
   - Pairing status
   - "Approve this device" button
2. **Welcome Screen**
   - Main agent portrait + greeting
   - Last mission summary
3. **Command Center**
   - Team cards
   - Task board
   - Approvals inbox

---

## Technical Requirements

### Backend
- OpenClaw bridge endpoints:
  - `/api/openclaw/health`
  - `/api/openclaw/sessions`
  - `/api/openclaw/config`
- Add pairing status endpoint:
  - `/api/openclaw/pairing-status`
- Add approval endpoint hook:
  - `/api/openclaw/pair-device`

### Frontend
- If `OPENCLAW_MODE=on`:
  - suppress Claude CLI auth prompts
  - show OpenClaw pairing/login wizard
- Persist onboarding completion in local state

### Security
- Device approval required before session controls
- All approval actions auditable
- No embedded secrets in app bundle

---

## Success Metrics
- Time-to-first-agent-greeting < 90 seconds
- Pairing completion rate > 85%
- Session-start success > 95% after pairing
- Drop-off in first-run flow < 20%

---

## Immediate Build Tasks
1. Add OpenClaw pairing status API route
2. Add frontend Connect OpenClaw wizard
3. Gate Command Center behind pairing completion
4. Replace "Not logged in /login" with actionable pairing UI
5. Add Main Agent Greeting screen after first successful connect
