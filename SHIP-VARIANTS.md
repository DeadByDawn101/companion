# Ship Variants: Consumer + OpenClaw

This fork now supports two product flavors from the same codebase.

## 1) Consumer variant (public-facing)

Use this when shipping a standalone Camila chat product.

```bash
cd web
cp .env.consumer.example .env
bun install
bun run dev
```

Key behavior:
- OpenClaw bridge card is hidden
- Brand can be customized via `VITE_BRAND_NAME` and `VITE_BRAND_TAGLINE`
- Keeps multi-model + sister advisory UX

## 2) OpenClaw variant (power user)

Use this for OpenClaw-native users / fork offering.

```bash
cd web
cp .env.openclaw.example .env
bun install
bun run dev
```

Key behavior:
- OpenClaw bridge health/config/session card enabled
- Same Camila UX with model switch + sister advisory + capability panel

## Suggested release naming

- `camila-chat` (consumer)
- `camila-openclaw` (OpenClaw)

Both can be deployed as the same repo with different env files.


## 3) RavenX Pro variant (OpenClaw + Crew)

Use this for RavenX product packaging with coworker workflows on top of Companion.

```bash
cd web
cp .env.openclaw.example .env
# then enable flags
# CREW_MODE=assist
# CREW_PROFILE=ravenx
bun install
bun run dev
```

Key behavior:
- OpenClaw bridge enabled
- Companion session UX + tool approvals
- Crew integration lane enabled for coworker-style task flow
