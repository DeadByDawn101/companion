# RavenX Companion — Apple App Architecture (Jony-Ive Mastery)

Date: 2026-03-06
Context: Xcode 26.3 agentic coding + RavenX Pro product expansion

## Xcode 26.3 Deep-Dive (What matters for us)
- Native agentic coding inside Xcode with Claude Agent + Codex integration
- Agents can inspect project files/settings, iterate builds, and verify via Previews
- MCP compatibility means we can plug compatible tools/agents into Xcode workflows
- Practical impact: faster iOS/macOS iteration loops and lower implementation overhead

## Product Target
Ship a premium RavenX app family:
1. **RavenX Companion for macOS** (desktop command center)
2. **RavenX Companion for iPhone** (mobile operations + approvals + alerts)

## Design System Direction (Jony-Ive principles)
- Distillation first: remove non-essential chrome
- Material honesty: glass/aluminum surfaces, subtle depth, no gimmick gradients
- Inevitable layout: strict spacing rhythm, strong typographic hierarchy
- Quiet power: minimal UI, high information density when needed

## App Surface (v1)
### iPhone
- Session list + quick action composer
- Approval center (tools/actions queue)
- Ops alerts (Iris/Maya/cluster status)
- Revenue scoreboard cards

### macOS
- Multi-session workspace
- Crew lane + OpenClaw bridge panel
- KILLER QUEEN model controls (local-first router)
- Export/share pipeline (markdown + runbooks)

## Technical Build Plan
### Phase A — Shared Core
- Shared API contracts (TypeScript/OpenAPI)
- Shared auth/session schema
- Event stream contract for approvals + status

### Phase B — Native Clients
- iOS SwiftUI app scaffold
- macOS SwiftUI shell (or Electron-native bridge continuation)
- Unified design tokens (spacing/type/color/material)

### Phase C — Agentic Development in Xcode 26.3
- Use Claude/Codex agents for repetitive UI + state wiring
- Keep human review for architecture/security decisions
- Use Xcode Previews as verification gate for each component

## Security/Quality Gates
- No secrets in app bundle
- Strict permission prompts for actions
- Audit trail for all approvals and tool executions
- Snapshot tests for critical UI states

## Immediate Next Steps
1. Create `ios/` SwiftUI scaffold for RavenX Companion
2. Define 4 core screens (Home, Sessions, Approvals, Alerts)
3. Add design tokens file and component primitives
4. Build one end-to-end flow: notification -> approval -> session action
