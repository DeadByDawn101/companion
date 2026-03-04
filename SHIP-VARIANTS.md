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
