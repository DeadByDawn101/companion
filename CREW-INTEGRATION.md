# RavenX Companion + Crew Integration (macOS build)

Status: scaffolded plan (non-breaking)

## Objective
Bundle Companion desktop UX with Crew-style coworker workflows so RavenX ships one expandable product.

## Product Concept
**RavenX Companion Pro (macOS)**
- Companion chat/session control UX
- OpenClaw bridge card + health controls
- Crew coworker lane (task templates + role handoff)

## Integration Surface (v1)
1. **Crew Task Panel**
   - role presets (researcher, builder, reviewer, operator)
   - launch task into selected session
2. **Handoff Artifacts**
   - export markdown worklog per role
   - pass outputs to next coworker role
3. **RavenX Variant Toggle**
   - consumer / openclaw / ravenx-pro

## Env flags (planned)
- `CREW_MODE=off|assist|full`
- `CREW_PROFILE=ravenx`
- `CREW_API_URL=` (optional local service URL)

## Build Path
1. Stabilize Electron macOS package
2. Add Crew panel behind `CREW_MODE`
3. Ship signed macOS build as RavenX product
4. Expand to iOS companion app with same role presets
